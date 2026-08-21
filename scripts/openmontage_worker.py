#!/usr/bin/env python3
import json
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

HOME = Path.home()
QUEUE_REPO = HOME / "Nicholas-AI-OS"
OPENMONTAGE = HOME / "OpenMontage"
JOBS_DIR = QUEUE_REPO / "jobs" / "openmontage"
ICLOUD_OUT = HOME / "Library" / "Mobile Documents" / "com~apple~CloudDocs" / "OpenMontage Output"
LOCK = HOME / ".openmontage-worker.lock"
LOG = HOME / "Library" / "Logs" / "OpenMontageWorker.log"


def log(msg: str):
    ts = datetime.now(timezone.utc).isoformat()
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a", encoding="utf-8") as f:
        f.write(f"[{ts}] {msg}\n")


def run(cmd, cwd=None, timeout=None, check=True):
    log("RUN: " + " ".join(map(str, cmd)))
    return subprocess.run(
        [str(x) for x in cmd],
        cwd=str(cwd) if cwd else None,
        text=True,
        capture_output=True,
        timeout=timeout,
        check=check,
        env=os.environ.copy(),
    )


def git_sync():
    run(["git", "pull", "--ff-only"], cwd=QUEUE_REPO, timeout=120)


def save_job(path: Path, job: dict):
    path.write_text(json.dumps(job, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def push_status(path: Path, message: str):
    rel = path.relative_to(QUEUE_REPO)
    run(["git", "add", str(rel)], cwd=QUEUE_REPO, timeout=60)
    # Commit may have nothing to do if another sync raced; tolerate that.
    cp = subprocess.run(["git", "commit", "-m", message], cwd=str(QUEUE_REPO), text=True, capture_output=True)
    if cp.returncode == 0:
        run(["git", "push"], cwd=QUEUE_REPO, timeout=120)


def process_job(path: Path):
    job = json.loads(path.read_text(encoding="utf-8"))
    if job.get("status") != "queued":
        return False
    if job.get("type") != "openmontage_video":
        return False

    job_id = job.get("id") or path.stem
    project_id = job.get("project_id") or job_id
    brief = job.get("brief", "").strip()
    if not brief:
        job["status"] = "failed"
        job["error"] = "Missing brief"
        save_job(path, job)
        push_status(path, f"OpenMontage job {job_id}: failed missing brief")
        return True

    runtime = job.get("runtime", "hyperframes")
    composition_mode = job.get("composition_mode", "templated")
    cost_policy = job.get("cost_policy", "free_only")

    job["status"] = "running"
    job["started_at"] = datetime.now(timezone.utc).isoformat()
    save_job(path, job)
    push_status(path, f"OpenMontage job {job_id}: running")

    prompt = f"""You are operating inside the OpenMontage repository. Execute this production job through OpenMontage's documented pipeline system and obey CODEX.md / AGENT_GUIDE.md.\n\nJOB ID: {job_id}\nPROJECT ID: {project_id}\nUSER BRIEF:\n{brief}\n\nPRE-APPROVED PRODUCTION DECISIONS FROM THE USER:\n- render runtime: {runtime}\n- composition mode: {composition_mode}\n- cost policy: {cost_policy}\n- output must be a real MP4 at: projects/{project_id}/renders/final.mp4\n\nDo not substitute paid providers when cost_policy is free_only. Prefer OpenMontage's real/open/stock-footage path when the brief asks for real footage. If a required capability is unavailable, stop and clearly report the blocker rather than silently changing the approved plan. Complete the production if the approved path is available.\n"""

    try:
        result = run(["codex", "exec", prompt], cwd=OPENMONTAGE, timeout=7200)
        final_mp4 = OPENMONTAGE / "projects" / project_id / "renders" / "final.mp4"
        if not final_mp4.exists():
            raise RuntimeError("Codex/OpenMontage completed but final.mp4 was not found at the required path")

        ICLOUD_OUT.mkdir(parents=True, exist_ok=True)
        out_name = job.get("output_filename") or f"{project_id}.mp4"
        out_path = ICLOUD_OUT / out_name
        shutil.copy2(final_mp4, out_path)

        job["status"] = "completed"
        job["completed_at"] = datetime.now(timezone.utc).isoformat()
        job["local_output"] = str(final_mp4)
        job["icloud_output"] = str(out_path)
        job["codex_stdout_tail"] = result.stdout[-4000:]
        save_job(path, job)
        push_status(path, f"OpenMontage job {job_id}: completed")
        log(f"COMPLETED {job_id}: {out_path}")
    except Exception as e:
        job["status"] = "failed"
        job["failed_at"] = datetime.now(timezone.utc).isoformat()
        job["error"] = str(e)
        save_job(path, job)
        try:
            push_status(path, f"OpenMontage job {job_id}: failed")
        except Exception as push_err:
            log(f"Failed to push failure status: {push_err}")
        log(f"FAILED {job_id}: {e}")
    return True


def main():
    if LOCK.exists():
        try:
            pid = int(LOCK.read_text().strip())
            os.kill(pid, 0)
            return 0
        except Exception:
            LOCK.unlink(missing_ok=True)

    LOCK.write_text(str(os.getpid()))
    try:
        if not QUEUE_REPO.exists() or not OPENMONTAGE.exists():
            log("Required repositories missing")
            return 2
        JOBS_DIR.mkdir(parents=True, exist_ok=True)
        git_sync()
        for path in sorted(JOBS_DIR.glob("*.json")):
            if process_job(path):
                break  # one render per launch to avoid overlapping heavy jobs
        return 0
    except Exception as e:
        log(f"Worker error: {e}")
        return 1
    finally:
        LOCK.unlink(missing_ok=True)


if __name__ == "__main__":
    sys.exit(main())
