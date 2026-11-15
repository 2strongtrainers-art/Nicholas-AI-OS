"""HTTP edge-to-parser synthetic tests: no private evidence or external network."""
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


if __name__ == "__main__":
    unittest.main()
