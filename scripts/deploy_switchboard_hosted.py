#!/usr/bin/env python3
"""Deploy the existing Switchboard from trusted main using GitHub-hosted compute."""

import json
import os
import re
import subprocess
import tempfile
import time
from pathlib import Path

SERVICE = Path(__file__).resolve().parents[1] / "services" / "ai-switchboard"
ORIGIN = "https://nicholas-ai-switchboard.2strongtrainers.workers.dev"
RELEASE_MAX_TOKENS = 1500
RELEASE_MODEL_ALIASES = frozenset({"ox", "qwen", "auto", "free", "qwen-flash"})
REQUIRED_SECRETS = {"SWITCHBOARD_API_KEY", "OPENROUTER_API_KEY"}
INHERITED_TYPES = {"plain_text", "json", "secret_text", "secret_key", "kv_namespace"}
VERSION_ID = re.compile(r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}")
NAMESPACE_ID = re.compile(r"[0-9a-f]{32}")


def wrangler(*args, output_path=None):
    env = os.environ.copy()
    if output_path:
        env["WRANGLER_OUTPUT_FILE_PATH"] = str(output_path)
    result = subprocess.run(
        ["node", "node_modules/wrangler/bin/wrangler.js", *args],
        cwd=SERVICE, env=env, capture_output=True, text=True, timeout=150,
    )
    if result.returncode:
        raise RuntimeError(f"Wrangler {args[0]} {args[1]} failed. Check the Worker token scope and Cloudflare deployment history.")
    return result.stdout


def bindings(version):
    records = version.get("resources", {}).get("bindings")
    if not isinstance(records, list):
        raise ValueError("Cloudflare did not return version bindings.")
    found = {}
    for binding in records:
        if not isinstance(binding, dict):
            raise ValueError("Cloudflare returned an invalid binding.")
        name, kind = binding.get("name"), binding.get("type")
        if not isinstance(name, str) or kind not in INHERITED_TYPES or name in found:
            raise ValueError("The active Worker has an unsupported or ambiguous binding.")
        found[name] = binding
    if any(found.get(name, {}).get("type") not in {"secret_text", "secret_key"} for name in REQUIRED_SECRETS):
        raise ValueError("The existing Switchboard and OpenRouter secret bindings are required.")
    return found


def binding_manifest(rows):
    return {name: (
        item["type"], item.get("namespace_id"), item.get("text") if item["type"] == "plain_text" else None,
        item.get("json") if item["type"] == "json" else None,
    ) for name, item in rows.items()}


def restore_hermes_binding(existing, namespace_id):
    if not namespace_id:
        return existing
    if not NAMESPACE_ID.fullmatch(namespace_id):
        raise ValueError("Provide the verified production Hermes KV namespace ID.")
    current = existing.get("HERMES_JOBS")
    if current and (current["type"], current.get("namespace_id")) != ("kv_namespace", namespace_id):
        raise ValueError("HERMES_JOBS already points to a different binding. Review the active Worker before moving it.")
    return existing | {"HERMES_JOBS": {"name": "HERMES_JOBS", "type": "kv_namespace", "namespace_id": namespace_id}}


def deployment_config(config, existing):
    config = dict(config, main=str(SERVICE / config["main"]))
    # Existing values take precedence. Supply repo defaults only for missing model pins.
    config["vars"] = {name: value for name, value in config["vars"].items() if name not in existing}
    namespaces = []
    for name, binding in existing.items():
        if binding["type"] == "kv_namespace":
            namespace_id = binding.get("namespace_id", "")
            if not isinstance(namespace_id, str) or not NAMESPACE_ID.fullmatch(namespace_id):
                raise ValueError("The active Worker has an invalid KV namespace identifier.")
            namespaces.append({"binding": name, "id": namespace_id})
    config["kv_namespaces"] = namespaces
    return config


def check_bindings(expected, staged, defaults):
    # Secret values are opaque. Wrangler inherits them from the latest upload.
    new_pins = {name: {"type": "plain_text", "text": value} for name, value in defaults.items()}
    if binding_manifest(expected | new_pins) != binding_manifest(staged):
        raise RuntimeError("The staged version does not match the active Worker's bindings. No traffic was moved.")


def get_version(version_id):
    if not isinstance(version_id, str) or not VERSION_ID.fullmatch(version_id):
        raise ValueError("Cloudflare did not return a valid version ID.")
    version = json.loads(wrangler("versions", "view", version_id, "--json"))
    if version.get("id") != version_id:
        raise ValueError("Cloudflare returned a different version.")
    return version


def active_version():
    deployment = json.loads(wrangler("deployments", "status", "--json"))
    versions = deployment.get("versions", [])
    if len(versions) != 1 or versions[0].get("percentage") != 100:
        raise RuntimeError("Expected one active production version at 100% traffic.")
    return deployment["id"], versions[0]["version_id"]


def public_get(path):
    response = subprocess.run(
        ["curl", "--disable", "--silent", "--show-error", "--max-time", "10",
         "--write-out", "\n%{http_code}", ORIGIN + path],
        check=True, capture_output=True, text=True, timeout=12,
    )
    body, _, status = response.stdout.rpartition("\n")
    return int(status), body


def verify_live(has_hermes_queue):
    for attempt in range(5):
        try:
            health_status, health_body = public_get("/health")
            schema_status, schema_body = public_get("/openapi.json")
            health = json.loads(health_body)
            schema = json.loads(schema_body)
            ask = schema["paths"]["/ask"]["post"]
            properties = ask["requestBody"]["content"]["application/json"]["schema"]["properties"]
            if (
                health_status == schema_status == 200
                and health.get("ok") is True and health.get("service") == "nicholas-ai-switchboard"
                and health.get("atlas") is True
                and health.get("tool_routing") is True and health.get("hermes_jobs") is has_hermes_queue
                and ask.get("operationId") == "switchboardAsk"
                and properties["max_tokens"]["default"] == RELEASE_MAX_TOKENS
                and set(properties["model"]["enum"]) == RELEASE_MODEL_ALIASES
                and public_get("/models")[0] == 401
            ):
                return
        except (OSError, AttributeError, KeyError, TypeError, ValueError, subprocess.SubprocessError):
            pass
        if attempt < 4:
            time.sleep(3)
    raise RuntimeError("Live verification failed. Inspect the deployment before making further changes.")


def restore_previous_if_active(candidate, previous):
    if active_version()[1] != candidate:
        return
    try:
        wrangler("versions", "deploy", f"{previous}@100%", "--yes")
    except (RuntimeError, subprocess.TimeoutExpired):
        # Cloudflare can move traffic before Wrangler reports an error.
        pass
    if active_version()[1] != previous:
        raise RuntimeError("Could not verify rollback. Review Cloudflare deployment history before retrying.")
    print(f"SWITCHBOARD_DEPLOY_ROLLED_BACK version={previous}")


def main():
    if os.environ.get("GITHUB_REF") != "refs/heads/main":
        raise RuntimeError("This deployment must run from main.")
    sha = os.environ.get("GITHUB_SHA", "")
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise ValueError("A valid GitHub commit is required.")
    namespace_id = os.environ.get("HERMES_JOBS_NAMESPACE_ID", "").strip()
    if namespace_id and not NAMESPACE_ID.fullmatch(namespace_id):
        raise ValueError("Provide the verified production Hermes KV namespace ID.")
    account = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
    if not re.fullmatch(r"[0-9a-f]{32}", account) or not os.environ.get("CLOUDFLARE_API_TOKEN"):
        raise RuntimeError("Configure the account ID and Worker-scoped API token in the switchboard-production environment.")

    config = json.loads((SERVICE / "wrangler.jsonc").read_text())
    if config.get("name") != "nicholas-ai-switchboard":
        raise ValueError("Expected the nicholas-ai-switchboard Wrangler configuration.")
    deployed_id, current_id = active_version()
    current = get_version(current_id)
    existing = bindings(current)
    expected = restore_hermes_binding(existing, namespace_id)

    candidate = current_id
    if (current.get("annotations") or {}).get("workers/tag") != sha or binding_manifest(expected) != binding_manifest(existing):
        latest = json.loads(wrangler("versions", "list", "--json"))[-1]
        if latest["id"] != current_id and (latest.get("annotations") or {}).get("workers/tag") != sha:
            raise RuntimeError("There is a newer staged Cloudflare version. Review it before uploading another version.")
        config = deployment_config(config, expected)
        if latest["id"] != current_id:
            candidate = latest["id"]
        else:
            with tempfile.TemporaryDirectory() as directory:
                config_path = Path(directory) / "wrangler.json"
                output_path = Path(directory) / "versions.jsonl"
                config_path.write_text(json.dumps(config))
                wrangler(
                    "versions", "upload", "--config", str(config_path), "--keep-vars", "--strict",
                    "--tag", sha, output_path=output_path,
                )
                entries = [json.loads(line) for line in output_path.read_text().splitlines()]
                (upload,) = [entry for entry in entries if entry.get("type") == "version-upload"]
                candidate = upload["version_id"]
        check_bindings(expected, bindings(get_version(candidate)), config["vars"])
        if active_version() != (deployed_id, current_id):
            raise RuntimeError("The active deployment changed during upload. Review before moving traffic.")

    try:
        if candidate != current_id:
            wrangler("versions", "deploy", f"{candidate}@100%", "--yes")
        verify_live(expected.get("HERMES_JOBS", {}).get("type") == "kv_namespace")
    except (RuntimeError, subprocess.TimeoutExpired):
        if candidate != current_id:
            restore_previous_if_active(candidate, current_id)
        raise
    if active_version()[1] != candidate:
        raise RuntimeError("Cloudflare does not show the verified version at 100% traffic.")
    print(f"SWITCHBOARD_DEPLOY_VERIFIED commit={sha} version={candidate} model_probe=skipped")


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError, ValueError, KeyError, IndexError, TypeError, subprocess.SubprocessError) as error:
        message = str(error) if type(error) in {RuntimeError, ValueError} else "Cloudflare deployment or verification failed."
        raise SystemExit(message)
