"""HTTP adapter and live-verification contract tests on synthetic data."""
import hashlib
import http.client
import io
from http.server import ThreadingHTTPServer
import importlib.util
import json
import os
import pathlib
import sys
import tempfile
import threading
import unittest
from contextlib import redirect_stdout
from unittest import mock

BASE = pathlib.Path(__file__).resolve().parents[1] / "services/osint-forensics"
sys.path.insert(0, str(BASE))
import verify_cloudflare

spec = importlib.util.spec_from_file_location("argus_http", BASE / "http_server.py")
service = importlib.util.module_from_spec(spec)
spec.loader.exec_module(service)


class TestPrivateAdapter(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.http = ThreadingHTTPServer(("127.0.0.1", 0), service.Handler)
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()

    def make_request(self, data=service.TEST_PNG, mime="image/png", extra=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.http.server_port, timeout=5)
        headers = {"content-type": mime}
        if extra:
            headers.update(extra)
        conn.request("POST", "/analyze", body=data, headers=headers)
        response = conn.getresponse()
        obj = json.loads(response.read())
        status = response.status
        conn.close()
        return status, obj

    def test_content_type_gate(self):
        status, payload = self.make_request(mime="text/plain")
        self.assertEqual(status, 415)
        self.assertEqual(payload["error"], "unsupported_media_type")

    def test_invalid_size(self):
        status, _ = self.make_request(data=b"")
        self.assertEqual(status, 413)

    def test_processing_and_hash(self):
        with mock.patch.object(service, "analyze_file", return_value={"schema":"argus-image-osint-v1"}) as analyzer:
            status, body = self.make_request()
        self.assertEqual(status, 200)
        self.assertEqual(body["schema"], "argus-image-osint-v1")
        self.assertEqual(analyzer.call_args.kwargs["include_sensitive"], False)

    def test_sensitive_requires_header(self):
        with mock.patch.object(service, "analyze_file", return_value={"ok":True}) as analyzer:
            status, _ = self.make_request(extra={"X-Argus-Sensitive":"1"})
        self.assertEqual(status, 200)
        self.assertTrue(analyzer.call_args.kwargs["include_sensitive"])

    def test_failure_does_not_leak_paths(self):
        with mock.patch.object(service, "analyze_file", side_effect=OSError("/private/secret/path")):
            status, result = self.make_request()
        self.assertEqual(status, 422)
        self.assertNotIn("secret", json.dumps(result))


class TestWorkerVerification(unittest.TestCase):
    url = "https://argus.example"

    def test_disabled_worker_sends_no_upload(self):
        with mock.patch.object(verify_cloudflare, "request_json", return_value=(
            200, {"service": "argus-prime-forensics", "enabled": False}
        )) as request:
            with self.assertRaisesRegex(verify_cloudflare.VerificationError, "enabled=false"):
                verify_cloudflare.verify_worker(self.url, "t" * 32)
        self.assertEqual(request.call_count, 1)

    def test_receipt_requires_correct_hash_and_exiftool_output(self):
        fixture = service.TEST_PNG
        digest = hashlib.sha256(fixture).hexdigest()
        report = {"schema": "argus-image-osint-v1", "source_sha256": digest,
                  "source_bytes": len(fixture), "sensitive_metadata_included": False,
                  "tools": {"exiftool": {"status": "ok", "metadata": {
                      "File:FileType": "PNG", "File:MIMEType": "image/png",
                      "PNG:ImageWidth": 1, "PNG:ImageHeight": 1}}}}
        for analysis, should_pass in ((report, True), ({**report, "source_sha256": "incorrect"}, False)):
            with self.subTest(should_pass=should_pass), mock.patch.object(
                verify_cloudflare, "request_json", side_effect=[
                    (200, {"service": "argus-prime-forensics", "enabled": True}),
                    (401, {"error": "unauthorized"}),
                    (200, analysis),
                ]
            ) as request:
                if should_pass:
                    result = verify_cloudflare.verify_worker(self.url, "t" * 32)
                    self.assertEqual(result["source_sha256"], digest)
                    self.assertEqual(result["authenticated_http"], 200)
                    self.assertEqual(result["exiftool"]["FileType"], "PNG")
                    self.assertNotIn("key", request.call_args_list[1].kwargs)
                    self.assertEqual(request.call_args.kwargs["image"], fixture)
                else:
                    with self.assertRaisesRegex(verify_cloudflare.VerificationError, "integrity"):
                        verify_cloudflare.verify_worker(self.url, "t" * 32)


class TestSanitizedVerificationReceipt(unittest.TestCase):
    env = {
        "GITHUB_REPOSITORY": "2strongtrainers-art/Nicholas-AI-OS",
        "GITHUB_REF": "refs/heads/main", "GITHUB_EVENT_NAME": "workflow_dispatch",
        "GITHUB_WORKFLOW_REF": "2strongtrainers-art/Nicholas-AI-OS/.github/workflows/deploy-argus-private-forensics.yml@refs/heads/main",
        "GITHUB_RUN_ID": "123456789", "GITHUB_RUN_ATTEMPT": "2", "GITHUB_SHA": "a" * 40,
    }

    def run_main(self, error=None, extra=None):
        with tempfile.TemporaryDirectory() as folder:
            receipt = pathlib.Path(folder) / "receipt.json"
            summary = pathlib.Path(folder) / "summary.md"
            env = {**self.env, "ARGUS_RECEIPT_PATH": str(receipt), "GITHUB_STEP_SUMMARY": str(summary),
                   "ARGUS_FORENSICS_API_KEY": "synthetic-sensitive-marker-" * 2, **(extra or {})}
            output = io.StringIO()
            with mock.patch.dict(os.environ, env, clear=True), redirect_stdout(output), mock.patch.object(
                verify_cloudflare, "verify_worker", side_effect=error, return_value={"status": "ARGUS_SYNTHETIC_PASS"}
            ) as worker:
                code = verify_cloudflare.main()
            return code, json.loads(receipt.read_text()), output.getvalue() + summary.read_text(), worker.call_count

    def test_pass_preserves_exact_run_identity_and_only_known_synthetic_evidence(self):
        code, receipt, output, count = self.run_main()
        self.assertEqual((code, count), (0, 1))
        self.assertEqual(receipt["status"], "ARGUS_SYNTHETIC_PASS")
        self.assertEqual(receipt["github"]["run_id"], "123456789")
        self.assertEqual(receipt["github"]["run_attempt"], 2)
        self.assertEqual(receipt["github"]["head_sha"], "a" * 40)
        self.assertEqual(receipt["evidence"]["source_sha256"], hashlib.sha256(service.TEST_PNG).hexdigest())
        self.assertNotIn("synthetic-sensitive-marker", output)

    def test_disabled_worker_saves_blocked_receipt_with_no_evidence(self):
        code, receipt, output, _ = self.run_main(verify_cloudflare.VerificationError("worker_not_configured"))
        self.assertEqual(code, 1)
        self.assertEqual(receipt["status"], "ARGUS_VERIFICATION_BLOCKED")
        self.assertEqual(receipt["failure_code"], "worker_not_configured")
        self.assertIsNone(receipt["evidence"])
        self.assertNotIn("synthetic-sensitive-marker", output)

    def test_earlier_failure_prevents_network_verification_but_keeps_receipt(self):
        code, receipt, _, count = self.run_main(extra={"ARGUS_PREREQUISITES_PASSED": "false"})
        self.assertEqual((code, count), (1, 0))
        self.assertEqual(receipt["failure_code"], "prerequisite_failed")

    def test_exception_messages_and_invalid_provenance_are_never_reflected(self):
        for error in (OSError("synthetic-sensitive-marker"), RuntimeError("synthetic-sensitive-marker"),
                      verify_cloudflare.VerificationError("synthetic-sensitive-marker")):
            code, receipt, output, _ = self.run_main(error, {"GITHUB_RUN_ID": "synthetic-sensitive-marker"})
            self.assertEqual(code, 1)
            self.assertEqual(receipt["status"], "ARGUS_VERIFICATION_FAILED")
            self.assertIsNone(receipt["github"])
            self.assertNotIn("synthetic-sensitive-marker", output)

    def test_fixed_inputs_produce_identical_receipts(self):
        first = verify_cloudflare.verification_receipt(failure_code=None, env=self.env, observed_at="2026-11-15T18:00:00+00:00")
        second = verify_cloudflare.verification_receipt(failure_code=None, env=self.env, observed_at="2026-11-15T18:00:00+00:00")
        self.assertEqual(json.dumps(first, sort_keys=True), json.dumps(second, sort_keys=True))


if __name__ == "__main__":
    unittest.main()
