import contextlib
import io
import json
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch

from scripts import run_atlas_ai_council as council


class CouncilReviewTests(unittest.TestCase):
    def test_credit_error_keeps_structured_limit_for_the_caller(self):
        body = {"ok": False, "limit_source": "openrouter_key_limit", "retry_after": "12"}
        error = urllib.error.HTTPError(
            "https://switchboard.example/ask", 402, "Credit limit", {},
            io.BytesIO(json.dumps(body).encode()),
        )
        with patch.object(council.urllib.request, "urlopen", side_effect=error) as upstream:
            result = council.ask_model("https://switchboard.example", "fake-key", "ox", "Review", "Evidence")
        self.assertEqual(result, body)
        upstream.assert_called_once()

    def test_incomplete_council_saves_evidence_and_avoids_a_known_blocked_call(self):
        qwen = {"ok": True, "response_model": "qwen/test", "text": "Verified finding", "cost_usd": 0.002}
        for ox, expected_calls, expected_text in [
            ({"ok": True, "text": "One partial finding", "truncated": True}, 2, "Status: partial"),
            ({"ok": False, "limit_source": "openrouter_key_limit"}, 1, "Status: skipped"),
        ]:
            with self.subTest(ox=ox), tempfile.TemporaryDirectory() as directory:
                output = Path(directory) / "council.json"
                markdown = Path(directory) / "council.md"
                argv = ["council", "--output", str(output), "--markdown", str(markdown)]
                with (
                    patch.object(council.sys, "argv", argv),
                    patch.object(council, "switchboard_url", return_value="https://switchboard.example"),
                    patch.object(council, "switchboard_key", return_value="fake-switchboard-key"),
                    patch.object(council, "hermes_worker_key", return_value="fake-hermes-key"),
                    patch.object(council, "fetch_live_report", return_value={"status": "ok"}),
                    patch.object(council, "request_json", return_value={"ok": True, "ox": "glm/test", "qwen": "qwen/test"}),
                    patch.object(council, "run_hermes", return_value={"status": "completed", "result": "Public evidence"}),
                    patch.object(council, "ask_model", side_effect=[ox, qwen]) as ask,
                    contextlib.redirect_stdout(io.StringIO()),
                ):
                    self.assertEqual(council.main(), 1)
                packet = json.loads(output.read_text())
                self.assertEqual(packet["status"], "incomplete")
                self.assertEqual(packet["ox"], ox)
                self.assertEqual(ask.call_count, expected_calls)
                self.assertIn(expected_text, markdown.read_text())
                if expected_calls == 2:
                    self.assertEqual(packet["qwen"], qwen)
                    self.assertIn("$0.002000", markdown.read_text())
                    self.assertEqual(ask.call_args_list[0].args[4], ask.call_args_list[1].args[4])
