"""Security regressions use only fake credentials, in-memory APIs and no network."""
from __future__ import annotations

import copy
import importlib.util
import io
import json
import sys
import unittest
import urllib.error
from pathlib import Path

HELPER = Path(__file__).resolve().parents[1] / "scripts" / "provision_elevenlabs_bridge.py"
spec = importlib.util.spec_from_file_location("bridge_provisioning", HELPER)
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)


def environment():
    return {
        "GITHUB_REPOSITORY": module.REPOSITORY, "GITHUB_REF": "refs/heads/main",
        "GITHUB_EVENT_NAME": "workflow_dispatch", "GITHUB_SHA": "a" * 40,
        "GITHUB_RUN_ID": "123", "GITHUB_RUN_ATTEMPT": "1",
        "CLOUDFLARE_ACCOUNT_ID": "b" * 32, "CLOUDFLARE_API_TOKEN": "fake-cf-" + "c" * 40,
        "ELEVENLABS_API_KEY": "fake-provider-" + "e" * 40,
        "BRIDGE_TOKEN": "fake-bridge-" + "b" * 40,
        "OAUTH_SIGNING_SECRET": "fake-signing-" + "s" * 40,
        "CHATGPT_SETUP_CODE": "fake-setup-" + "u" * 40,
        "ALLOW_PAID_AI": "false", "ALLOW_OUTBOUND_SEND": "false",
    }


def reply(value, status=200, headers=None):
    return module.Reply(status, headers or {"content-type": "application/json"}, json.dumps(value).encode())


class FakeAPI:
    def __init__(self, env):
        self.env = env
        self.bindings = [
            {"name": "OAUTH_GRANTS", "type": "durable_object_namespace",
             "class_name": "OAuthGrantStore", "namespace_id": module.GRANT_NAMESPACE},
            {"name": "KEEP_SETTING", "type": "plain_text", "text": "preserve-this-setting"},
            {"name": "KEEP_KV", "type": "kv_namespace", "namespace_id": "1" * 32},
        ]
        self.values = {}
        self.calls = []
        self.write_failure = False
        self.write_status = 201
        self.corrupt_binding_after_write = False
        self.provider_error = False
        self.allow_unauthorized = False
        self.stream = False

    def add_existing(self, name, value):
        self.values[name] = value
        self.bindings.append({"name": name, "type": "secret_text"})

    def request(self, method, url, headers, body=None):
        self.calls.append((method, url, copy.deepcopy(body)))
        if url.startswith("https://api.cloudflare.com/"):
            if url.endswith("/settings") and method == "GET":
                return reply({"success": True, "result": {"bindings": copy.deepcopy(self.bindings)}})
            if url.endswith("/secrets") and method == "GET":
                return reply({"success": True, "result": [{"name": n, "type": "secret_text"} for n in self.values]})
            if url.endswith("/secrets") and method == "PUT":
                if self.write_failure:
                    return reply({"echo": self.env["ELEVENLABS_API_KEY"]}, status=403)
                if body["name"] in self.values:
                    raise AssertionError("Existing secret must never be overwritten")
                self.add_existing(body["name"], body["text"])
                if self.corrupt_binding_after_write:
                    self.bindings[0]["namespace_id"] = "2" * 32
                return reply({"success": True, "result": {"name": body["name"], "type": "secret_text"}}, status=self.write_status)
            raise AssertionError("Unexpected Cloudflare operation")
        if url == module.ORIGIN + "/health":
            configured = all(n in self.values for n in ("OAUTH_SIGNING_SECRET", "CHATGPT_SETUP_CODE"))
            return reply({"ok": True, "service": "nicholas-elevenlabs-bridge",
                          "oauth_configured": configured, "grant_storage_bound": True})
        if url == module.ORIGIN + "/.well-known/oauth-authorization-server":
            return reply({"issuer": module.ORIGIN, "authorization_endpoint": module.ORIGIN + "/oauth/authorize",
                          "token_endpoint": module.ORIGIN + "/oauth/token", "code_challenge_methods_supported": ["S256"],
                          "scopes_supported": ["elevenlabs"]})
        if url == module.ORIGIN + "/.well-known/oauth-protected-resource/mcp":
            return reply({"resource": module.ORIGIN + "/mcp", "authorization_servers": [module.ORIGIN]})
        if url != module.ORIGIN + "/mcp" or method != "POST":
            raise AssertionError("Unexpected request target")
        if headers.get("Authorization") != "Bearer " + self.values.get("BRIDGE_TOKEN", ""):
            return reply({}, status=200 if self.allow_unauthorized else 401)
        name = body["method"]
        if name == "notifications/initialized":
            return module.Reply(202, {})
        if name == "initialize":
            result = {"protocolVersion": "2025-03-26", "capabilities": {}, "serverInfo": {"name": "test", "version": "1"}}
        elif name == "tools/list":
            result = {"tools": [{"name": n} for n in ("bridge_status", "find_voices", "speech_to_text", "create_speech")]}
        elif name == "tools/call":
            tool = body["params"]["name"]
            if tool == "bridge_status":
                value = {"ok": True, "elevenlabs_key_configured": "ELEVENLABS_API_KEY" in self.values,
                         "oauth_configured": all(n in self.values for n in ("OAUTH_SIGNING_SECRET", "CHATGPT_SETUP_CODE")),
                         "grant_storage_bound": True}
            elif tool == "find_voices":
                value = {"voices": [{"voice_id": "private-voice-id", "name": "Private test voice"}]}
                if self.provider_error:
                    return reply({"jsonrpc": "2.0", "id": body["id"], "result": {"isError": True,
                                 "content": [{"type": "text", "text": self.env["ELEVENLABS_API_KEY"]}]}})
            else:
                raise AssertionError("Metered/upload tool must never be called")
            result = {"content": [{"type": "text", "text": json.dumps(value)}]}
        else:
            raise AssertionError("Unexpected MCP operation")
        payload = {"jsonrpc": "2.0", "id": body["id"], "result": result}
        if self.stream:
            return module.Reply(200, {"Content-Type": "text/event-stream"}, ("event: message\ndata: " + json.dumps(payload) + "\n\n").encode())
        return reply(payload)


class ProvisioningSecurityTests(unittest.TestCase):
    def test_public_denial_records_status_without_body_retry_or_secret_access(self):
        env = environment()
        class DeniedAPI:
            def __init__(self):
                self.calls = []
            def request(self, method, url, headers, body=None):
                self.calls.append((method, url))
                return reply({"private": env["ELEVENLABS_API_KEY"]}, status=403)
        api = DeniedAPI()
        receipt = module.execute(env, api)
        self.assertEqual(receipt["error_code"], "public_configuration_check_failed")
        self.assertEqual(receipt["public_http_status"], {"health": 403})
        self.assertEqual(api.calls, [("GET", module.ORIGIN + "/health")])
        self.assertEqual(receipt["secret_writes_attempted"], [])
        self.assertEqual(receipt["secrets_added"], [])
        self.assertNotIn(env["ELEVENLABS_API_KEY"], json.dumps(receipt))

    def test_public_diagnostic_cannot_include_arbitrary_path_or_non_numeric_status(self):
        env = environment()
        api = FakeAPI(env)
        receipt = module.initial_receipt(env)
        provisioner = module.Provisioner(env, api, receipt)
        with self.assertRaisesRegex(module.Blocked, "public_check_path_not_allowed"):
            provisioner.public_json("/private/" + env["BRIDGE_TOKEN"])
        self.assertEqual(api.calls, [])
        self.assertEqual(receipt["public_http_status"], {})
        class InvalidStatusAPI:
            def request(self, *args):
                return module.Reply(env["BRIDGE_TOKEN"], {})
        result = module.execute(env, InvalidStatusAPI())
        self.assertEqual(result["error_code"], "public_http_status_invalid")
        self.assertNotIn(env["BRIDGE_TOKEN"], json.dumps(result))

    def test_missing_secrets_added_to_only_target_existing_bindings_preserved(self):
        env = environment()
        api = FakeAPI(env)
        original = copy.deepcopy(api.bindings)
        receipt = module.execute(env, api)
        self.assertEqual(receipt["status"], "CONFIGURED_AND_BEARER_VERIFIED")
        self.assertEqual(receipt["secrets_added"], list(module.SECRET_NAMES))
        self.assertEqual(api.bindings[:len(original)], original)
        writes = [(m, u, b) for m, u, b in api.calls if m == "PUT"]
        self.assertEqual(len(writes), 4)
        self.assertTrue(all(u.endswith("/workers/scripts/nicholas-ai-os/secrets") for _, u, _ in writes))
        tools = [b["params"]["name"] for _, _, b in api.calls if isinstance(b, dict) and b.get("method") == "tools/call"]
        self.assertEqual(tools, ["bridge_status", "find_voices"])
        self.assertEqual(receipt["media_generations"], 0)
        self.assertEqual(receipt["chatgpt_oauth_connection"], "NOT_TESTED")
        serialized = json.dumps(receipt)
        sensitive_values = [env[k] for k in ("CLOUDFLARE_API_TOKEN", *module.SECRET_NAMES)]
        for value in (*sensitive_values, "private-voice-id", "Private test voice", "preserve-this-setting"):
            self.assertNotIn(value, serialized)

    def test_existing_credentials_are_preserved_and_never_rotated(self):
        env = environment()
        api = FakeAPI(env)
        api.add_existing("ELEVENLABS_API_KEY", "different-existing-provider-value")
        api.add_existing("OAUTH_SIGNING_SECRET", "different-existing-signing-value")
        api.add_existing("UNRELATED_SECRET", "unrelated-existing-value")
        receipt = module.execute(env, api)
        self.assertEqual(receipt["status"], "CONFIGURED_AND_BEARER_VERIFIED")
        self.assertEqual(receipt["existing_secrets_preserved"], ["ELEVENLABS_API_KEY", "OAUTH_SIGNING_SECRET"])
        self.assertEqual(api.values["ELEVENLABS_API_KEY"], "different-existing-provider-value")
        self.assertEqual(api.values["OAUTH_SIGNING_SECRET"], "different-existing-signing-value")
        self.assertEqual(api.values["UNRELATED_SECRET"], "unrelated-existing-value")

    def test_cloudflare_put_200_remains_compatible(self):
        env = environment()
        api = FakeAPI(env)
        api.write_status = 200
        receipt = module.execute(env, api)
        self.assertEqual(receipt["status"], "CONFIGURED_AND_BEARER_VERIFIED")
        self.assertEqual(receipt["secrets_added"], list(module.SECRET_NAMES))

    def test_mismatched_existing_bearer_prevents_every_secret_write(self):
        env = environment()
        api = FakeAPI(env)
        api.add_existing("BRIDGE_TOKEN", "different-existing-bearer-value")
        receipt = module.execute(env, api)
        self.assertEqual(receipt["status"], "BLOCKED")
        self.assertEqual(receipt["error_code"], "authenticated_mcp_http_failed")
        self.assertEqual(receipt["secret_writes_attempted"], [])
        self.assertEqual(receipt["secrets_added"], [])
        self.assertFalse(any(m == "PUT" for m, _, _ in api.calls))
        self.assertEqual(api.values, {"BRIDGE_TOKEN": "different-existing-bearer-value"})

    def test_matching_existing_bearer_is_checked_before_missing_secrets_are_added(self):
        env = environment()
        api = FakeAPI(env)
        api.add_existing("BRIDGE_TOKEN", env["BRIDGE_TOKEN"])
        receipt = module.execute(env, api)
        self.assertEqual(receipt["status"], "CONFIGURED_AND_BEARER_VERIFIED")
        self.assertTrue(receipt["checks"]["existing_bearer_authenticated"])
        first_write = next(i for i, (m, _, _) in enumerate(api.calls) if m == "PUT")
        preflight_tools = [b["params"]["name"] for _, _, b in api.calls[:first_write]
                           if isinstance(b, dict) and b.get("method") == "tools/call"]
        self.assertEqual(preflight_tools, ["bridge_status"])
        self.assertEqual(receipt["secrets_added"], [name for name in module.SECRET_NAMES if name != "BRIDGE_TOKEN"])

    def test_cloudflare_success_codes_are_method_specific(self):
        env = environment()
        class StatusAPI:
            def __init__(self, status):
                self.status = status
            def request(self, method, url, headers, body=None):
                return reply({"success": True, "result": {}}, status=self.status)
        for method, status in (("GET", 201), ("GET", 204), ("PUT", 202), ("PUT", 204), ("POST", 200)):
            with self.subTest(method=method, status=status):
                provisioner = module.Provisioner(env, StatusAPI(status), module.initial_receipt(env))
                with self.assertRaisesRegex(module.Blocked, "cloudflare_request_failed"):
                    provisioner.cloudflare("/secrets", method)

    def test_repeated_run_performs_no_secret_writes(self):
        env = environment()
        api = FakeAPI(env)
        self.assertEqual(module.execute(env, api)["status"], "CONFIGURED_AND_BEARER_VERIFIED")
        api.calls.clear()
        receipt = module.execute(env, api)
        self.assertEqual(receipt["status"], "CONFIGURED_AND_BEARER_VERIFIED")
        self.assertFalse(any(m == "PUT" for m, _, _ in api.calls))
        self.assertEqual(receipt["existing_secrets_preserved"], list(module.SECRET_NAMES))

    def test_wrong_main_or_event_or_missing_secret_prevents_every_network_call(self):
        for key, value in (("GITHUB_REF", "refs/heads/untrusted"), ("GITHUB_EVENT_NAME", "pull_request"),
                           ("GITHUB_REPOSITORY", "someone/else"), ("ELEVENLABS_API_KEY", ""),
                           ("CHATGPT_SETUP_CODE", "short"), ("ALLOW_PAID_AI", "true")):
            with self.subTest(key=key):
                env = environment()
                env[key] = value
                api = FakeAPI(env)
                self.assertEqual(module.execute(env, api)["status"], "BLOCKED")
                self.assertEqual(api.calls, [])

    def test_wrong_namespace_or_plaintext_secret_conflict_prevents_writes(self):
        for conflict in ("namespace", "binding_type"):
            with self.subTest(conflict=conflict):
                env = environment()
                api = FakeAPI(env)
                if conflict == "namespace":
                    api.bindings[0]["namespace_id"] = "0" * 32
                else:
                    api.bindings.append({"name": "BRIDGE_TOKEN", "type": "plain_text", "text": "unsafe-old-value"})
                self.assertEqual(module.execute(env, api)["status"], "BLOCKED")
                self.assertFalse(any(m == "PUT" for m, _, _ in api.calls))

    def test_cloudflare_failure_has_no_raw_body_and_is_not_retried(self):
        env = environment()
        api = FakeAPI(env)
        api.write_failure = True
        receipt = module.execute(env, api)
        self.assertEqual(receipt["error_code"], "cloudflare_request_failed")
        self.assertEqual(len([m for m, _, _ in api.calls if m == "PUT"]), 1)
        self.assertNotIn(env["ELEVENLABS_API_KEY"], json.dumps(receipt))

    def test_binding_drift_aborts_remaining_writes(self):
        env = environment()
        api = FakeAPI(env)
        api.corrupt_binding_after_write = True
        receipt = module.execute(env, api)
        self.assertEqual(receipt["status"], "BLOCKED")
        self.assertEqual(len([m for m, _, _ in api.calls if m == "PUT"]), 1)

    def test_provider_error_body_and_private_voice_data_are_not_in_receipt(self):
        env = environment()
        api = FakeAPI(env)
        api.provider_error = True
        receipt = module.execute(env, api)
        self.assertEqual(receipt["error_code"], "mcp_tool_failed")
        self.assertNotIn(env["ELEVENLABS_API_KEY"], json.dumps(receipt))
        self.assertNotIn("private-voice-id", json.dumps(receipt))

    def test_unauthenticated_success_cannot_be_accepted(self):
        env = environment()
        api = FakeAPI(env)
        api.allow_unauthorized = True
        receipt = module.execute(env, api)
        self.assertEqual(receipt["error_code"], "unauthorized_mcp_access_not_rejected")

    def test_sse_mcp_response_is_supported(self):
        env = environment()
        api = FakeAPI(env)
        api.stream = True
        self.assertEqual(module.execute(env, api)["status"], "CONFIGURED_AND_BEARER_VERIFIED")

    def test_other_hosts_workers_methods_and_generation_tools_rejected(self):
        env = environment()
        http = module.SafeHTTP(env["CLOUDFLARE_ACCOUNT_ID"])
        for method, url in (("PUT", module.ORIGIN + "/mcp"), ("GET", "https://evil.example/"),
                            ("PUT", "https://api.cloudflare.com/client/v4/accounts/" + "b" * 32 + "/workers/scripts/other-worker/secrets"),
                            ("PATCH", "https://api.cloudflare.com/client/v4/accounts/" + "b" * 32 + "/workers/scripts/nicholas-ai-os/settings")):
            with self.subTest(url=url), self.assertRaises(module.Blocked):
                http.request(method, url, {})
        api = FakeAPI(env)
        provisioner = module.Provisioner(env, api, module.initial_receipt(env))
        for name in ("create_speech", "preview_speech", "create_video", "speech_to_text", "upload_asset_base64"):
            with self.subTest(name=name), self.assertRaises(module.Blocked):
                provisioner.rpc(9, "tools/call", {"name": name, "arguments": {}})
        self.assertEqual(api.calls, [])

    def test_redirects_cannot_forward_secrets_or_become_success(self):
        env = environment()
        http = module.SafeHTTP(env["CLOUDFLARE_ACCOUNT_ID"])
        self.assertIsNone(module.NoRedirect().redirect_request(None, None, 302, "", {}, "https://evil.example/"))
        class RedirectingOpener:
            def open(self, request, timeout):
                raise urllib.error.HTTPError(request.full_url, 302, "redirect", {"Location": "https://evil.example/"}, io.BytesIO(b"private"))
        http.opener = RedirectingOpener()
        with self.assertRaisesRegex(module.Blocked, "redirect_rejected"):
            http.request("GET", module.ORIGIN + "/health", {"Authorization": "secret"})

    def test_workflow_is_manual_main_only_and_artifact_is_receipt_only(self):
        workflow = HELPER.parents[1] / ".github" / "workflows" / "provision-elevenlabs-bridge.yml"
        text = workflow.read_text()
        trigger = text.split("on:\n", 1)[1].split("\npermissions:", 1)[0]
        self.assertEqual(trigger.strip(), "workflow_dispatch:")
        self.assertIn("github.ref == 'refs/heads/main'", text)
        self.assertIn("environment: elevenlabs-bridge-production", text)
        self.assertIn("persist-credentials: false", text)
        self.assertNotIn("contents: write", text)
        self.assertNotIn("continue-on-error", text)
        self.assertIn("path: ${{ runner.temp }}/elevenlabs-bridge-verification/receipt.json", text)
        self.assertLess(text.index("Verify provisioning safety"), text.index("ELEVENLABS_API_KEY: ${{ secrets.ELEVENLABS_API_KEY }}"))


if __name__ == "__main__":
    unittest.main()
