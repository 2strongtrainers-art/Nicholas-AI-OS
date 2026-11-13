import contextlib
import io
import json
import os
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
        with (
            patch.dict(os.environ, {"ALLOW_PAID_AI": "true"}),
            patch.object(council.urllib.request, "urlopen", side_effect=error) as upstream,
        ):
            result = council.ask_model("https://switchboard.example", "fake-key", "ox", "Review", "Evidence")
        self.assertEqual(result, body)
        upstream.assert_called_once()

    def test_paid_review_is_blocked_by_default_and_explicit_false(self):
        for env in ({}, {"ALLOW_PAID_AI": "false"}):
            with (
                self.subTest(env=env),
                patch.dict(os.environ, env, clear=True),
                patch.object(council, "request_json") as request,
                patch.object(council, "switchboard_key") as key,
                patch.object(council.sys, "argv", ["council"]),
                contextlib.redirect_stdout(io.StringIO()),
            ):
                self.assertEqual(council.main(), 2)
                review = council.ask_model("https://switchboard.example", "fake-key", "ox", "Review", "Evidence")
                self.assertEqual(review["error_code"], "paid_ai_disabled")
                request.assert_not_called()
                key.assert_not_called()

    def test_each_review_uses_the_1500_token_limit(self):
        with (
            patch.dict(os.environ, {"ALLOW_PAID_AI": "true"}),
            patch.object(council, "request_json", return_value={"ok": True}) as request,
        ):
            for alias in ("ox", "qwen"):
                council.ask_model("https://switchboard.example", "fake-key", alias, "Review", "Evidence")
                self.assertEqual(request.call_args.args[2]["model"], alias)
                self.assertEqual(request.call_args.args[2]["max_tokens"], 1500)

    def test_shared_evidence_and_hermes_request_are_bounded(self):
        report = {"build_evidence": "a" * 15000}
        hermes = {"result": "b" * 35000}
        focus = "c" * 800
        brief = council.build_shared_brief(report, hermes, focus)
        self.assertLess(len(brief), 9000)
        self.assertEqual(brief.count("[Excerpt truncated]"), 3)
        self.assertIn("up to three findings", brief)
        with (
            patch.object(council, "request_json", side_effect=[{"job": {"id": "fake"}}, {"job": {"status": "completed"}}]) as request,
            patch.object(council, "kick_hermes_worker"),
            contextlib.redirect_stdout(io.StringIO()),
        ):
            council.run_hermes("https://switchboard.example", "fake-key", report, focus, 1200)
        task = request.call_args_list[0].args[2]["task"]
        self.assertLess(len(task.encode("utf-16-le")) // 2, 12000)
        self.assertIn("up to three findings", task)

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
                    patch.dict(os.environ, {"ALLOW_PAID_AI": "true"}),
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
