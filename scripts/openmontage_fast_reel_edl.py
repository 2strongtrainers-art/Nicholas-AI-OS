#!/usr/bin/env python3
"""Deterministic multi-clip edit support for the OpenMontage Fast Reel path.

ChatGPT can supply an edit decision list in ``fast_reel.clips``. The Mac worker
normalizes those source clips into one vertical H.264 timeline with FFmpeg, then
hands the assembled media to the existing Remotion Fast Reel renderer. This
keeps normal social edits fast and auditable without invoking the autonomous
full-production pipeline.
"""

from __future__ import annotations

import copy
from pathlib import Path
from typing import Any

MAX_CLIPS = 12
VIDEO_EXTENSIONS = {".mp4", ".mov", ".m4v", ".webm", ".mkv"}
_MISSING = object()


def _float(value: Any, field: str, default: float | None = None) -> float | None:
    if value in (None, ""):
        return default
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise RuntimeError(f"Fast Reel clip {field} must be numeric") from exc


def normalize_clip_specs(config: dict) -> list[dict]:
    """Validate and normalize ``fast_reel.clips`` without touching the filesystem."""
    raw_clips = config.get("clips")
    if raw_clips in (None, []):
        return []
    if not isinstance(raw_clips, list):
        raise RuntimeError("fast_reel.clips must be an array")
    if not 1 <= len(raw_clips) <= MAX_CLIPS:
        raise RuntimeError(f"fast_reel.clips must contain 1-{MAX_CLIPS} clips")

    normalized: list[dict] = []
    for index, raw_item in enumerate(raw_clips, start=1):
        if isinstance(raw_item, str):
            item = {"media": raw_item}
        elif isinstance(raw_item, dict):
            item = copy.deepcopy(raw_item)
        else:
            raise RuntimeError(f"fast_reel.clips[{index - 1}] must be a string or object")

        source = str(item.get("media") or item.get("src") or item.get("path") or "").strip()
        if not source:
            raise RuntimeError(f"fast_reel.clips[{index - 1}] is missing media/src/path")
        if source.lower().startswith(("http://", "https://")):
            raise RuntimeError(
                "fast_reel.clips accepts local video paths only; remote URLs are rejected "
                "to keep signed URLs and credentials out of worker logs"
            )

        start = max(0.0, _float(item.get("start_seconds"), "start_seconds", 0.0) or 0.0)
        end = _float(item.get("end_seconds"), "end_seconds")
        duration = _float(item.get("duration_seconds"), "duration_seconds")
        if end is not None:
            duration = end - start
        if duration is not None and duration <= 0:
            raise RuntimeError(f"fast_reel.clips[{index - 1}] must have positive duration")

        normalized.append(
            {
                "source": source,
                "start_seconds": round(start, 3),
                "duration_seconds": round(duration, 3) if duration is not None else None,
            }
        )
    return normalized


def _resolve_source(worker, raw: str) -> str:
    candidate = Path(raw).expanduser()
    candidates = [candidate] if candidate.is_absolute() else [worker.QUEUE_REPO / candidate, worker.OPENMONTAGE / candidate]
    source = next((path for path in candidates if path.is_file()), None)
    if not source:
        raise RuntimeError(f"Fast Reel EDL source not found: {raw}")
    if source.suffix.lower() not in VIDEO_EXTENSIONS:
        raise RuntimeError(f"Fast Reel EDL source must be a video file: {source.name}")
    return str(source)


def build_edl_video(worker, job: dict, job_id: str, project_id: str, timeout_seconds: int) -> Path | None:
    config = job.get("fast_reel") if isinstance(job.get("fast_reel"), dict) else {}
    specs = normalize_clip_specs(config)
    if not specs:
        return None

    project_dir = worker.OPENMONTAGE / "projects" / project_id
    edl_dir = project_dir / "fast_reel" / "edl"
    edl_dir.mkdir(parents=True, exist_ok=True)
    output = edl_dir / "assembled.mp4"
    output.unlink(missing_ok=True)

    cmd: list[Any] = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"]
    resolved_specs = []
    for spec in specs:
        source = _resolve_source(worker, spec["source"])
        start = float(spec["start_seconds"])
        duration = spec["duration_seconds"]
        if start > 0:
            cmd.extend(["-ss", f"{start:.3f}"])
        if duration is not None:
            cmd.extend(["-t", f"{float(duration):.3f}"])
        cmd.extend(["-i", source])
        resolved_specs.append({**spec, "resolved_source": source})

    filters = []
    video_labels = []
    for index in range(len(resolved_specs)):
        label = f"v{index}"
        filters.append(
            f"[{index}:v]scale=1080:1920:force_original_aspect_ratio=increase,"
            f"crop=1080:1920,fps=24,setsar=1,setpts=PTS-STARTPTS,format=yuv420p[{label}]"
        )
        video_labels.append(f"[{label}]")
    filters.append("".join(video_labels) + f"concat=n={len(video_labels)}:v=1:a=0[concatv]")
    # If selected clips are shorter than the requested Reel, hold the last frame
    # rather than returning a short media stream under a longer Remotion composition.
    filters.append("[concatv]tpad=stop_mode=clone:stop_duration=90[outv]")

    target_duration = _float(config.get("duration_seconds", job.get("duration_seconds", 30)), "duration_seconds", 30.0) or 30.0
    target_duration = max(15.0, min(90.0, target_duration))
    cmd.extend(
        [
            "-filter_complex",
            ";".join(filters),
            "-map",
            "[outv]",
            "-an",
            "-t",
            f"{target_duration:.3f}",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "21",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            output,
        ]
    )

    try:
        worker.run(cmd, cwd=worker.OPENMONTAGE, timeout=max(120, min(int(timeout_seconds), 600)))
    except Exception as exc:
        raise RuntimeError(f"Fast Reel EDL assembly failed for {job_id}: {exc}") from exc

    if not output.is_file() or output.stat().st_size <= 0:
        raise RuntimeError("Fast Reel EDL assembly returned without a usable MP4")

    probe = worker.probe_video(output)
    stream = (probe.get("streams") or [{}])[0]
    fmt = probe.get("format") or {}
    width = int(stream.get("width", 0))
    height = int(stream.get("height", 0))
    duration = float(fmt.get("duration") or stream.get("duration") or 0)
    if (width, height) != (1080, 1920):
        raise RuntimeError("Fast Reel EDL assembly failed 1080x1920 validation")
    if abs(duration - target_duration) > 0.75:
        raise RuntimeError(
            f"Fast Reel EDL duration validation failed: got {duration:.3f}s, "
            f"expected about {target_duration:.3f}s"
        )

    job["fast_reel_edl"] = {
        "clip_count": len(specs),
        "source_names": [Path(spec["source"]).name for spec in specs],
        "target_duration_seconds": target_duration,
        "assembled": True,
        "video_only": True,
        "qa": {"width": width, "height": height, "duration_seconds": duration},
    }
    return output


def install(resilient_module, worker_module) -> None:
    """Patch the resilient Fast Reel runner once, leaving the proven base path intact."""
    if getattr(resilient_module, "_fast_reel_edl_installed", False):
        return

    original = resilient_module.resilient_run_fast_reel

    def run_with_edl(job: dict, job_id: str, project_id: str, timeout_seconds: int):
        config = job.get("fast_reel") if isinstance(job.get("fast_reel"), dict) else None
        if not config or not config.get("clips"):
            return original(job, job_id, project_id, timeout_seconds)

        assembled = build_edl_video(worker_module, job, job_id, project_id, timeout_seconds)
        if assembled is None:
            return original(job, job_id, project_id, timeout_seconds)

        previous_media = config.get("media", _MISSING)
        config["media"] = str(assembled)
        try:
            return original(job, job_id, project_id, timeout_seconds)
        finally:
            if previous_media is _MISSING:
                config.pop("media", None)
            else:
                config["media"] = previous_media

    resilient_module.resilient_run_fast_reel = run_with_edl
    resilient_module._fast_reel_edl_installed = True
