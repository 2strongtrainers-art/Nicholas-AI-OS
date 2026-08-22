#!/usr/bin/env python3
import hashlib
import json
import os
import re
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
FAST_REEL_TEMPLATE = QUEUE_REPO / "templates" / "openmontage" / "fast_reel.tsx"
REMOTION_COMPOSER = OPENMONTAGE / "remotion-composer"
FULL_PRODUCTION_TRIGGERS = (
    "make this cinematic",
    "cinematic production",
    "research this",
    "documentary reel",
    "full documentary",
    "real footage from the internet",
    "source real footage",
    "custom scene development",
    "complex audio",
    "extensive ai generation",
    "full professional production",
    "deep research",
    "multi-stage editorial",
)


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


def safe_slug(value: str):
    slug = re.sub(r"[^a-zA-Z0-9._-]+", "-", value).strip("-.")
    return slug[:120] or "openmontage-job"


def classify_render_mode(job: dict):
    explicit = str(job.get("render_mode", "")).strip().lower()
    if explicit in {"fast_reel", "full_production"}:
        return explicit, f"explicit render_mode={explicit}"

    combined = " ".join(
        str(job.get(key, "")) for key in ("request", "brief", "production_notes")
    ).lower()
    matched = [trigger for trigger in FULL_PRODUCTION_TRIGGERS if trigger in combined]
    if matched:
        return "full_production", f"full-production trigger: {matched[0]}"
    return "fast_reel", "default fast path; no full-production trigger found"


def sanitize_log_text(value: str):
    value = re.sub(
        r"(?i)((?:api[_-]?key|token|authorization|secret)\s*[:=]\s*)\S+",
        r"\1[REDACTED]",
        value,
    )
    return value.replace(str(HOME), "$HOME")


def log_diagnostic(job_id: str, tail_lines=240):
    safe_id = safe_slug(job_id)
    path = JOB_LOG_DIR / f"{safe_id}.log"
    if not path.exists():
        return {"job_id": job_id, "found": False, "path": str(path)}

    raw_lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    signal_terms = (
        "research", "script", "storyboard", "source", "asset", "checkpoint",
        "approval", "waiting", "render", "ffmpeg", "remotion", "hyperframes",
        "error", "failed", "timeout", "exit", "completed",
    )
    signal_lines = [
        sanitize_log_text(line) for line in raw_lines
        if any(term in line.lower() for term in signal_terms)
    ][-120:]
    tail = [sanitize_log_text(line) for line in raw_lines[-tail_lines:]]

    lower = "\n".join(raw_lines).lower()
    if "waiting" in lower and "approval" in lower:
        diagnosis = "waiting_on_approval_or_checkpoint"
    elif "render" not in lower and any(term in lower for term in ("research", "script", "storyboard", "source")):
        diagnosis = "agent_pipeline_before_render"
    elif "render" in lower and not any(term in lower for term in ("exit 0", "completed", "done:")):
        diagnosis = "render_or_render_preparation"
    elif any(term in lower for term in ("error", "failed", "timeout")):
        diagnosis = "error_or_timeout"
    else:
        diagnosis = "completed_or_inconclusive"

    return {
        "job_id": job_id,
        "found": True,
        "path": str(path),
        "size_bytes": path.stat().st_size,
        "line_count": len(raw_lines),
        "diagnosis": diagnosis,
        "signal_lines": signal_lines,
        "tail": tail,
    }


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


def push_status(path: Path, message: str, extra_paths=None):
    targets = [path] + list(extra_paths or [])
    rels = [str(target.relative_to(QUEUE_REPO)) for target in targets]
    run(["git", "add", "--", *rels], cwd=QUEUE_REPO, timeout=60)
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


def validate_fast_reel_probe(probe: dict):
    stream = (probe.get("streams") or [{}])[0]
    fmt = probe.get("format") or {}
    width = int(stream.get("width", 0))
    height = int(stream.get("height", 0))
    codec = str(stream.get("codec_name", ""))
    duration = float(fmt.get("duration") or stream.get("duration") or 0)
    failures = []
    if codec != "h264":
        failures.append(f"codec={codec!r}, expected h264")
    if (width, height) != (1080, 1920):
        failures.append(f"dimensions={width}x{height}, expected 1080x1920")
    if not 14.5 <= duration <= 90.5:
        failures.append(f"duration={duration:.3f}s, expected 15-90s")
    if failures:
        raise RuntimeError("Fast Reel QA failed: " + "; ".join(failures))


def make_contact_sheet(video_path: Path, job_id: str, duration: float):
    preview_dir = JOBS_DIR / "previews"
    preview_dir.mkdir(parents=True, exist_ok=True)
    frame_dir = OPENMONTAGE / "projects" / safe_slug(job_id) / "fast_reel" / "qa-frames"
    frame_dir.mkdir(parents=True, exist_ok=True)
    frame_paths = []
    for index, fraction in enumerate((0.08, 0.34, 0.62, 0.9), start=1):
        frame_path = frame_dir / f"frame-{index}.jpg"
        run(
            [
                "ffmpeg", "-y", "-ss", f"{max(0.1, duration * fraction):.3f}",
                "-i", video_path, "-frames:v", "1", "-vf", "scale=270:480",
                "-q:v", "3", frame_path,
            ],
            timeout=90,
        )
        frame_paths.append(frame_path)

    preview_path = preview_dir / f"{safe_slug(job_id)}.jpg"
    run(
        [
            "ffmpeg", "-y",
            *sum((["-i", frame] for frame in frame_paths), []),
            "-filter_complex",
            "[0:v][1:v]hstack=inputs=2[top];[2:v][3:v]hstack=inputs=2[bottom];[top][bottom]vstack=inputs=2[out]",
            "-map", "[out]", "-frames:v", "1", "-q:v", "3", preview_path,
        ],
        timeout=90,
    )
    return preview_path


def resolve_fast_asset(value, asset_dir: Path):
    if not value:
        return None, None
    raw = str(value).strip()
    if re.match(r"^https?://", raw, flags=re.I):
        suffix = Path(raw.split("?", 1)[0]).suffix.lower()
        kind = "video" if suffix in {".mp4", ".mov", ".webm", ".m4v"} else "image"
        return raw, kind

    candidate = Path(raw).expanduser()
    candidates = [candidate] if candidate.is_absolute() else [QUEUE_REPO / candidate, OPENMONTAGE / candidate]
    source = next((path for path in candidates if path.is_file()), None)
    if not source:
        raise RuntimeError(f"Fast Reel local asset not found: {raw}")

    asset_dir.mkdir(parents=True, exist_ok=True)
    target = asset_dir / safe_slug(source.name)
    shutil.copy2(source, target)
    relative = target.relative_to(REMOTION_COMPOSER / "public").as_posix()
    kind = "video" if source.suffix.lower() in {".mp4", ".mov", ".webm", ".m4v"} else "image"
    return relative, kind


def split_body_lines(value, fallback):
    if isinstance(value, list):
        lines = [str(item).strip() for item in value if str(item).strip()]
    else:
        text = str(value or fallback or "").strip()
        lines = [part.strip() for part in re.split(r"[\n|]+|(?<=[.!?])\s+", text) if part.strip()]
    cleaned = []
    for line in lines:
        compact = re.sub(r"\s+", " ", line).strip(" -")
        if compact:
            cleaned.append(compact[:110])
    return (cleaned or ["SHOW UP", "TRAIN WITH INTENT", "STACK THE WINS"])[0:6]


def build_fast_reel_props(job: dict, project_dir: Path):
    config = job.get("fast_reel") if isinstance(job.get("fast_reel"), dict) else {}
    duration = max(15.0, min(90.0, float(config.get("duration_seconds", job.get("duration_seconds", 30)))))
    request = str(job.get("request") or job.get("brief") or "Build momentum").strip()
    title = str(config.get("title") or job.get("title") or request).strip()[:72]
    hook = str(config.get("hook") or title or "STOP SCROLLING").strip()[:82]
    body_lines = split_body_lines(
        config.get("body_lines") or config.get("body_text"),
        job.get("brief") or request,
    )
    cta = str(config.get("cta") or "SHOW UP. STACK WINS. REPEAT.").strip()[:90]
    branding = str(config.get("branding") or "").strip()[:55]
    accent = str(config.get("accent_color") or "#67E8F9")
    background = str(config.get("background_color") or "#07111F")

    public_assets = REMOTION_COMPOSER / "public" / "bridge-assets" / safe_slug(job.get("id", project_dir.name))
    media_src, media_type = resolve_fast_asset(config.get("media") or job.get("media"), public_assets)
    audio_src, _ = resolve_fast_asset(config.get("audio") or job.get("audio"), public_assets)

    return {
        "durationSeconds": duration,
        "title": title,
        "hook": hook,
        "bodyLines": body_lines,
        "cta": cta,
        "branding": branding,
        "accentColor": accent,
        "backgroundColor": background,
        "mediaSrc": media_src,
        "mediaType": media_type,
        "audioSrc": audio_src,
    }


def run_fast_reel(job: dict, job_id: str, project_id: str, timeout_seconds: int):
    if not FAST_REEL_TEMPLATE.exists():
        raise RuntimeError(f"Fast Reel template missing: {FAST_REEL_TEMPLATE}")
    remotion_bin = REMOTION_COMPOSER / "node_modules" / ".bin" / "remotion"
    if not remotion_bin.exists():
        raise RuntimeError(f"OpenMontage Remotion runtime missing: {remotion_bin}")

    composer_template = REMOTION_COMPOSER / "src" / "NicholasFastReel.tsx"
    if not composer_template.exists() or composer_template.read_bytes() != FAST_REEL_TEMPLATE.read_bytes():
        shutil.copy2(FAST_REEL_TEMPLATE, composer_template)

    project_dir = OPENMONTAGE / "projects" / project_id
    work_dir = project_dir / "fast_reel"
    render_dir = project_dir / "renders"
    work_dir.mkdir(parents=True, exist_ok=True)
    render_dir.mkdir(parents=True, exist_ok=True)
    props = build_fast_reel_props(job, project_dir)
    props_path = work_dir / "props.json"
    props_path.write_text(json.dumps(props, indent=2) + "\n", encoding="utf-8")
    final_mp4 = render_dir / "final.mp4"

    started = time.monotonic()
    job_log = run_logged(
        [
            remotion_bin, "render", "src/NicholasFastReel.tsx", "FastReel",
            final_mp4, "--props", props_path, "--codec", "h264",
            "--concurrency", "4", "--log", "error",
        ],
        job_id,
        cwd=REMOTION_COMPOSER,
        timeout=timeout_seconds,
    )
    elapsed = round(time.monotonic() - started, 3)
    if not final_mp4.exists():
        raise RuntimeError(f"Fast Reel renderer returned without an MP4; see {job_log}")
    return final_mp4, job_log, props, elapsed


def complete_job(path: Path, job: dict, final_mp4: Path, job_log=None, render_metrics=None):
    project_id = job.get("project_id") or job.get("id") or path.stem
    ICLOUD_OUT.mkdir(parents=True, exist_ok=True)
    out_name = job.get("output_filename") or f"{project_id}.mp4"
    out_path = ICLOUD_OUT / out_name

    probe = probe_video(final_mp4)
    if job.get("render_mode_resolved") == "fast_reel":
        validate_fast_reel_probe(probe)
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
    qa = {"passed": True, "source_ffprobe": probe, "delivered_ffprobe": copied_probe}
    extra_paths = []
    if job.get("render_mode_resolved") == "fast_reel":
        duration = float((copied_probe.get("format") or {}).get("duration") or 0)
        preview_path = make_contact_sheet(out_path, job.get("id", path.stem), duration)
        job["preview_repo_path"] = str(preview_path.relative_to(QUEUE_REPO))
        qa["contact_sheet_created"] = True
        extra_paths.append(preview_path)
    job["qa"] = qa
    if render_metrics:
        job["render_metrics"] = render_metrics
    if job_log:
        job["execution_log"] = str(job_log)
    save_job(path, job)
    push_status(
        path,
        f"OpenMontage job {job.get('id', path.stem)}: completed",
        extra_paths=extra_paths,
    )
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


def complete_diagnostic(path: Path, job: dict):
    requested = job.get("diagnostic_job_ids") or []
    job["diagnostics"] = [log_diagnostic(str(job_id)) for job_id in requested]
    job["status"] = "completed"
    job["completed_at"] = utc_now()
    save_job(path, job)
    push_status(path, f"OpenMontage diagnostics {job.get('id', path.stem)}: completed")


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
    diagnostic_mode = job.get("execution_mode") == "diagnose_logs"
    if diagnostic_mode:
        render_mode, routing_reason = "diagnostic", "explicit log diagnostic request"
    elif job.get("execution_mode") == "direct_smoke_test":
        render_mode, routing_reason = "bridge_test", "explicit bridge smoke test"
    else:
        render_mode, routing_reason = classify_render_mode(job)
    timeout_default = 600 if render_mode == "fast_reel" else 3600
    timeout_seconds = int(job.get("timeout_seconds", timeout_default))

    job["render_mode_resolved"] = render_mode
    job["routing_reason"] = routing_reason

    job["status"] = "running"
    job["started_at"] = utc_now()
    job.pop("error", None)
    job.pop("failed_at", None)
    save_job(path, job)
    push_status(path, f"OpenMontage job {job_id}: running")

    try:
        if diagnostic_mode:
            complete_diagnostic(path, job)
            return True

        if job.get("execution_mode") == "direct_smoke_test":
            final_mp4, job_log = run_direct_smoke(
                job_id, project_id, timeout_seconds
            )
            complete_job(path, job, final_mp4, job_log)
            return True

        if render_mode == "fast_reel":
            final_mp4, job_log, props, elapsed = run_fast_reel(
                job, job_id, project_id, timeout_seconds
            )
            complete_job(
                path,
                job,
                final_mp4,
                job_log,
                render_metrics={
                    "renderer": "openmontage_remotion_fast_reel",
                    "render_seconds": elapsed,
                    "fps": 24,
                    "width": 1080,
                    "height": 1920,
                    "template": "templates/openmontage/fast_reel.tsx",
                    "props": props,
                },
            )
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
