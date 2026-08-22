#!/usr/bin/env python3
import hashlib
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


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def log(msg: str):
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a", encoding="utf-8") as f:
        f.write(f"[{utc_now()}] {msg}\n")


def run(cmd, cwd=None, timeout=None, check=True):
    log("RUN: " + " ".join(map(str, cmd)))
    return subprocess.run(
        [str(x) for x in cmd], cwd=str(cwd) if cwd else None,
        text=True, capture_output=True, timeout=timeout, check=check,
        env=os.environ.copy(),
    )


def run_logged(cmd, job_id: str, cwd=None, timeout=3600):
    JOB_LOG_DIR.mkdir(parents=True, exist_ok=True)
    job_log = JOB_LOG_DIR / f"{job_id}.log"
    log(f"RUN-LIVE ({timeout}s timeout): {' '.join(map(str, cmd))}")
    start = time.time()
    with job_log.open("a", encoding="utf-8") as out:
        out.write(f"\n=== {utc_now()} START ===\n")
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
    # Job files are the worker's queue/status transport. Discard only uncommitted
    # queue-file changes left by an interrupted run, then fast-forward safely.
    run(
        ["git", "restore", "--staged", "--worktree", "--", "jobs/openmontage"],
        cwd=QUEUE_REPO, timeout=60, check=False,
    )
    run(["git", "pull", "--rebase"], cwd=QUEUE_REPO, timeout=120)


def save_job(path: Path, job: dict):
    path.write_text(json.dumps(job, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def push_status(path: Path, message: str):
    rel = path.relative_to(QUEUE_REPO)
    run(["git", "add", "--", str(rel)], cwd=QUEUE_REPO, timeout=60)
    cp = subprocess.run(
        ["git", "commit", "-m", message], cwd=str(QUEUE_REPO),
        text=True, capture_output=True,
    )
    if cp.returncode != 0:
        if "nothing to commit" in (cp.stdout + cp.stderr).lower():
            return
        raise RuntimeError(f"git commit failed: {(cp.stdout + cp.stderr).strip()}")

    # A phone request can arrive while a render is running. Rebase the status
    # commit over it and retry instead of leaving the Mac checkout diverged.
    last_error = None
    for attempt in range(3):
        try:
            run(["git", "pull", "--rebase"], cwd=QUEUE_REPO, timeout=120)
            run(["git", "push"], cwd=QUEUE_REPO, timeout=120)
            return
        except Exception as exc:
            last_error = exc
            log(f"Status push attempt {attempt + 1} failed: {exc}")
            time.sleep(2 ** attempt)
    raise RuntimeError(f"Unable to publish job status after 3 attempts: {last_error}")


def newest_mp4(project_dir: Path):
    if not project_dir.exists():
        return None
    files = [p for p in project_dir.rglob("*.mp4") if p.is_file()]
    return max(files, key=lambda p: p.stat().st_mtime) if files else None


def sha256_file(path: Path):
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def probe_video(path: Path):
    cp = run(
        [
            "ffprobe", "-v", "error", "-select_streams", "v:0",
            "-show_entries", "stream=codec_name,width,height,duration",
            "-show_entries", "format=duration,size",
            "-of", "json", path,
        ],
        timeout=60,
    )
    data = json.loads(cp.stdout)
    streams = data.get("streams") or []
    if not streams or int(streams[0].get("width", 0)) <= 0 or int(streams[0].get("height", 0)) <= 0:
        raise RuntimeError(f"Rendered file failed ffprobe video validation: {path}")
    return data


def complete_job(path: Path, job: dict, final_mp4: Path, job_log=None):
    project_id = job.get("project_id") or job.get("id") or path.stem
    ICLOUD_OUT.mkdir(parents=True, exist_ok=True)
    out_name = job.get("output_filename") or f"{project_id}.mp4"
    out_path = ICLOUD_OUT / out_name

    probe = probe_video(final_mp4)
    shutil.copy2(final_mp4, out_path)
    copied_probe = probe_video(out_path)
    source_hash = sha256_file(final_mp4)
    copied_hash = sha256_file(out_path)
    if source_hash != copied_hash:
        raise RuntimeError("iCloud delivery copy failed SHA-256 verification")

    job["status"] = "completed"
    job["completed_at"] = utc_now()
    job["local_output"] = str(final_mp4)
    job["icloud_output"] = str(out_path)
    job["phone_location"] = f"Files > iCloud Drive > OpenMontage Output > {out_name}"
    job["sha256"] = copied_hash
    job["output_size_bytes"] = out_path.stat().st_size
    job["qa"] = {"passed": True, "source_ffprobe": probe, "delivered_ffprobe": copied_probe}
    if job_log:
        job["execution_log"] = str(job_log)
    save_job(path, job)
    push_status(path, f"OpenMontage job {job.get('id', path.stem)}: completed")
    log(f"COMPLETED {job.get('id', path.stem)}: {out_path}")


def run_direct_smoke(job_id: str, project_id: str, timeout_seconds: int):
    # Render exactly one checked-in, zero-key OpenMontage Remotion production.
    # The old bridge called `make demo`, which renders all demos and exceeded
    # the bridge timeout before any handoff could complete.
    demo_name = "code-to-screen"
    render_script = OPENMONTAGE / "render_demo.py"
    python_bin = OPENMONTAGE / ".venv" / "bin" / "python"
    if not python_bin.exists():
        python_bin = Path(sys.executable)
    if not render_script.exists():
        raise RuntimeError(f"OpenMontage render script not found: {render_script}")

    source = OPENMONTAGE / "projects" / "demos" / "renders" / f"{demo_name}.mp4"
    render_started = time.time()
    job_log = run_logged(
        [python_bin, render_script, demo_name],
        job_id,
        cwd=OPENMONTAGE,
        timeout=timeout_seconds,
    )
    if not source.exists() or source.stat().st_mtime < render_started - 2:
        raise RuntimeError(f"OpenMontage did not create a fresh demo MP4; see {job_log}")

    target = OPENMONTAGE / "projects" / project_id / "renders" / "final.mp4"
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    return target, job_log


def process_job(path: Path):
    job = json.loads(path.read_text(encoding="utf-8"))
    if job.get("status") != "queued" or job.get("type") != "openmontage_video":
        return False

    job_id = job.get("id") or path.stem
    project_id = job.get("project_id") or job_id
    brief = job.get("brief", "").strip()
    if not brief:
        job["status"] = "failed"
        job["error"] = "Missing brief"
        job["failed_at"] = utc_now()
        save_job(path, job)
        push_status(path, f"OpenMontage job {job_id}: failed missing brief")
        return True

    runtime = job.get("runtime", "hyperframes")
    composition_mode = job.get("composition_mode", "templated")
    cost_policy = job.get("cost_policy", "free_only")
    timeout_seconds = int(job.get("timeout_seconds", 3600))

    job["status"] = "running"
    job["started_at"] = utc_now()
    job.pop("error", None)
    job.pop("failed_at", None)
    save_job(path, job)
    push_status(path, f"OpenMontage job {job_id}: running")

    try:
        if job.get("execution_mode") == "direct_smoke_test":
            final_mp4, job_log = run_direct_smoke(
                job_id, project_id, timeout_seconds
            )
            complete_job(path, job, final_mp4, job_log)
            return True

        prompt = f"""You are operating inside the OpenMontage repository. Execute this production job through OpenMontage's documented pipeline system and obey CODEX.md / AGENT_GUIDE.md.

JOB ID: {job_id}
PROJECT ID: {project_id}
USER BRIEF:
{brief}

THE USER HAS ALREADY APPROVED AND AUTHORIZED THIS UNATTENDED RUN:
- render runtime: {runtime}
- composition mode: {composition_mode}
- cost policy: {cost_policy}
- final deliverable must be an actual MP4

This is a non-interactive queue worker. Record the queue request as the user's approval at required checkpoints and continue through every documented pipeline stage without waiting for terminal input. Do not re-ask choices already fixed above. Do not use paid providers when cost_policy is free_only. If blocked, fail clearly rather than silently substituting. Render to projects/{project_id}/renders/final.mp4 (or another MP4 inside projects/{project_id} if the selected OpenMontage pipeline uses a different final path). Perform OpenMontage's post-render QA before returning.
"""
        job_log = run_logged(
            ["codex", "exec", prompt],
            job_id,
            cwd=OPENMONTAGE,
            timeout=timeout_seconds,
        )
        project_dir = OPENMONTAGE / "projects" / project_id
        preferred = project_dir / "renders" / "final.mp4"
        final_mp4 = preferred if preferred.exists() else newest_mp4(project_dir)
        if not final_mp4:
            raise RuntimeError(f"Codex returned without an MP4; see {job_log}")
        complete_job(path, job, final_mp4, job_log)
    except Exception as exc:
        job["status"] = "failed"
        job["failed_at"] = utc_now()
        job["error"] = str(exc)
        job["execution_log"] = str(JOB_LOG_DIR / f"{job_id}.log")
        save_job(path, job)
        try:
            push_status(path, f"OpenMontage job {job_id}: failed")
        except Exception as push_err:
            log(f"Failed to push failure status: {push_err}")
        log(f"FAILED {job_id}: {exc}")
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
                break
        return 0
    except Exception as exc:
        log(f"Worker error: {exc}")
        return 1
    finally:
        LOCK.unlink(missing_ok=True)


if __name__ == "__main__":
    sys.exit(main())
