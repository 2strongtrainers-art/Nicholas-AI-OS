"""Verify the existing ARGUS Worker with the shared synthetic PNG only."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import time
from datetime import datetime, timezone
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from http_server import TEST_PNG


REPOSITORY = "2strongtrainers-art/Nicholas-AI-OS"
WORKFLOW_PATH = ".github/workflows/deploy-argus-private-forensics.yml"
ERRORS = {
    "invalid_worker_origin": "ARGUS_FORENSICS_URL must be the HTTPS Worker origin",
    "health_unverified": "Worker health could not be verified",
    "worker_not_configured": "Worker health reports enabled=false. Configure its encrypted ARGUS_FORENSICS_API_KEY",
    "github_key_missing": "The GitHub environment is missing a usable ARGUS_FORENSICS_API_KEY",
    "unauthorized_check_failed": "The Worker did not return the expected unauthorized response (HTTP 401)",
    "authenticated_analysis_failed": "Authenticated synthetic analysis did not return HTTP 200",
    "synthetic_integrity_failed": "Synthetic integrity or privacy check failed",
    "exiftool_unverified": "Worker did not return successful ExifTool metadata",
    "exiftool_fixture_mismatch": "ExifTool did not identify the expected 1 x 1 PNG",
    "response_too_large": "Worker response exceeded the verification size limit",
    "worker_request_failed": "Worker request failed",
    "prerequisite_failed": "A preceding deployment step failed; verification did not run",
    "unexpected_verification_error": "Verification did not complete",
}
BLOCKED_CODES = {"invalid_worker_origin", "worker_not_configured", "github_key_missing", "prerequisite_failed"}


class VerificationError(RuntimeError):
    def __init__(self, code: str):
        self.code = code if code in ERRORS else "unexpected_verification_error"
        super().__init__(ERRORS[self.code])


def github_provenance(env: dict) -> dict | None:
    """Copy only validated public GitHub identifiers, never arbitrary env values."""
    run_id = env.get("GITHUB_RUN_ID", "")
    attempt = env.get("GITHUB_RUN_ATTEMPT", "")
    sha = env.get("GITHUB_SHA", "")
    if (env.get("GITHUB_REPOSITORY") != REPOSITORY
            or env.get("GITHUB_REF") != "refs/heads/main"
            or env.get("GITHUB_WORKFLOW_REF") != f"{REPOSITORY}/{WORKFLOW_PATH}@refs/heads/main"
            or env.get("GITHUB_EVENT_NAME") not in {"workflow_dispatch", "push"}
            or not re.fullmatch(r"[1-9][0-9]{0,15}", run_id)
            or not re.fullmatch(r"[1-9][0-9]{0,3}", attempt)
            or not re.fullmatch(r"[0-9a-f]{40}", sha)):
        return None
    return {"repository": REPOSITORY, "workflow_path": WORKFLOW_PATH,
            "run_id": run_id, "run_attempt": int(attempt), "head_sha": sha,
            "ref": "refs/heads/main", "event": env["GITHUB_EVENT_NAME"],
            "run_url": f"https://github.com/{REPOSITORY}/actions/runs/{run_id}/attempts/{int(attempt)}"}


def verification_receipt(*, failure_code: str | None, env: dict,
                         observed_at: str | None = None) -> dict:
    """A fixed projection: no key, input URL, raw metadata, or exception text."""
    code = failure_code if failure_code in ERRORS else "unexpected_verification_error"
    passed = failure_code is None
    return {
        "schema": "argus-verification-receipt-v1",
        "service": "argus-prime-forensics",
        "scope": "synthetic_only",
        "status": "ARGUS_SYNTHETIC_PASS" if passed else (
            "ARGUS_VERIFICATION_BLOCKED" if code in BLOCKED_CODES else "ARGUS_VERIFICATION_FAILED"),
        "failure_code": None if passed else code,
        "observed_at": observed_at or datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "github": github_provenance(env),
        "evidence": {
            "fixture_id": "argus-synthetic-png-v1", "source_bytes": len(TEST_PNG),
            "source_sha256": hashlib.sha256(TEST_PNG).hexdigest(),
            "unauthenticated_http": 401, "authenticated_http": 200,
            "exiftool": {"FileType": "PNG", "MIMEType": "image/png", "ImageWidth": 1, "ImageHeight": 1},
            "sensitive_metadata_included": False,
        } if passed else None,
    }


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
        raise VerificationError("response_too_large")
    try:
        data = json.loads(raw)
    except (ValueError, UnicodeError):
        data = None
    return status, data if isinstance(data, dict) else {}


def verify_worker(url: str, key: str) -> dict:
    origin = urlsplit(url)
    if (origin.scheme != "https" or not origin.hostname or origin.username is not None
            or origin.path not in ("", "/") or origin.query or origin.fragment):
        raise VerificationError("invalid_worker_origin")

    opener = build_opener(RejectRedirects)
    url = origin.geturl().rstrip("/")
    status, health = request_json(opener, f"{url}/health")
    if status != 200 or health.get("service") != "argus-prime-forensics":
        raise VerificationError("health_unverified")
    if health.get("enabled") is not True:
        raise VerificationError("worker_not_configured")
    if not 32 <= len(key) <= 4089 or not key.isascii() or not key.isprintable():
        raise VerificationError("github_key_missing")

    endpoint = f"{url}/analyze"
    status, denial = request_json(opener, endpoint, image=b"")
    if status != 401 or denial.get("error") != "unauthorized":
        raise VerificationError("unauthorized_check_failed")

    for attempt in range(3):
        if attempt:
            time.sleep(5)
        status, report = request_json(opener, endpoint, image=TEST_PNG, key=key)
        if status != 503 or report.get("error") != "forensic_container_unavailable":
            break
    if status != 200:
        raise VerificationError("authenticated_analysis_failed")

    digest = hashlib.sha256(TEST_PNG).hexdigest()
    if (report.get("schema") != "argus-image-osint-v1"
            or report.get("source_sha256") != digest
            or report.get("source_bytes") != len(TEST_PNG)
            or report.get("sensitive_metadata_included") is not False):
        raise VerificationError("synthetic_integrity_failed")

    tools = report.get("tools", {})
    exif = tools.get("exiftool", {}) if isinstance(tools, dict) else {}
    if not isinstance(exif, dict) or exif.get("status") != "ok" or not isinstance(exif.get("metadata"), dict):
        raise VerificationError("exiftool_unverified")
    tags = {name.rsplit(":", 1)[-1]: value for name, value in exif["metadata"].items()}
    expected = {"FileType": "PNG", "MIMEType": "image/png", "ImageWidth": 1, "ImageHeight": 1}
    if any(tags.get(name) != value for name, value in expected.items()):
        raise VerificationError("exiftool_fixture_mismatch")

    return {"status": "ARGUS_SYNTHETIC_PASS", "source_sha256": digest,
            "source_bytes": len(TEST_PNG), "unauthenticated_http": 401,
            "authenticated_http": 200, "exiftool": expected,
            "sensitive_metadata_included": False}


def main() -> int:
    failure_code = None
    try:
        if os.environ.get("ARGUS_PREREQUISITES_PASSED") == "false":
            raise VerificationError("prerequisite_failed")
        verify_worker(os.environ.get("ARGUS_FORENSICS_URL", ""),
                      os.environ.get("ARGUS_FORENSICS_API_KEY", ""))
    except VerificationError as error:
        failure_code = error.code
    except (OSError, ValueError):
        failure_code = "worker_request_failed"
    except Exception:
        # Never reflect provider payloads, secret-bearing URLs or tracebacks.
        failure_code = "unexpected_verification_error"

    receipt = verification_receipt(failure_code=failure_code, env=os.environ)
    result = json.dumps(receipt, sort_keys=True)
    print(result)
    output = os.environ.get("ARGUS_RECEIPT_PATH")
    if output:
        try:
            target = Path(output)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(result + "\n", encoding="utf-8")
        except OSError:
            print("ARGUS receipt could not be saved")
            return 1
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        try:
            with Path(summary).open("a", encoding="utf-8") as file:
                file.write(f"### ARGUS synthetic verification receipt\n\n~~~json\n{result}\n~~~\n")
        except OSError:
            print("ARGUS summary could not be saved")
            return 1
    return 0 if failure_code is None else 1


if __name__ == "__main__":
    raise SystemExit(main())
