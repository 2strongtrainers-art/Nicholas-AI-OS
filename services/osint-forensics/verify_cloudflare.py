"""Verify the existing ARGUS Worker with the shared synthetic PNG only."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import time
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from http_server import TEST_PNG


class VerificationError(RuntimeError):
    pass


class RejectRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def request_json(opener, url: str, *, image: bytes | None = None,
                 key: str = "") -> tuple[int, dict]:
    headers = {"Accept": "application/json", "User-Agent": "Nicholas-AI-OS-ARGUS-Verify/1.0"}
    if image is not None:
        headers["Content-Type"] = "image/png"
    if key:
        headers["Authorization"] = f"Bearer {key}"
    request = Request(url, data=image, headers=headers)
    try:
        response = opener.open(request, timeout=90 if key else 20)
    except HTTPError as error:
        response = error
    with response:
        status = response.code
        raw = response.read(1_048_577)
    if len(raw) > 1_048_576:
        raise VerificationError("Worker response exceeded the verification size limit")
    try:
        data = json.loads(raw)
    except (ValueError, UnicodeError):
        data = None
    return status, data if isinstance(data, dict) else {}


def verify_worker(url: str, key: str) -> dict:
    origin = urlsplit(url)
    if (origin.scheme != "https" or not origin.hostname or origin.username is not None
            or origin.path not in ("", "/") or origin.query or origin.fragment):
        raise VerificationError("ARGUS_FORENSICS_URL must be the HTTPS Worker origin")

    opener = build_opener(RejectRedirects)
    url = origin.geturl().rstrip("/")
    status, health = request_json(opener, f"{url}/health")
    if status != 200 or health.get("service") != "argus-prime-forensics":
        raise VerificationError(f"Worker health could not be verified (HTTP {status})")
    if health.get("enabled") is not True:
        raise VerificationError("Worker health reports enabled=false. Configure its encrypted ARGUS_FORENSICS_API_KEY")
    if not 32 <= len(key) <= 4089 or not key.isascii() or not key.isprintable():
        raise VerificationError("The GitHub environment is missing a usable ARGUS_FORENSICS_API_KEY")

    endpoint = f"{url}/analyze"
    status, denial = request_json(opener, endpoint, image=b"")
    if status != 401 or denial.get("error") != "unauthorized":
        raise VerificationError(f"Expected the ARGUS unauthorized response (HTTP 401), got HTTP {status}")

    for attempt in range(3):
        if attempt:
            time.sleep(5)
        status, report = request_json(opener, endpoint, image=TEST_PNG, key=key)
        if status != 503 or report.get("error") != "forensic_container_unavailable":
            break
    if status != 200:
        raise VerificationError(f"Authenticated synthetic analysis returned HTTP {status}")

    digest = hashlib.sha256(TEST_PNG).hexdigest()
    if (report.get("schema") != "argus-image-osint-v1"
            or report.get("source_sha256") != digest
            or report.get("source_bytes") != len(TEST_PNG)
            or report.get("sensitive_metadata_included") is not False):
        raise VerificationError("Synthetic integrity or privacy check failed")

    tools = report.get("tools", {})
    exif = tools.get("exiftool", {}) if isinstance(tools, dict) else {}
    if not isinstance(exif, dict) or exif.get("status") != "ok" or not isinstance(exif.get("metadata"), dict):
        raise VerificationError("Worker did not return successful ExifTool metadata")
    tags = {name.rsplit(":", 1)[-1]: value for name, value in exif["metadata"].items()}
    expected = {"FileType": "PNG", "MIMEType": "image/png", "ImageWidth": 1, "ImageHeight": 1}
    if any(tags.get(name) != value for name, value in expected.items()):
        raise VerificationError("ExifTool did not identify the expected 1 × 1 PNG")

    return {"status": "ARGUS_SYNTHETIC_PASS", "source_sha256": digest,
            "source_bytes": len(TEST_PNG), "unauthenticated_http": 401,
            "authenticated_http": 200, "exiftool": expected,
            "sensitive_metadata_included": False}


def main() -> int:
    try:
        receipt = verify_worker(os.environ.get("ARGUS_FORENSICS_URL", ""),
                                os.environ.get("ARGUS_FORENSICS_API_KEY", ""))
    except VerificationError as error:
        print(f"ARGUS verification blocked: {error}")
        return 1
    except (OSError, ValueError):
        print("ARGUS verification blocked: Worker request failed")
        return 1

    result = json.dumps(receipt, sort_keys=True)
    print(result)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with Path(summary).open("a", encoding="utf-8") as file:
            file.write(f"### ARGUS authenticated synthetic PNG\n\n~~~json\n{result}\n~~~\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
