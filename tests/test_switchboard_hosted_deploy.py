import json
import os
import subprocess
import unittest
from pathlib import Path
from unittest.mock import call, patch

from scripts import deploy_switchboard_hosted as deploy

CURRENT = "12345678-1234-1234-1234-123456789abc"
CANDIDATE = "23456789-1234-1234-1234-123456789abc"
SHA = "a" * 40
ENV = {
    "GITHUB_REF": "refs/heads/main", "GITHUB_SHA": SHA,
    "CLOUDFLARE_ACCOUNT_ID": "a" * 32, "CLOUDFLARE_API_TOKEN": "test-only",
}
CURRENT_BINDINGS = [
    {"name": "SWITCHBOARD_API_KEY", "type": "secret_text"},
    {"name": "OPENROUTER_API_KEY", "type": "secret_text"},
    {"name": "ALLOW_PAID_AI", "type": "plain_text", "text": "false"},
    {"name": "OX_MODEL", "type": "plain_text", "text": "z-ai/owner-pin"},
    {"name": "HERMES_JOBS", "type": "kv_namespace", "namespace_id": "c" * 32},
]
STAGED_BINDINGS = CURRENT_BINDINGS + [
    {"name": "QWEN_MODEL", "type": "plain_text", "text": "qwen/qwen3.8-2.4t-a95b"},
]


def version(version_id, bindings, tag=None):
    return {"id": version_id, "resources": {"bindings": bindings}, "annotations": {"workers/tag": tag}}


class HostedDeploymentTests(unittest.TestCase):
    def test_requires_trusted_main_and_connection_before_any_provider_call(self):
        for env in [{}, {**ENV, "GITHUB_REF": "refs/heads/test"}, {**ENV, "CLOUDFLARE_API_TOKEN": ""}]:
            with patch.dict(os.environ, env, clear=True), patch.object(deploy, "wrangler") as provider:
                with self.assertRaises(RuntimeError):
                    deploy.main()
                provider.assert_not_called()

    def test_uploads_verified_bindings_and_recovers_a_failed_promotion(self):
        for failure in (None, "verification", "before promotion", "after promotion"):
            with self.subTest(failure=failure):
                live = CURRENT
                changes = []

                def wrangler(*args, output_path=None):
                    nonlocal live
                    if args[:2] == ("deployments", "status"):
                        return json.dumps({"id": live, "versions": [{"version_id": live, "percentage": 100}]})
                    if args[:2] == ("versions", "view"):
                        if args[2] == CURRENT:
                            return json.dumps(version(CURRENT, CURRENT_BINDINGS))
                        return json.dumps(version(CANDIDATE, STAGED_BINDINGS, SHA))
                    if args[:2] == ("versions", "list"):
                        return json.dumps([{"id": "older"}, {"id": CURRENT}])
                    if args[:2] == ("versions", "upload"):
                        config = json.loads(Path(args[args.index("--config") + 1]).read_text())
                        self.assertEqual(config["vars"], {"QWEN_MODEL": "qwen/qwen3.8-2.4t-a95b"})
                        self.assertEqual(config["kv_namespaces"], [{"binding": "HERMES_JOBS", "id": "c" * 32}])
                        self.assertIn("--keep-vars", args)
                        output_path.write_text(json.dumps({"type": "version-upload", "version_id": CANDIDATE}) + "\n")
                    elif args[:2] == ("versions", "deploy"):
                        changes.append(args[:2])
                        if args[2] == f"{CANDIDATE}@100%" and failure == "before promotion":
                            raise RuntimeError("Promotion rejected")
                        live = args[2].split("@")[0]
                        if live == CANDIDATE and failure == "after promotion":
                            raise subprocess.TimeoutExpired("wrangler versions deploy", 150)
                        return ""
                    else:
                        self.fail(f"Unexpected command {args[:2]}")
                    changes.append(args[:2])

                outcome = RuntimeError("Live verification failed") if failure == "verification" else None
                with (
                    patch.dict(os.environ, ENV, clear=True),
                    patch.object(deploy, "wrangler", side_effect=wrangler),
                    patch.object(deploy, "verify_live", side_effect=outcome) as smoke,
                ):
                    if failure == "verification":
                        with self.assertRaisesRegex(RuntimeError, "Live verification failed"):
                            deploy.main()
                    elif failure == "before promotion":
                        with self.assertRaisesRegex(RuntimeError, "Promotion rejected"):
                            deploy.main()
                    elif failure == "after promotion":
                        with self.assertRaises(subprocess.TimeoutExpired):
                            deploy.main()
                    else:
                        deploy.main()
                if failure in {"before promotion", "after promotion"}:
                    smoke.assert_not_called()
                else:
                    smoke.assert_called_once_with(True)
                expected = [("versions", "upload"), ("versions", "deploy")]
                if failure in {"verification", "after promotion"}:
                    expected.append(("versions", "deploy"))
                self.assertEqual(changes, expected)
                self.assertEqual(live, CURRENT if failure else CANDIDATE)

    def test_rollback_leaves_a_different_active_version_in_place(self):
        with (
            patch.object(deploy, "active_version", return_value=("another-deployment", "other-version")),
            patch.object(deploy, "wrangler") as provider,
        ):
            deploy.restore_previous_if_active(CANDIDATE, CURRENT)
        provider.assert_not_called()

    def test_rollback_requires_cloudflare_to_confirm_previous_version(self):
        with (
            patch.object(deploy, "active_version", return_value=("deployment", CANDIDATE)),
            patch.object(deploy, "wrangler", side_effect=RuntimeError("Rollback failed")),
        ):
            with self.assertRaisesRegex(RuntimeError, "Could not verify rollback"):
                deploy.restore_previous_if_active(CANDIDATE, CURRENT)

    def test_live_verification_checks_schema_and_auth_without_inference(self):
        properties = {
            "model": {"enum": ["ox", "qwen", "auto", "free", "qwen-flash"]},
            "max_tokens": {"default": 1500},
        }
        ask = {
            "operationId": "switchboardAsk",
            "requestBody": {"content": {"application/json": {"schema": {"properties": properties}}}},
        }
        health = json.dumps({"ok": True, "atlas": True, "tool_routing": True, "hermes_jobs": False})
        schema = json.dumps({"paths": {"/ask": {"post": ask}}})
        with patch.object(deploy, "public_get", side_effect=[(200, health), (200, schema), (401, "")]) as get:
            deploy.verify_live(False)
        self.assertEqual(get.call_args_list, [call("/health"), call("/openapi.json"), call("/models")])

    def test_staged_candidate_that_changes_the_spending_guard_cannot_deploy(self):
        changed = [row for row in STAGED_BINDINGS if row["name"] != "ALLOW_PAID_AI"]
        responses = [
            json.dumps({"id": CURRENT, "versions": [{"version_id": CURRENT, "percentage": 100}]}),
            json.dumps(version(CURRENT, CURRENT_BINDINGS)),
            json.dumps([{"id": CURRENT}, {"id": CANDIDATE, "annotations": {"workers/tag": SHA}}]),
            json.dumps(version(CANDIDATE, changed, SHA)),
        ]
        with (
            patch.dict(os.environ, ENV, clear=True),
            patch.object(deploy, "wrangler", side_effect=responses) as provider,
            patch.object(deploy, "verify_live") as smoke,
        ):
            with self.assertRaisesRegex(RuntimeError, "No traffic was moved"):
                deploy.main()
        self.assertEqual(provider.call_count, 4)
        smoke.assert_not_called()

    def test_unknown_binding_and_missing_secret_fail_closed(self):
        for rows in [
            CURRENT_BINDINGS + [{"name": "STORE", "type": "r2_bucket"}],
            CURRENT_BINDINGS[1:],
        ]:
            with self.assertRaises(ValueError):
                deploy.bindings(version(CURRENT, rows))
