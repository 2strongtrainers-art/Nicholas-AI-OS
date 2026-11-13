import json
import os
import unittest
from pathlib import Path
from unittest.mock import patch

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

    def test_uploads_verified_bindings_then_moves_traffic(self):
        for fail_verification in [False, True]:
            with self.subTest(fail_verification=fail_verification):
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
                        live = args[2].split("@")[0]
                    else:
                        self.fail(f"Unexpected command {args[:2]}")
                    changes.append(args[:2])

                outcome = RuntimeError("Live verification failed") if fail_verification else None
                with (
                    patch.dict(os.environ, ENV, clear=True),
                    patch.object(deploy, "wrangler", side_effect=wrangler),
                    patch.object(deploy, "verify_live", side_effect=outcome) as smoke,
                ):
                    if fail_verification:
                        with self.assertRaisesRegex(RuntimeError, "Live verification failed"):
                            deploy.main()
                    else:
                        deploy.main()
                smoke.assert_called_once_with(True)
                expected = [("versions", "upload"), ("versions", "deploy")]
                if fail_verification:
                    expected.append(("versions", "deploy"))
                self.assertEqual(changes, expected)
                self.assertEqual(live, CURRENT if fail_verification else CANDIDATE)

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
