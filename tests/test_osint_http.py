"""HTTP adapter and live-verification contract tests on synthetic data."""
import hashlib
import http.client
from http.server import ThreadingHTTPServer
import importlib.util
import json
import pathlib
import sys
import threading
import unittest
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


if __name__ == "__main__":
    unittest.main()
