#!/usr/bin/env python3
"""Offline, read-only ARGUS image triage. Run ONLY inside the documented sandbox.

No image is uploaded and no network call is made by this Python module.
External parsers are untrusted and therefore require a network-disabled container.
This tool reports observations, not image authenticity or attribution.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import tempfile

MAX_INPUT_BYTES = 25 * 1024 * 1024
MAX_TOOL_OUTPUT_BYTES = 512 * 1024
TIMEOUT_SECONDS = 20

PUBLIC_TAGS = ("FileType", "MIMEType", "ImageWidth", "ImageHeight",
               "Make", "Model", "Software")
SENSITIVE_TAGS = ("DateTimeOriginal", "CreateDate", "ModifyDate",
                  "GPSLatitude", "GPSLongitude", "GPSAltitude",
                  "SerialNumber", "OwnerName", "Artist")


def validated_sha256(path: Path) -> tuple[str, int]:
    """Hash a regular file without following the last path component if symlinked."""
    fd = os.open(str(path), os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode):
            raise ValueError("Evidence must be a regular file")
        if info.st_size > MAX_INPUT_BYTES:
            raise ValueError("Evidence exceeds 25 MiB; review before processing")
        hasher = hashlib.sha256()
        with os.fdopen(fd, "rb", closefd=False) as stream:
            while True:
                block = stream.read(128 * 1024)
                if not block:
                    break
                hasher.update(block)
        return hasher.hexdigest(), info.st_size
    finally:
        os.close(fd)


def invoke(program: str, args: list[str]) -> dict:
    """Call a fixed local executable; do not use a shell or capture unbounded output."""
    executable = shutil.which(program)
    if not executable:
        return {"status": "unavailable", "reason": "executable_not_installed"}
    env = {"PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
           "HOME": "/tmp", "LC_ALL": "C"}
    try:
        with tempfile.TemporaryFile() as output, tempfile.TemporaryFile() as errors:
            done = subprocess.run(
                [executable, *args], stdout=output, stderr=errors,
                timeout=TIMEOUT_SECONDS, check=False, env=env,
                cwd="/tmp",
            )
            if done.returncode != 0:
                return {"status": "failed", "exit_code": done.returncode}
            if output.tell() > MAX_TOOL_OUTPUT_BYTES:
                return {"status": "failed", "reason": "output_limit_exceeded"}
            output.seek(0)
            return {"status": "ok", "stdout": output.read().decode("utf-8", "replace")}
    except subprocess.TimeoutExpired:
        return {"status": "failed", "reason": "timeout"}
    except OSError:
        return {"status": "failed", "reason": "execution_error"}


def version(program: str, flag: str) -> str | None:
    r = invoke(program, [flag])
    if r["status"] != "ok":
        return None
    return r["stdout"].strip().splitlines()[0][:100] if r["stdout"].strip() else None


def inspect_exif(path: Path, include_sensitive: bool) -> dict:
    permitted = set(PUBLIC_TAGS + (SENSITIVE_TAGS if include_sensitive else ()))
    args = ["-json", "-G1", "-s", "-n",
            *["-" + tag for tag in permitted], "--", str(path)]
    raw = invoke("exiftool", args)
    if raw["status"] != "ok":
        return raw
    try:
        payload = json.loads(raw["stdout"])
        if not isinstance(payload, list) or not payload or not isinstance(payload[0], dict):
            raise ValueError("unexpected parser output")
        # Explicitly filter returned tags even if a tool emits unexpected fields.
        selected = {}
        for key, value in payload[0].items():
            if key.split(":")[-1] in permitted:
                selected[key] = value if isinstance(value, (int, float, bool)) else str(value)[:300]
        return {"status": "ok", "metadata": selected,
                "version": version("exiftool", "-ver")}
    except (ValueError, TypeError, json.JSONDecodeError):
        return {"status": "failed", "reason": "invalid_json"}


def inspect_c2pa(path: Path) -> dict:
    raw = invoke("c2patool", [str(path)])
    if raw["status"] != "ok":
        return raw
    try:
        value = json.loads(raw["stdout"])
        if not isinstance(value, dict):
            raise ValueError("unexpected manifest report")
        active = value.get("active_manifest")
        validation = value.get("validation_state")
        events = value.get("validation_status")
        return {
            "status": "ok",
            "manifest_reported": bool(active),
            "validation_state_reported": validation if isinstance(validation, str) else None,
            "validation_events_count": len(events) if isinstance(events, list) else None,
            "version": version("c2patool", "--version"),
            "interpretation": "A reported manifest is not proof that the depicted event is real.",
        }
    except (ValueError, TypeError, json.JSONDecodeError):
        return {"status": "failed", "reason": "invalid_json"}


def analyze_file(path: Path, *, include_sensitive: bool = False) -> dict:
    path = path.absolute()
    digest, count = validated_sha256(path)
    return {
        "schema": "argus-image-osint-v1",
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "handling": "owner_private_only",
        "source_sha256": digest,
        "source_bytes": count,
        "sensitive_metadata_included": include_sensitive,
        "tools": {
            "exiftool": inspect_exif(path, include_sensitive),
            "c2patool": inspect_c2pa(path),
        },
        "limitations": [
            "No image-authenticity or location claim follows from metadata alone.",
            "Absence of C2PA credentials does not imply tampering.",
            "This program does not search online or independently verify image context.",
            "Network isolation is enforced by the operator's container invocation, not Python.",
        ],
    }


def write_private_report(report: dict, destination: Path) -> None:
    # Fail closed: existing files and symlinks cannot be overwritten.
    fd = os.open(str(destination), os.O_WRONLY | os.O_CREAT | os.O_EXCL |
                 getattr(os, "O_NOFOLLOW", 0), 0o600)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(report, stream, indent=2, sort_keys=True, ensure_ascii=False)
            stream.write("\n")
    except BaseException:
        destination.unlink(missing_ok=True)
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description="Offline, owner-private ARGUS image triage")
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True,
                        help="Must not exist; store outside public GitHub folders")
    parser.add_argument("--include-sensitive", action="store_true",
                        help="Explicitly include EXIF GPS, timestamps and owner/device identifiers")
    args = parser.parse_args()
    if args.input.absolute() == args.output.absolute():
        parser.error("input and output must differ")
    report = analyze_file(args.input, include_sensitive=args.include_sensitive)
    write_private_report(report, args.output)
    print("Saved private report. No uploaded evidence. SHA-256: " + report["source_sha256"])
    print("Tool statuses: " + ", ".join(k + "=" + v["status"]
          for k, v in report["tools"].items()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
