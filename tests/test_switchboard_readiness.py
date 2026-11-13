import contextlib
import io
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import call, patch

from scripts import check_switchboard_readiness as readiness


def response_set(token_limit=1500, aliases=None, queue_bound=True):
    if aliases is None:
        aliases = ["ox", "qwen", "auto", "free", "qwen-flash"]
    health = {"ok": True, "atlas": True, "tool_routing": True, "hermes_jobs": queue_bound}
    fields = {"max_tokens": {"default": token_limit}, "model": {"enum": aliases}}
    ask = {
        "operationId": "switchboardAsk",
        "requestBody": {"content": {"application/json": {"schema": {"properties": fields}}}},
    }
    return [(200, json.dumps(health)), (200, json.dumps({"paths": {"/ask": {"post": ask}}})), (401, "")]


class SwitchboardReadinessTests(unittest.TestCase):
    def test_known_legacy_contract_is_pending(self):
        with patch.object(readiness, "public_get", side_effect=response_set(6000, ["ox", "qwen", "auto"], False)) as get:
            report = readiness.check_switchboard()
        self.assertEqual(report["status"], "release_pending")
        self.assertTrue(report["service_healthy"])
        self.assertEqual(report["output_token_default"], 6000)
        self.assertEqual(report["hermes"], {"queue_bound": False, "runner_status": "unverified"})
        self.assertEqual(get.call_args_list, [call("/health"), call("/openapi.json"), call("/models")])

    def test_current_contract_does_not_treat_a_bound_queue_as_a_runner(self):
        with patch.object(readiness, "public_get", side_effect=response_set()):
            report = readiness.check_switchboard()
        self.assertEqual(report["status"], "verified")
        self.assertEqual(report["output_token_default"], 1500)
        self.assertEqual(report["hermes"], {"queue_bound": True, "runner_status": "unverified"})

    def test_unexpected_contract_authentication_and_outage_fail(self):
        ready = response_set()
        cases = [
            (response_set(1500, ["ox", "qwen", "auto"]), "/openapi.json differs"),
            ([*ready[:2], (200, "private model result")], "/models returned HTTP 200"),
            ([(503, "upstream error"), *ready[1:]], "/health returned HTTP 503"),
            ([subprocess.TimeoutExpired("curl", 12), *ready[1:]], "/health request failed"),
            ([ready[0], (200, "invalid schema"), ready[2]], "/openapi.json returned invalid JSON"),
        ]
        for responses, expected in cases:
            with self.subTest(expected=expected), patch.object(readiness, "public_get", side_effect=responses):
                report = readiness.check_switchboard()
                self.assertEqual(report["status"], "failed")
                self.assertIn(expected, " ".join(report["errors"]))
                self.assertNotIn("private model result", json.dumps(report))

    def test_job_summary_and_exit_code_are_written_on_failure(self):
        responses = response_set()
        responses[-1] = (403, "blocked")
        with tempfile.TemporaryDirectory() as directory:
            summary = Path(directory) / "summary.md"
            out = io.StringIO()
            with (
                patch.dict(os.environ, {"GITHUB_STEP_SUMMARY": str(summary)}),
                patch.object(readiness, "public_get", side_effect=responses),
                contextlib.redirect_stdout(out),
            ):
                self.assertEqual(readiness.main(), 1)
            self.assertEqual(json.loads(out.getvalue())["http_status"]["/models"], 403)
            self.assertIn("Runner completion requires a separate job check.", summary.read_text())
