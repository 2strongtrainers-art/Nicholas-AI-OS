"""ARGUS forensic container private HTTP adapter; no externally exposed interface.

Public clients must go through an authenticated Cloudflare Worker. The worker
starts this container with enableInternet:false. This program never downloads
sources and does not preserve input or report bytes after the response.
"""
from __future__ import annotations

import base64
import hashlib
import http.client
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import tempfile
import threading

from analyze import analyze_file

MAX_BYTES = 25 * 1024 * 1024
MIME_EXT = {
    "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp",
    "image/tiff": ".tif", "image/heic": ".heic", "image/avif": ".avif",
    "video/mp4": ".mp4",
}
TEST_PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/zv8AAAAASUVORK5CYII=")


class Handler(BaseHTTPRequestHandler):
    server_version = "ArgusPrivate"
    sys_version = ""
    protocol_version = "HTTP/1.1"

    def log_message(self, *_args):
        # Evidence and client activity must not reach container/platform logs.
        return

    def respond(self, status, obj):
        data = json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/health":
            return self.respond(200, {"ready": True, "engine": "ARGUS-private-forensics"})
        return self.respond(404, {"error": "not_found"})

    def do_POST(self):
        if self.path != "/analyze":
            return self.respond(404, {"error": "not_found"})
        if self.headers.get("Transfer-Encoding"):
            return self.respond(400, {"error": "chunked_upload_not_supported"})
        value = self.headers.get("Content-Length", "")
        if not value.isdecimal():
            return self.respond(411, {"error": "content_length_required"})
        length = int(value)
        if not 0 < length <= MAX_BYTES:
            return self.respond(413, {"error": "invalid_evidence_size"})
        mime = self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
        ext = MIME_EXT.get(mime)
        if not ext:
            return self.respond(415, {"error": "unsupported_media_type"})
        try:
            data = self.rfile.read(length)
            if len(data) != length:
                return self.respond(400, {"error": "incomplete_upload"})
            with tempfile.TemporaryDirectory(prefix="argus-", dir="/tmp") as tmp:
                path = Path(tmp) / ("original" + ext)
                path.write_bytes(data)
                report = analyze_file(path, include_sensitive=(self.headers.get("X-Argus-Sensitive") == "1"))
            return self.respond(200, report)
        except (OSError, ValueError, RuntimeError):
            # Never send internal paths, parser output, or sensitive filenames to caller.
            return self.respond(422, {"error": "analysis_failed"})

    def do_PUT(self):
        self.respond(405, {"error": "method_not_allowed"})

    def do_DELETE(self):
        self.respond(405, {"error": "method_not_allowed"})


def self_test():
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        conn = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=15)
        conn.request("POST", "/analyze", TEST_PNG, {"Content-Type": "image/png"})
        result = conn.getresponse()
        data = json.loads(result.read())
        assert result.status == 200, data
        assert data["source_sha256"] == hashlib.sha256(TEST_PNG).hexdigest()
        assert data["tools"]["exiftool"]["status"] == "ok", data
        assert not data["sensitive_metadata_included"]
        conn.close()
        print("ARGUS synthetic offline HTTP smoke PASS")
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    import sys
    if "--self-test" in sys.argv:
        self_test()
    else:
        ThreadingHTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
