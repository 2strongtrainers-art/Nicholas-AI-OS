"""Report the public Switchboard contract with zero model calls."""

import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from .deploy_switchboard_hosted import ORIGIN, RELEASE_MAX_TOKENS, RELEASE_MODEL_ALIASES, public_get

LEGACY_MAX_TOKENS = 6000
LEGACY_MODEL_ALIASES = frozenset({"ox", "qwen", "auto"})
EXPECTED_STATUS = {"/health": 200, "/openapi.json": 200, "/models": 401}


def inspect_schema(schema):
    try:
        ask = schema["paths"]["/ask"]["post"]
        fields = ask["requestBody"]["content"]["application/json"]["schema"]["properties"]
        token_limit = fields["max_tokens"]["default"]
        aliases = fields["model"]["enum"]
        if ask["operationId"] != "switchboardAsk" or type(token_limit) is not int or not isinstance(aliases, list):
            return "unexpected_contract", None
        models = frozenset(aliases)
        if len(models) != len(aliases):
            return "unexpected_contract", token_limit
    except (KeyError, TypeError):
        return "unexpected_contract", None
    if token_limit == RELEASE_MAX_TOKENS and models == RELEASE_MODEL_ALIASES:
        return "verified", token_limit
    if token_limit == LEGACY_MAX_TOKENS and models == LEGACY_MODEL_ALIASES:
        return "release_pending", token_limit
    return "unexpected_contract", token_limit


def check_switchboard():
    http_status = {}
    documents = {}
    errors = []
    for path, expected in EXPECTED_STATUS.items():
        try:
            status, body = public_get(path)
        except (OSError, ValueError, subprocess.SubprocessError):
            http_status[path] = None
            errors.append(f"{path} request failed.")
            continue
        http_status[path] = status
        if status != expected:
            errors.append(f"{path} returned HTTP {status}. Expected {expected}.")
        elif status == 200:
            try:
                documents[path] = json.loads(body)
            except ValueError:
                errors.append(f"{path} returned invalid JSON.")

    health = documents.get("/health")
    queue_bound = health.get("hermes_jobs") if isinstance(health, dict) else None
    healthy = (
        isinstance(health, dict)
        and all(health.get(key) is True for key in ("ok", "atlas", "tool_routing"))
        and type(queue_bound) is bool
    )
    if "/health" in documents and not healthy:
        errors.append("/health did not confirm the expected service state.")

    schema_status, token_limit = "unverified", None
    if "/openapi.json" in documents:
        schema_status, token_limit = inspect_schema(documents["/openapi.json"])
        if schema_status == "unexpected_contract":
            errors.append("/openapi.json differs from the expected Switchboard release contracts.")

    return {
        "checked_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": ORIGIN,
        "status": "failed" if errors else schema_status,
        "http_status": http_status,
        "service_healthy": healthy,
        "schema_status": schema_status,
        "output_token_default": token_limit,
        "hermes": {"queue_bound": queue_bound if type(queue_bound) is bool else None, "runner_status": "unverified"},
        "errors": errors,
    }


def main():
    report = check_switchboard()
    print(json.dumps(report, indent=2))
    if summary_path := os.getenv("GITHUB_STEP_SUMMARY"):
        queue = {True: "bound", False: "unbound", None: "unverified"}[report["hermes"]["queue_bound"]]
        lines = [
            "### Switchboard readiness",
            f"- Status **{report['status']}**. Schema **{report['schema_status']}**.",
            f"- Output token default {report['output_token_default'] or 'unverified'}.",
            f"- Hermes queue **{queue}**. Runner completion requires a separate job check.",
            *[f"- {error}" for error in report["errors"]],
        ]
        with Path(summary_path).open("a", encoding="utf-8") as summary:
            summary.write("\n".join(lines) + "\n")
    return int(report["status"] == "failed")


if __name__ == "__main__":
    raise SystemExit(main())
