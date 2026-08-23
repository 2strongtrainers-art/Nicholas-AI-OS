#!/usr/bin/env python3
"""Resilience wrapper for the Nicholas-AI-OS OpenMontage Mac worker.

Adds two production safeguards without changing the proven fast path:
1. Retry a Remotion Fast Reel once at concurrency=1 with verbose logging when
   Chromium crashes with the known Target closed / Target.createTarget failure.
2. Publish a lightweight remote worker heartbeat to GitHub at most every 15
   minutes so ChatGPT can distinguish an idle worker from an offline Mac.
"""

import json
import os
import shutil
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import openmontage_worker as worker

HEARTBEAT_PATH = worker.QUEUE_REPO / "status" / "openmontage-worker.json"
HEARTBEAT_INTERVAL_SECONDS = 15 * 60
TRANSIENT_BROWSER_SIGNATURES = (
    "target closed",
    "target.createtarget",
    "protocolerror",
    "browser process exited",
    "browser crashed",
)

_original_run_fast_reel = worker.run_fast_reel


def _read_job_log(job_id: str) -> str:
    path = worker.JOB_LOG_DIR / f"{worker.safe_slug(job_id)}.log"
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8", errors="replace")


def _is_transient_browser_crash(exc: Exception, job_id: str) -> bool:
    text = f"{exc}\n{_read_job_log(job_id)}".lower()
    return any(signature in text for signature in TRANSIENT_BROWSER_SIGNATURES)


def resilient_run_fast_reel(job: dict, job_id: str, project_id: str, timeout_seconds: int):
    """Run the normal Fast Reel path, retrying only a known Chromium crash."""
    try:
        return _original_run_fast_reel(job, job_id, project_id, timeout_seconds)
    except Exception as first_exc:
        if not _is_transient_browser_crash(first_exc, job_id):
            raise

        worker.log(
            f"FAST REEL AUTO-RECOVERY {job_id}: transient Remotion browser crash; "
            "retrying once with concurrency=1 and verbose logging"
        )
        job["auto_recovery"] = {
            "trigger": "remotion_target_closed",
            "retry_count": 1,
            "retry_concurrency": 1,
            "first_error": str(first_exc),
        }

        if not worker.FAST_REEL_TEMPLATE.exists():
            raise RuntimeError(f"Fast Reel template missing: {worker.FAST_REEL_TEMPLATE}") from first_exc

        remotion_bin = worker.REMOTION_COMPOSER / "node_modules" / ".bin" / "remotion"
        if not remotion_bin.exists():
            raise RuntimeError(f"OpenMontage Remotion runtime missing: {remotion_bin}") from first_exc

        composer_template = worker.REMOTION_COMPOSER / "src" / "NicholasFastReel.tsx"
        if not composer_template.exists() or composer_template.read_bytes() != worker.FAST_REEL_TEMPLATE.read_bytes():
            shutil.copy2(worker.FAST_REEL_TEMPLATE, composer_template)

        project_dir = worker.OPENMONTAGE / "projects" / project_id
        work_dir = project_dir / "fast_reel"
        render_dir = project_dir / "renders"
        work_dir.mkdir(parents=True, exist_ok=True)
        render_dir.mkdir(parents=True, exist_ok=True)

        props = worker.build_fast_reel_props(job, project_dir)
        props_path = work_dir / "props.json"
        props_path.write_text(json.dumps(props, indent=2) + "\n", encoding="utf-8")
        final_mp4 = render_dir / "final.mp4"
        final_mp4.unlink(missing_ok=True)

        retry_timeout = max(int(timeout_seconds), 240)
        started = time.monotonic()
        job_log = worker.run_logged(
            [
                remotion_bin,
                "render",
                "src/NicholasFastReel.tsx",
                "FastReel",
                final_mp4,
                "--props",
                props_path,
                "--codec",
                "h264",
                "--concurrency",
                "1",
                "--log",
                "verbose",
            ],
            job_id,
            cwd=worker.REMOTION_COMPOSER,
            timeout=retry_timeout,
        )
        elapsed = round(time.monotonic() - started, 3)
        if not final_mp4.exists():
            raise RuntimeError(f"Fast Reel recovery returned without an MP4; see {job_log}")

        job["auto_recovery"]["recovered"] = True
        job["auto_recovery"]["retry_render_seconds"] = elapsed
        return final_mp4, job_log, props, elapsed


def _parse_iso(value: str):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


def publish_remote_heartbeat(worker_exit_code: int) -> None:
    """Push health at most every 15 minutes to avoid noisy Git history."""
    try:
        now = datetime.now(timezone.utc)
        existing = {}
        if HEARTBEAT_PATH.exists():
            try:
                existing = json.loads(HEARTBEAT_PATH.read_text(encoding="utf-8"))
            except Exception:
                existing = {}

        previous = _parse_iso(str(existing.get("checked_at") or ""))
        if previous and (now - previous).total_seconds() < HEARTBEAT_INTERVAL_SECONDS:
            return

        state = "healthy" if worker_exit_code == 0 else "degraded"
        payload = {
            "component": "Mac OpenMontage Worker",
            "state": state,
            "checked_at": now.isoformat(),
            "host": os.uname().nodename,
            "worker": "openmontage_worker_resilient.py",
            "worker_version": 2,
            "heartbeat_interval_seconds": HEARTBEAT_INTERVAL_SECONDS,
            "last_worker_exit_code": int(worker_exit_code),
            "keepawake_policy": "AC-power LaunchAgent",
        }

        # Preserve useful last-known successful job metadata seeded by completed jobs/tests.
        for key in (
            "last_successful_job",
            "last_successful_job_completed_at",
            "fast_reel_render_seconds",
            "qa_passed",
            "delivery",
        ):
            if key in existing:
                payload[key] = existing[key]

        HEARTBEAT_PATH.parent.mkdir(parents=True, exist_ok=True)
        HEARTBEAT_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        worker.push_status(HEARTBEAT_PATH, f"OpenMontage worker heartbeat: {state}")
    except Exception as exc:
        # Heartbeat publication must never prevent real jobs from running.
        worker.log(f"Heartbeat publication failed: {exc}")


def main() -> int:
    worker.run_fast_reel = resilient_run_fast_reel
    code = int(worker.main())
    publish_remote_heartbeat(code)
    return code


if __name__ == "__main__":
    sys.exit(main())
