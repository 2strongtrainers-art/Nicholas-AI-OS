#!/usr/bin/env python3
"""Read-only readiness checks. Never creates jobs, deploys, or prints credentials."""
import argparse
import json
import urllib.parse
import urllib.request

import hermes_switchboard_worker as worker


def inspect_health(health):
    if not isinstance(health, dict):
        return {"remote_health": False, "queue_bound": False, "worker_key_bound": False}
    return {
        "remote_health": health.get("ok") is True and health.get("service") == "nicholas-ai-switchboard",
        "queue_bound": health.get("hermes_jobs") is True,
        # Older deployed code omits this field. Unknown must not count as ready.
        "worker_key_bound": health.get("hermes_worker_key_configured") is True,
    }


def report(url=None, fetch=None, authenticate=None):
    checks, errors = {}, {}
    for name, operation in (
        ("repository_checkout", lambda: (worker.ROOT / "AGENTS.md").is_file()),
        ("hermes_executable", worker.hermes_bin),
        ("worker_credential_file", worker.worker_key),
        ("provider_configuration", worker.hermes_environment),
    ):
        try:
            checks[name] = bool(operation())
        except Exception as exc:
            checks[name] = False
            # Deliberately exclude exception text, URLs, paths, and credentials.
            errors[name] = type(exc).__name__
    try:
        endpoint = url or worker.switchboard_url()
        parsed = urllib.parse.urlsplit(endpoint)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ("", "/"):
            raise ValueError("Expected an HTTPS origin")
        checks["endpoint_configuration"] = True
        if fetch is None:
            def fetch(target):
                request = urllib.request.Request(target, headers={"User-Agent": worker.WORKER_USER_AGENT})
                with worker.HTTP.open(request, timeout=10) as response:
                    return json.loads(response.read(16384))
        checks.update(inspect_health(fetch(endpoint.rstrip("/") + "/health")))
    except Exception as exc:
        checks["remote_health"] = False
        errors["remote_health"] = type(exc).__name__
    checks["worker_key_matches"] = False
    if (checks.get("remote_health") and checks.get("queue_bound") and checks["worker_credential_file"]
            and endpoint.rstrip("/") == worker.SWITCHBOARD_ORIGIN):
        try:
            (authenticate or worker.worker_has_access)(worker.SWITCHBOARD_ORIGIN, worker.worker_key())
            checks["worker_key_matches"] = True
            checks["worker_key_bound"] = True
        except Exception as exc:
            errors["worker_key_matches"] = type(exc).__name__
    ready = all(checks.values())
    return {
        "status": "ready_for_smoke_test" if ready else "blocked",
        "checks": checks,
        "errors": errors,
        "end_to_end_verified": False,
        "next_step": "Run one authorized research_readonly job and retrieve its terminal result/log; readiness is not execution proof.",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", help="Switchboard HTTPS origin; otherwise use private deployment.env")
    args = parser.parse_args()
    result = report(args.url)
    print(json.dumps(result, indent=2))
    return 0 if result["status"] == "ready_for_smoke_test" else 1


if __name__ == "__main__":
    raise SystemExit(main())
