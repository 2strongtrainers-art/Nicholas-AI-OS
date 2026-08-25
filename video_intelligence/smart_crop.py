"""Deterministic 9:16 crop helpers for OpenMontage source clips."""

from __future__ import annotations

import subprocess
from pathlib import Path


def _bounded_focus(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def crop_filter(focus_x: float = 0.5, focus_y: float = 0.5) -> str:
    """Return an FFmpeg filter that scales to cover 1080x1920 then crops around focus."""
    fx = _bounded_focus(focus_x)
    fy = _bounded_focus(focus_y)
    return (
        "scale=1080:1920:force_original_aspect_ratio=increase,"
        f"crop=1080:1920:x='max(0,min(iw-1080,(iw-1080)*{fx:.6f}))':"
        f"y='max(0,min(ih-1920,(ih-1920)*{fy:.6f}))',"
        "fps=24,setsar=1,format=yuv420p"
    )


def render_vertical_clip(
    source: str,
    output: str,
    start_seconds: float,
    end_seconds: float,
    focus_x: float = 0.5,
    focus_y: float = 0.5,
    timeout: int = 600,
) -> Path:
    src = Path(source).expanduser()
    dst = Path(output).expanduser()
    if not src.is_file():
        raise FileNotFoundError(src)
    if end_seconds <= start_seconds:
        raise ValueError("end_seconds must be greater than start_seconds")
    dst.parent.mkdir(parents=True, exist_ok=True)
    duration = float(end_seconds) - float(start_seconds)
    cmd = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-ss", f"{float(start_seconds):.3f}",
        "-t", f"{duration:.3f}",
        "-i", str(src),
        "-vf", crop_filter(focus_x, focus_y),
        "-an",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "21",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        str(dst),
    ]
    subprocess.run(cmd, check=True, timeout=timeout)
    if not dst.is_file() or dst.stat().st_size <= 0:
        raise RuntimeError("smart crop render did not produce a usable MP4")
    return dst
