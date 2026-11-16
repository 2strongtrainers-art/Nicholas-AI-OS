#!/usr/bin/env python3
"""Add missing secrets to the existing ElevenLabs Worker, then verify reads only.

Only a manual main-branch Actions run is permitted. No source upload, settings
replacement, namespace creation, secret rotation, OAuth grant, media upload or
generation is performed. Secret updates can create and deploy configuration
versions. Values stay in process memory and encrypted provider secret storage.
Receipts contain fixed labels, booleans and GitHub run identity.

Cloudflare's single-secret PUT has no documented create-only transaction. This
workflow serializes its own runs and rereads metadata immediately before every
write. Before dispatch, wait for the merge commit's Cloudflare Git Build to
finish and for deployments to be quiet. Do not run a separate secret editor
concurrently. An uncertain write is not retried; a later manual rerun rereads
and preserves existing secret names.
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping

REPOSITORY = "2strongtrainers-art/Nicholas-AI-OS"
WORKER = "nicholas-ai-os"
ORIGIN = "https://nicholas-ai-os.2strongtrainers.workers.dev"
GRANT_NAMESPACE = "7eddf8efe7d040fc962a13b38ac44287"
SECRET_NAMES = (
    "ELEVENLABS_API_KEY", "BRIDGE_TOKEN", "OAUTH_SIGNING_SECRET", "CHATGPT_SETUP_CODE",
)
MAX_RESPONSE_BYTES = 2 * 1024 * 1024
TIMEOUT_SECONDS = 25


class Blocked(Exception):
    """Only locally defined, non-sensitive codes belong in this exception."""


@dataclass
class Reply:
    status: int
    headers: Mapping[str, str]
    body: bytes = b""


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class SafeHTTP:
    def __init__(self, account_id: str):
        base = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/workers/scripts/{WORKER}"
        self.allowed = {
            ("GET", base + "/settings"), ("GET", base + "/secrets"),
            ("PUT", base + "/secrets"), ("GET", ORIGIN + "/health"),
            ("GET", ORIGIN + "/.well-known/oauth-authorization-server"),
            ("GET", ORIGIN + "/.well-known/oauth-protected-resource/mcp"),
            ("POST", ORIGIN + "/mcp"),
        }
        # No environment-supplied proxy and no redirect can forward credentials.
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())

    def request(self, method: str, url: str, headers: dict[str, str], body: Any = None) -> Reply:
        if (method, url) not in self.allowed:
            raise Blocked("request_target_not_allowed")
        data = None if body is None else json.dumps(body, separators=(",", ":")).encode()
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with self.opener.open(req, timeout=TIMEOUT_SECONDS) as response:
                if 300 <= response.status < 400:
                    raise Blocked("redirect_rejected")
                raw = response.read(MAX_RESPONSE_BYTES + 1)
                if len(raw) > MAX_RESPONSE_BYTES:
                    raise Blocked("response_too_large")
                return Reply(response.status, dict(response.headers.items()), raw)
        except urllib.error.HTTPError as exc:
            # Never read or echo an error body; it may contain private provider data.
            status, headers = exc.code, dict(exc.headers.items()) if exc.headers else {}
            exc.close()
            if 300 <= status < 400:
                raise Blocked("redirect_rejected") from None
            return Reply(status, headers)
        except (OSError, ValueError):
            raise Blocked("network_request_failed") from None


def decode_json(reply: Reply) -> Any:
    try:
        return json.loads(reply.body)
    except (ValueError, UnicodeError):
        raise Blocked("invalid_json_response") from None


def header(reply: Reply, name: str) -> str:
    return next((v for k, v in reply.headers.items() if k.lower() == name.lower()), "")


def rpc_result(reply: Reply, request_id: int) -> dict[str, Any]:
    if reply.status != 200:
        raise Blocked("authenticated_mcp_http_failed")
    try:
        text = reply.body.decode("utf-8")
        if "text/event-stream" in header(reply, "content-type"):
            messages = []
            for event in text.replace("\r\n", "\n").split("\n\n"):
                data = "\n".join(line[5:].lstrip() for line in event.splitlines() if line.startswith("data:"))
                if data:
                    messages.append(json.loads(data))
        else:
            messages = [json.loads(text)]
        result = next(x for x in messages if isinstance(x, dict) and x.get("id") == request_id)
        if result.get("error") or not isinstance(result.get("result"), dict):
            raise ValueError()
        return result["result"]
    except (ValueError, UnicodeError, StopIteration):
        raise Blocked("mcp_response_rejected") from None


def tool_json(result: dict[str, Any]) -> dict[str, Any]:
    if result.get("isError"):
        raise Blocked("mcp_tool_failed")
    try:
        content = result["content"]
        if not isinstance(content, list) or len(content) != 1 or content[0].get("type") != "text":
            raise ValueError()
        value = json.loads(content[0]["text"])
        if not isinstance(value, dict):
            raise ValueError()
        return value
    except (KeyError, TypeError, ValueError):
        raise Blocked("mcp_tool_result_invalid") from None


def initial_receipt(env: Mapping[str, str]) -> dict[str, Any]:
    sha = env.get("GITHUB_SHA", "")
    return {
        "schema": "elevenlabs-bridge-provisioning-v1",
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "status": "BLOCKED", "worker": WORKER,
        "commit": sha if re.fullmatch(r"[0-9a-f]{40}", sha) else None,
        "run_id": env.get("GITHUB_RUN_ID") if env.get("GITHUB_RUN_ID", "").isdigit() else None,
        "run_attempt": env.get("GITHUB_RUN_ATTEMPT") if env.get("GITHUB_RUN_ATTEMPT", "").isdigit() else None,
        "secret_writes_attempted": [], "secrets_added": [], "existing_secrets_preserved": [],
        "checks": {}, "media_generations": 0, "media_uploads": 0,
        "chatgpt_oauth_connection": "NOT_TESTED", "error_code": None,
    }


def validate_environment(env: Mapping[str, str]) -> None:
    if (env.get("GITHUB_REPOSITORY") != REPOSITORY or env.get("GITHUB_REF") != "refs/heads/main"
            or env.get("GITHUB_EVENT_NAME") != "workflow_dispatch"):
        raise Blocked("manual_main_run_required")
    if env.get("ALLOW_PAID_AI") != "false" or env.get("ALLOW_OUTBOUND_SEND") != "false":
        raise Blocked("read_only_verification_controls_required")
    if not re.fullmatch(r"[0-9a-f]{32}", env.get("CLOUDFLARE_ACCOUNT_ID", "")):
        raise Blocked("cloudflare_account_id_invalid")
    for name in ("CLOUDFLARE_API_TOKEN", *SECRET_NAMES):
        value = env.get(name, "")
        minimum = 32 if name in SECRET_NAMES[1:] else 20
        if (len(value) < minimum or len(value) > 4096 or not value.isascii()
                or any(ord(c) <= 32 or ord(c) >= 127 for c in value)):
            raise Blocked("required_encrypted_secret_missing_or_invalid")
    if len({env[name] for name in SECRET_NAMES}) != len(SECRET_NAMES):
        raise Blocked("application_secrets_must_be_independent")


class Provisioner:
    def __init__(self, env: Mapping[str, str], http: Any, receipt: dict[str, Any]):
        self.env, self.http, self.receipt = env, http, receipt
        self.base = f"https://api.cloudflare.com/client/v4/accounts/{env['CLOUDFLARE_ACCOUNT_ID']}/workers/scripts/{WORKER}"
        self.cf_headers = {"Authorization": "Bearer " + env["CLOUDFLARE_API_TOKEN"],
                           "Accept": "application/json", "Content-Type": "application/json"}
        self.mcp_headers = {"Authorization": "Bearer " + env["BRIDGE_TOKEN"],
                            "Accept": "application/json, text/event-stream", "Content-Type": "application/json"}
        self.mcp_initialized = False

    def cloudflare(self, suffix: str, method: str = "GET", body: Any = None) -> Any:
        response = self.http.request(method, self.base + suffix, self.cf_headers, body)
        if response.status not in {"GET": (200,), "PUT": (200, 201)}.get(method, ()):
            raise Blocked("cloudflare_request_failed")
        data = decode_json(response)
        if not isinstance(data, dict) or data.get("success") is not True or "result" not in data:
            raise Blocked("cloudflare_result_rejected")
        return data["result"]

    def state(self) -> tuple[str, set[str]]:
        settings = self.cloudflare("/settings")
        secrets = self.cloudflare("/secrets")
        if not isinstance(settings, dict) or not isinstance(settings.get("bindings"), list) or not isinstance(secrets, list):
            raise Blocked("worker_metadata_invalid")
        bindings = settings["bindings"]
        if any(not isinstance(b, dict) or not isinstance(b.get("name"), str) or not isinstance(b.get("type"), str) for b in bindings):
            raise Blocked("worker_binding_invalid")
        by_name = {b["name"]: b for b in bindings}
        if len(by_name) != len(bindings):
            raise Blocked("duplicate_binding_names")
        grant = by_name.get("OAUTH_GRANTS", {})
        if (grant.get("type") != "durable_object_namespace" or grant.get("class_name") != "OAuthGrantStore"
                or grant.get("namespace_id") != GRANT_NAMESPACE or grant.get("script_name") not in (None, WORKER)):
            raise Blocked("expected_existing_grant_binding_missing")
        if any(not isinstance(s, dict) or not isinstance(s.get("name"), str) or s.get("type") not in ("secret_text", "secret_key") for s in secrets):
            raise Blocked("secret_metadata_invalid")
        secret_names = {s["name"] for s in secrets}
        bound_secrets = {b["name"] for b in bindings if b["type"] in ("secret_text", "secret_key")}
        if secret_names != bound_secrets:
            raise Blocked("secret_metadata_disagreement")
        for name in SECRET_NAMES:
            if name in by_name and by_name[name]["type"] != "secret_text":
                raise Blocked("existing_binding_type_conflict")
        other_bindings = [b for b in bindings if b["type"] not in ("secret_text", "secret_key")]
        # This comparison stays in memory: no binding values enter the receipt.
        snapshot = json.dumps(sorted(other_bindings, key=lambda b: b["name"]), sort_keys=True)
        return snapshot, secret_names

    def public_json(self, path: str) -> dict[str, Any]:
        response = self.http.request("GET", ORIGIN + path, {"Accept": "application/json"})
        if response.status != 200:
            raise Blocked("public_configuration_check_failed")
        value = decode_json(response)
        if not isinstance(value, dict):
            raise Blocked("public_configuration_check_failed")
        return value

    def rpc(self, request_id: int, method: str, params: dict[str, Any]) -> dict[str, Any]:
        # No arbitrary provider-side or metered tool can be selected by an input.
        if method not in ("initialize", "tools/list", "tools/call"):
            raise Blocked("mcp_method_not_allowed")
        if method == "tools/call" and params.get("name") not in ("bridge_status", "find_voices"):
            raise Blocked("mcp_tool_not_allowed")
        response = self.http.request("POST", ORIGIN + "/mcp", self.mcp_headers,
                                     {"jsonrpc": "2.0", "id": request_id, "method": method, "params": params})
        if method == "initialize":
            session = header(response, "mcp-session-id")
            if session:
                if len(session) > 256 or any(ord(c) <= 32 or ord(c) >= 127 for c in session):
                    raise Blocked("invalid_mcp_session_header")
                self.mcp_headers["Mcp-Session-Id"] = session
        return rpc_result(response, request_id)

    def initialize_mcp(self) -> None:
        if self.mcp_initialized:
            return
        initialized = self.rpc(1, "initialize", {"protocolVersion": "2025-03-26", "capabilities": {},
                               "clientInfo": {"name": "deployment-readonly-verifier", "version": "1.0"}})
        version = initialized.get("protocolVersion")
        if not isinstance(version, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", version):
            raise Blocked("mcp_protocol_invalid")
        self.mcp_headers["MCP-Protocol-Version"] = version
        notified = self.http.request("POST", ORIGIN + "/mcp", self.mcp_headers,
                                     {"jsonrpc": "2.0", "method": "notifications/initialized"})
        if notified.status not in (200, 202, 204):
            raise Blocked("mcp_initialization_failed")
        self.mcp_initialized = True

    def verify(self) -> None:
        health = self.public_json("/health")
        if (health.get("ok") is not True or health.get("service") != "nicholas-elevenlabs-bridge"
                or health.get("oauth_configured") is not True or health.get("grant_storage_bound") is not True):
            raise Blocked("worker_oauth_configuration_incomplete")
        self.receipt["checks"]["oauth_configuration"] = True
        for name, authorization in (("unauthenticated_mcp_rejected", None),
                                    ("invalid_bearer_rejected", "Bearer invalid-deployment-check")):
            headers = {"Accept": "application/json, text/event-stream", "Content-Type": "application/json"}
            if authorization:
                headers["Authorization"] = authorization
            response = self.http.request("POST", ORIGIN + "/mcp", headers,
                                         {"jsonrpc": "2.0", "id": 0, "method": "tools/list", "params": {}})
            if response.status != 401:
                raise Blocked("unauthorized_mcp_access_not_rejected")
            self.receipt["checks"][name] = True
        metadata = self.public_json("/.well-known/oauth-authorization-server")
        resource = self.public_json("/.well-known/oauth-protected-resource/mcp")
        if (metadata.get("issuer") != ORIGIN or metadata.get("authorization_endpoint") != ORIGIN + "/oauth/authorize"
                or metadata.get("token_endpoint") != ORIGIN + "/oauth/token"
                or "S256" not in metadata.get("code_challenge_methods_supported", [])
                or "elevenlabs" not in metadata.get("scopes_supported", [])
                or resource.get("resource") != ORIGIN + "/mcp"
                or resource.get("authorization_servers") != [ORIGIN]):
            raise Blocked("oauth_metadata_rejected")
        self.receipt["checks"]["oauth_discovery"] = True
        self.initialize_mcp()
        catalog = self.rpc(2, "tools/list", {})
        tools = catalog.get("tools")
        if not isinstance(tools, list) or catalog.get("nextCursor"):
            raise Blocked("mcp_catalog_incomplete")
        names = {t.get("name") for t in tools if isinstance(t, dict)}
        if not {"bridge_status", "find_voices", "speech_to_text"}.issubset(names):
            raise Blocked("expected_bridge_tools_missing")
        self.receipt["checks"]["authenticated_tool_catalog"] = True
        status = tool_json(self.rpc(3, "tools/call", {"name": "bridge_status", "arguments": {}}))
        if not all(status.get(k) is True for k in ("ok", "elevenlabs_key_configured", "oauth_configured", "grant_storage_bound")):
            raise Blocked("authenticated_bridge_status_failed")
        self.receipt["checks"]["authenticated_bridge_status"] = True
        voices = tool_json(self.rpc(4, "tools/call", {"name": "find_voices", "arguments": {"search": "August Nick", "page_size": 1}}))
        if not isinstance(voices.get("voices"), list):
            raise Blocked("provider_voice_read_failed")
        self.receipt["checks"]["provider_voice_read"] = True

    def run(self) -> None:
        health = self.public_json("/health")
        if health.get("ok") is not True or health.get("service") != "nicholas-elevenlabs-bridge":
            raise Blocked("unexpected_existing_worker")
        baseline, original_secrets = self.state()
        if "BRIDGE_TOKEN" in original_secrets:
            self.initialize_mcp()
            status = tool_json(self.rpc(0, "tools/call", {"name": "bridge_status", "arguments": {}}))
            if status.get("ok") is not True:
                raise Blocked("existing_bearer_preflight_failed")
            self.receipt["checks"]["existing_bearer_authenticated"] = True
        for name in SECRET_NAMES:
            current, existing = self.state()
            if current != baseline or not original_secrets.issubset(existing):
                raise Blocked("worker_bindings_changed_concurrently")
            if name in existing:
                self.receipt["existing_secrets_preserved"].append(name)
                continue
            self.receipt["secret_writes_attempted"].append(name)
            result = self.cloudflare("/secrets", "PUT", {"name": name, "type": "secret_text", "text": self.env[name]})
            if not isinstance(result, dict) or result.get("name") != name or result.get("type") != "secret_text":
                raise Blocked("secret_write_receipt_invalid")
            self.receipt["secrets_added"].append(name)
            after, names = self.state()
            if after != baseline or name not in names or not original_secrets.issubset(names):
                raise Blocked("secret_write_verification_failed")
        final, final_secrets = self.state()
        if final != baseline or not (original_secrets | set(SECRET_NAMES)).issubset(final_secrets):
            raise Blocked("worker_bindings_not_preserved")
        self.receipt["checks"]["other_bindings_preserved"] = True
        self.verify()


def execute(env: Mapping[str, str], http: Any = None) -> dict[str, Any]:
    receipt = initial_receipt(env)
    try:
        validate_environment(env)
        Provisioner(env, http or SafeHTTP(env["CLOUDFLARE_ACCOUNT_ID"]), receipt).run()
        receipt["status"] = "CONFIGURED_AND_BEARER_VERIFIED"
    except Blocked as exc:
        receipt["error_code"] = str(exc)
    except Exception:
        # Do not expose traceback locals, provider responses or secret-bearing messages.
        receipt["error_code"] = "unexpected_verification_failure"
    return receipt


def main() -> int:
    receipt = execute(os.environ)
    output = json.dumps(receipt, sort_keys=True, indent=2)
    try:
        target = os.environ.get("BRIDGE_RECEIPT_PATH", "")
        if not target:
            raise OSError()
        path = Path(target)
        path.parent.mkdir(parents=True, exist_ok=True)
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            handle.write(output + "\n")
        if os.environ.get("GITHUB_STEP_SUMMARY"):
            with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as handle:
                handle.write("### ElevenLabs bridge — configuration and read-only acceptance\n\n")
                handle.write("Actual ChatGPT OAuth connection remains untested. No media generated or uploaded.\n\n")
                handle.write("```json\n" + output + "\n```\n")
    except OSError:
        print('{"status":"BLOCKED","error_code":"receipt_write_failed"}')
        return 1
    print(output)
    return 0 if receipt["status"] == "CONFIGURED_AND_BEARER_VERIFIED" else 1


if __name__ == "__main__":
    sys.exit(main())
