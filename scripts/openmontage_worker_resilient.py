#!/usr/bin/env python3
"""Resilience wrapper for the Nicholas-AI-OS OpenMontage Mac worker.

Adds production safeguards without slowing the proven normal path:
1. Retry a Remotion Fast Reel once at concurrency=1 with verbose logging when
   Chromium crashes with the known Target closed / Target.createTarget failure.
2. Publish a lightweight remote worker heartbeat to GitHub at most every 15
   minutes so ChatGPT can distinguish an idle worker from an offline Mac.
3. Support tightly allowlisted maintenance jobs without granting arbitrary
   shell execution.
"""

import json
import os
import shutil
import sys
import time
from datetime import datetime, timezone

import openmontage_worker_base as worker
from openmontage_agent_stack import install as install_agent_stack
from openmontage_trading_stack import install as install_trading_stack

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
_original_process_job = worker.process_job


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


def resilient_process_job(path):
    """Intercept only explicitly allowlisted maintenance; delegate all media jobs."""
    try:
        job = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return _original_process_job(path)

    if not (
        job.get("status") == "queued"
        and job.get("type") == "openmontage_video"
        and job.get("execution_mode") == "install_keepawake_agent"
    ):
        return _original_process_job(path)

    job_id = job.get("id") or path.stem
    script = worker.QUEUE_REPO / "scripts" / "install_keepawake_agent.sh"
    job["render_mode_resolved"] = "maintenance"
    job["routing_reason"] = "explicit allowlisted keep-awake LaunchAgent installation"
    job["status"] = "running"
    job["started_at"] = worker.utc_now()
    job.pop("error", None)
    job.pop("failed_at", None)
    worker.save_job(path, job)
    worker.push_status(path, f"OpenMontage maintenance {job_id}: running")

    try:
        if not script.exists():
            raise RuntimeError(f"Maintenance script missing: {script}")
        result = worker.run(["/bin/zsh", script], cwd=worker.QUEUE_REPO, timeout=90)
        job["status"] = "completed"
        job["completed_at"] = worker.utc_now()
        job["maintenance_result"] = worker.sanitize_log_text(result.stdout.strip())[-6000:]
        job["keepawake_installed"] = "KEEP_AWAKE_INSTALLED=1" in result.stdout

        heartbeat = {}
        if HEARTBEAT_PATH.exists():
            try:
                heartbeat = json.loads(HEARTBEAT_PATH.read_text(encoding="utf-8"))
            except Exception:
                heartbeat = {}
        heartbeat.update({
            "component": "Mac OpenMontage Worker",
            "state": "healthy",
            "checked_at": worker.utc_now(),
            "worker": "openmontage_worker_resilient.py",
            "worker_version": 3,
            "last_worker_exit_code": 0,
            "heartbeat_interval_seconds": HEARTBEAT_INTERVAL_SECONDS,
            "keepawake_policy": "AC-power LaunchAgent",
            "keepawake_installed": bool(job["keepawake_installed"]),
            "keepawake_installed_at": job["completed_at"],
        })
        HEARTBEAT_PATH.parent.mkdir(parents=True, exist_ok=True)
        HEARTBEAT_PATH.write_text(json.dumps(heartbeat, indent=2) + "\n", encoding="utf-8")

        worker.save_job(path, job)
        worker.push_status(
            path,
            f"OpenMontage maintenance {job_id}: completed",
            extra_paths=[HEARTBEAT_PATH],
        )
        worker.log(f"MAINTENANCE COMPLETED {job_id}: keep-awake agent installed")
    except Exception as exc:
        job["status"] = "failed"
        job["failed_at"] = worker.utc_now()
        job["error"] = str(exc)
        worker.save_job(path, job)
        try:
            worker.push_status(path, f"OpenMontage maintenance {job_id}: failed")
        except Exception as push_err:
            worker.log(f"Failed to push maintenance failure status: {push_err}")
        worker.log(f"MAINTENANCE FAILED {job_id}: {exc}")
    return True


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
            "worker_version": 3,
            "heartbeat_interval_seconds": HEARTBEAT_INTERVAL_SECONDS,
            "last_worker_exit_code": int(worker_exit_code),
            "keepawake_policy": "AC-power LaunchAgent",
        }

        for key in (
            "last_successful_job",
            "last_successful_job_completed_at",
            "fast_reel_render_seconds",
            "qa_passed",
            "delivery",
            "keepawake_installed",
            "keepawake_installed_at",
        ):
            if key in existing:
                payload[key] = existing[key]

        HEARTBEAT_PATH.parent.mkdir(parents=True, exist_ok=True)
        HEARTBEAT_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        worker.push_status(HEARTBEAT_PATH, f"OpenMontage worker heartbeat: {state}")
    except Exception as exc:
        worker.log(f"Heartbeat publication failed: {exc}")


# The installed macOS LaunchAgent currently invokes this module directly. Wire
# the additional allowlisted maintenance modes here so both direct and wrapper
# entrypoints see the same routing behavior.
install_agent_stack(sys.modules[__name__], worker)
install_trading_stack(sys.modules[__name__], worker)


def main() -> int:
    worker.run_fast_reel = resilient_run_fast_reel
    worker.process_job = resilient_process_job
    code = int(worker.main())
    publish_remote_heartbeat(code)
    return code


if __name__ == "__main__":
    sys.exit(main())
