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
JOB_LOG_DIR = HOME / "Library" / "Logs" / "OpenMontageJobs"


def log(msg: str):
    ts = datetime.now(timezone.utc).isoformat()
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a", encoding="utf-8") as f:
        f.write(f"[{ts}] {msg}\n")


def run(cmd, cwd=None, timeout=None, check=True):
    log("RUN: " + " ".join(map(str, cmd)))
    return subprocess.run(
        [str(x) for x in cmd], cwd=str(cwd) if cwd else None,
        text=True, capture_output=True, timeout=timeout, check=check,
        env=os.environ.copy(),
    )


def run_logged(cmd, job_id: str, cwd=None, timeout=900):
    JOB_LOG_DIR.mkdir(parents=True, exist_ok=True)
    job_log = JOB_LOG_DIR / f"{job_id}.log"
    log(f"RUN-LIVE ({timeout}s timeout): {' '.join(map(str, cmd))}")
    start = time.time()
    with job_log.open("a", encoding="utf-8") as out:
        out.write(f"\n=== {datetime.now(timezone.utc).isoformat()} START ===\n")
        out.flush()
        proc = subprocess.Popen(
            [str(x) for x in cmd], cwd=str(cwd) if cwd else None,
            text=True, stdout=out, stderr=subprocess.STDOUT,
            env=os.environ.copy(),
        )
        while True:
            rc = proc.poll()
            if rc is not None:
                break
            if time.time() - start > timeout:
                proc.terminate()
                try:
                    proc.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    proc.wait()
                raise TimeoutError(f"Process exceeded {timeout}s; see {job_log}")
            time.sleep(1)
        out.write(f"\n=== EXIT {proc.returncode} ===\n")
        out.flush()
    if proc.returncode != 0:
        raise RuntimeError(f"Process exited {proc.returncode}; see {job_log}")
    return job_log


def git_sync():
    # GitHub is the source of truth for queue files. A killed worker can leave a
    # locally modified job JSON behind; discard only queue-file edits before sync
    # so they cannot permanently block future pulls.
    run(["git", "restore", "--staged", "--worktree", "--", "jobs/openmontage"], cwd=QUEUE_REPO, timeout=60, check=False)
    run(["git", "pull", "--ff-only"], cwd=QUEUE_REPO, timeout=120)


def save_job(path: Path, job: dict):
    path.write_text(json.dumps(job, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def push_status(path: Path, message: str):
    rel = path.relative_to(QUEUE_REPO)
    run(["git", "add", str(rel)], cwd=QUEUE_REPO, timeout=60)
    cp = subprocess.run(["git", "commit", "-m", message], cwd=str(QUEUE_REPO), text=True, capture_output=True)
    if cp.returncode == 0:
        run(["git", "push"], cwd=QUEUE_REPO, timeout=120)


def newest_mp4(project_dir: Path):
    if not project_dir.exists():
        return None
    files = [p for p in project_dir.rglob("*.mp4") if p.is_file()]
    return max(files, key=lambda p: p.stat().st_mtime) if files else None


def complete_job(path: Path, job: dict, final_mp4: Path, job_log=None):
    project_id = job.get("project_id") or job.get("id") or path.stem
    ICLOUD_OUT.mkdir(parents=True, exist_ok=True)
    out_name = job.get("output_filename") or f"{project_id}.mp4"
    out_path = ICLOUD_OUT / out_name
    shutil.copy2(final_mp4, out_path)
    job["status"] = "completed"
    job["completed_at"] = datetime.now(timezone.utc).isoformat()
    job["local_output"] = str(final_mp4)
    job["icloud_output"] = str(out_path)
    if job_log:
        job["execution_log"] = str(job_log)
    save_job(path, job)
    push_status(path, f"OpenMontage job {job.get('id', path.stem)}: completed")
    log(f"COMPLETED {job.get('id', path.stem)}: {out_path}")


def run_direct_smoke(job_id: str, project_id: str):
    run_logged(["make", "demo"], job_id, cwd=OPENMONTAGE, timeout=600)
    source = OPENMONTAGE / "projects" / "demos" / "renders" / "code-to-screen.mp4"
    if not source.exists():
        source = newest_mp4(OPENMONTAGE / "projects" / "demos")
    if not source:
        raise RuntimeError("make demo completed but no demo MP4 was found")
    target = OPENMONTAGE / "projects" / project_id / "renders" / "final.mp4"
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    return target, JOB_LOG_DIR / f"{job_id}.log"


def process_job(path: Path):
    job = json.loads(path.read_text(encoding="utf-8"))
    if job.get("status") != "queued" or job.get("type") != "openmontage_video":
        return False

    job_id = job.get("id") or path.stem
    project_id = job.get("project_id") or job_id
    brief = job.get("brief", "").strip()
    if not brief:
        job["status"] = "failed"; job["error"] = "Missing brief"
        save_job(path, job); push_status(path, f"OpenMontage job {job_id}: failed missing brief")
        return True

    runtime = job.get("runtime", "hyperframes")
    composition_mode = job.get("composition_mode", "templated")
    cost_policy = job.get("cost_policy", "free_only")
    timeout_seconds = int(job.get("timeout_seconds", 900))

    job["status"] = "running"
    job["started_at"] = datetime.now(timezone.utc).isoformat()
    job.pop("error", None); job.pop("failed_at", None)
    save_job(path, job); push_status(path, f"OpenMontage job {job_id}: running")

    try:
        if job.get("execution_mode") == "direct_smoke_test":
            final_mp4, job_log = run_direct_smoke(job_id, project_id)
            complete_job(path, job, final_mp4, job_log)
            return True

        prompt = f"""You are operating inside the OpenMontage repository. Execute this production job through OpenMontage's documented pipeline system and obey CODEX.md / AGENT_GUIDE.md.\n\nJOB ID: {job_id}\nPROJECT ID: {project_id}\nUSER BRIEF:\n{brief}\n\nTHE USER HAS ALREADY APPROVED:\n- render runtime: {runtime}\n- composition mode: {composition_mode}\n- cost policy: {cost_policy}\n- final deliverable must be an actual MP4\n\nThis is non-interactive. Do not stop to re-ask those approvals. Continue through the documented pipeline to final render when available. Do not use paid providers when cost_policy is free_only. If blocked, fail clearly rather than silently substituting. Target output: projects/{project_id}/renders/final.mp4.\n"""
        job_log = run_logged(["codex", "exec", prompt], job_id, cwd=OPENMONTAGE, timeout=timeout_seconds)
        project_dir = OPENMONTAGE / "projects" / project_id
        preferred = project_dir / "renders" / "final.mp4"
        final_mp4 = preferred if preferred.exists() else newest_mp4(project_dir)
        if not final_mp4:
            raise RuntimeError(f"Codex returned without an MP4; see {job_log}")
        complete_job(path, job, final_mp4, job_log)
    except Exception as e:
        job["status"] = "failed"
        job["failed_at"] = datetime.now(timezone.utc).isoformat()
        job["error"] = str(e)
        job["execution_log"] = str(JOB_LOG_DIR / f"{job_id}.log")
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
            log("Required repositories missing"); return 2
        JOBS_DIR.mkdir(parents=True, exist_ok=True)
        git_sync()
        for path in sorted(JOBS_DIR.glob("*.json")):
            if process_job(path):
                break
        return 0
    except Exception as e:
        log(f"Worker error: {e}"); return 1
    finally:
        LOCK.unlink(missing_ok=True)


if __name__ == "__main__":
    sys.exit(main())
