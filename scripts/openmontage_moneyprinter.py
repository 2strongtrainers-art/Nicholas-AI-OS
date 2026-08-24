#!/usr/bin/env python3
"""MoneyPrinterTurbo sidecar for Nicholas-AI-OS Fast Reel jobs.

This module keeps the existing OpenMontage/Remotion renderer as a fallback.
When MoneyPrinterTurbo is selected (or is the configured default), it can:

- bootstrap a pinned MoneyPrinterTurbo checkout on the Mac;
- reuse local clips or source portrait stock footage through MoneyPrinterTurbo;
- reuse a prepared voiceover audio file, or an explicitly configured TTS voice;
- render a 9:16 MP4 through MoneyPrinterTurbo's CLI;
- validate the output before handing it back to the existing delivery/QA path.

No API keys are stored in this repository. Provider keys are read from the Mac
environment and copied only into MoneyPrinterTurbo's ignored local config.toml.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import sys
import time
from pathlib import Path
from typing import Any

MPT_REPO_URL = "https://github.com/harry0703/MoneyPrinterTurbo.git"
MPT_PINNED_COMMIT = "110997c15abd1660b00add8e41feefedb3df6a8c"
MPT_DIR = Path.home() / "MoneyPrinterTurbo"
BOOTSTRAP_DIR = Path.home() / ".cache" / "nicholas-ai-os" / "moneyprinter-bootstrap"
SUPPORTED_ONLINE_SOURCES = {"pexels", "pixabay", "coverr"}
ENGINE_ALIASES = {"moneyprinter", "moneyprinterturbo", "moneyprinter_turbo", "mpt"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".m4v", ".webm", ".mkv"}
AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"}

_PROVIDER_ENV_KEYS = {
    "pexels": ("PEXELS_API_KEY", "PEXELS_API_KEYS"),
    "pixabay": ("PIXABAY_API_KEY", "PIXABAY_API_KEYS"),
    "coverr": ("COVERR_API_KEY", "COVERR_API_KEYS"),
}


def _fast_config(job: dict) -> dict:
    value = job.get("fast_reel")
    return value if isinstance(value, dict) else {}


def _moneyprinter_config(job: dict) -> dict:
    config = _fast_config(job).get("moneyprinter")
    return config if isinstance(config, dict) else {}


def _as_bool(value: Any, default: bool) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() not in {"0", "false", "no", "off", "disabled"}


def should_use_moneyprinter(job: dict) -> bool:
    """Return whether a normal Fast Reel should prefer MoneyPrinterTurbo."""
    cfg = _moneyprinter_config(job)
    if cfg.get("enabled") is False:
        return False

    explicit = str(
        job.get("render_engine")
        or _fast_config(job).get("render_engine")
        or cfg.get("engine")
        or ""
    ).strip().lower()
    if explicit:
        return explicit in ENGINE_ALIASES

    default_engine = os.getenv("NICHOLAS_FAST_REEL_ENGINE", "moneyprinter").strip().lower()
    return default_engine in ENGINE_ALIASES


def _resolve_local_path(worker, raw: str, allowed_extensions: set[str]) -> Path | None:
    value = str(raw or "").strip()
    if not value or value.lower().startswith(("http://", "https://")):
        return None
    candidate = Path(value).expanduser()
    candidates = [candidate] if candidate.is_absolute() else [
        worker.QUEUE_REPO / candidate,
        worker.OPENMONTAGE / candidate,
    ]
    source = next((path for path in candidates if path.is_file()), None)
    if not source or source.suffix.lower() not in allowed_extensions:
        return None
    return source.resolve()


def _collect_local_materials(worker, job: dict) -> list[Path]:
    config = _fast_config(job)
    result: list[Path] = []
    raw_clips = config.get("clips")
    if isinstance(raw_clips, list):
        for item in raw_clips:
            raw = item if isinstance(item, str) else (
                item.get("media") or item.get("src") or item.get("path")
                if isinstance(item, dict)
                else ""
            )
            path = _resolve_local_path(worker, str(raw or ""), VIDEO_EXTENSIONS)
            if path and path not in result:
                result.append(path)

    if not result:
        raw = config.get("media") or job.get("media")
        path = _resolve_local_path(worker, str(raw or ""), VIDEO_EXTENSIONS)
        if path:
            result.append(path)
    return result[:12]


def _resolve_audio(worker, job: dict) -> Path | None:
    config = _fast_config(job)
    raw = config.get("audio") or job.get("audio")
    return _resolve_local_path(worker, str(raw or ""), AUDIO_EXTENSIONS)


def _clean_term(value: str) -> str:
    text = re.sub(r"[^A-Za-z0-9 '&+-]+", " ", str(value or ""))
    return re.sub(r"\s+", " ", text).strip(" -")[:70]


def _terms_from_job(job: dict) -> list[str]:
    cfg = _moneyprinter_config(job)
    fast = _fast_config(job)

    raw = (
        cfg.get("video_terms")
        or cfg.get("broll_queries")
        or fast.get("video_terms")
        or fast.get("broll_queries")
    )
    if isinstance(raw, str):
        values = re.split(r"[,|\n]+", raw)
    elif isinstance(raw, list):
        values = [str(item) for item in raw]
    else:
        values = []

    cleaned: list[str] = []
    for item in values:
        term = _clean_term(item)
        if term and term.lower() not in {x.lower() for x in cleaned}:
            cleaned.append(term)
    if cleaned:
        return cleaned[:8]

    # Deterministic no-LLM fallback: derive a few useful search phrases from
    # the job's own title/hook/body instead of requiring another API call.
    candidates = [
        fast.get("hook"),
        fast.get("title"),
        job.get("title"),
        job.get("request"),
        job.get("brief"),
    ]
    body_lines = fast.get("body_lines")
    if isinstance(body_lines, list):
        candidates.extend(body_lines[:3])

    stop = {
        "the", "and", "for", "with", "from", "that", "this", "your", "you",
        "into", "about", "make", "reel", "video", "short", "instagram", "tiktok",
        "youtube", "why", "how", "what", "when", "where", "are", "was", "were",
        "have", "has", "had", "our", "but", "not", "all", "can", "will",
    }
    words: list[str] = []
    for candidate in candidates:
        for token in re.findall(r"[A-Za-z][A-Za-z0-9'-]{2,}", str(candidate or "")):
            lower = token.lower()
            if lower in stop or lower in {w.lower() for w in words}:
                continue
            words.append(token)
            if len(words) >= 12:
                break
        if len(words) >= 12:
            break

    if not words:
        return ["fitness training", "athletic performance"]
    terms = []
    for start in range(0, min(len(words), 8), 2):
        term = _clean_term(" ".join(words[start:start + 3]))
        if term:
            terms.append(term)
    return terms[:6] or [_clean_term(" ".join(words[:4]))]


def _script_from_job(job: dict) -> str:
    cfg = _moneyprinter_config(job)
    fast = _fast_config(job)
    explicit = (
        cfg.get("video_script")
        or cfg.get("voiceover_script")
        or fast.get("video_script")
        or fast.get("voiceover_script")
        or job.get("script")
    )
    if explicit:
        return str(explicit).strip()

    parts = []
    for key in ("hook", "title"):
        value = fast.get(key)
        if value and str(value).strip() not in parts:
            parts.append(str(value).strip())
    body = fast.get("body_lines")
    if isinstance(body, list):
        parts.extend(str(item).strip() for item in body if str(item).strip())
    elif fast.get("body_text"):
        parts.append(str(fast.get("body_text")).strip())
    if fast.get("cta"):
        parts.append(str(fast.get("cta")).strip())

    if not parts:
        fallback = job.get("brief") or job.get("request") or "Build momentum."
        parts.append(str(fallback).strip())
    return " ".join(parts)


def _escape_toml(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def _set_toml_assignment(text: str, key: str, replacement: str) -> str:
    pattern = re.compile(rf"(?m)^{re.escape(key)}\s*=.*$")
    if pattern.search(text):
        return pattern.sub(f"{key} = {replacement}", text, count=1)
    return text.rstrip() + f"\n{key} = {replacement}\n"


def _sync_local_config(worker, provider: str, use_custom_audio: bool) -> None:
    example = MPT_DIR / "config.example.toml"
    config_path = MPT_DIR / "config.toml"
    if not config_path.exists():
        if not example.exists():
            raise RuntimeError("MoneyPrinterTurbo config.example.toml is missing")
        shutil.copy2(example, config_path)

    text = config_path.read_text(encoding="utf-8")
    for source, names in _PROVIDER_ENV_KEYS.items():
        value = next((os.getenv(name, "").strip() for name in names if os.getenv(name, "").strip()), "")
        if value:
            text = _set_toml_assignment(
                text,
                f"{source}_api_keys",
                f'["{_escape_toml(value)}"]',
            )

    if use_custom_audio:
        text = _set_toml_assignment(text, "subtitle_provider", '"whisper"')

    config_path.write_text(text, encoding="utf-8")
    worker.log(
        f"MONEYPRINTER CONFIG READY provider={provider} "
        f"custom_audio={bool(use_custom_audio)} secrets=redacted"
    )


def _find_python3() -> str:
    for name in ("python3.13", "python3.12", "python3.11", "python3"):
        path = shutil.which(name)
        if path:
            return path
    if sys.executable:
        return sys.executable
    raise RuntimeError("Python 3 is required to bootstrap MoneyPrinterTurbo")


def _bootstrap_uv(worker) -> Path:
    bootstrap_python = BOOTSTRAP_DIR / "bin" / "python"
    if not bootstrap_python.exists():
        BOOTSTRAP_DIR.parent.mkdir(parents=True, exist_ok=True)
        python3 = _find_python3()
        worker.run([python3, "-m", "venv", BOOTSTRAP_DIR], timeout=180)
        worker.run(
            [bootstrap_python, "-m", "pip", "install", "--disable-pip-version-check", "uv"],
            timeout=300,
        )
    return bootstrap_python


def ensure_moneyprinter(worker, auto_install: bool = True) -> Path:
    """Return MoneyPrinterTurbo's managed Python interpreter."""
    cli = MPT_DIR / "cli.py"
    if not cli.exists():
        if not auto_install:
            raise RuntimeError("MoneyPrinterTurbo is not installed on this Mac")
        worker.log("MONEYPRINTER BOOTSTRAP: cloning pinned repository")
        MPT_DIR.parent.mkdir(parents=True, exist_ok=True)
        worker.run(
            ["git", "clone", "--depth", "1", MPT_REPO_URL, MPT_DIR],
            timeout=300,
        )
        worker.run(
            ["git", "fetch", "--depth", "1", "origin", MPT_PINNED_COMMIT],
            cwd=MPT_DIR,
            timeout=180,
        )
        worker.run(
            ["git", "checkout", "--detach", MPT_PINNED_COMMIT],
            cwd=MPT_DIR,
            timeout=120,
        )

    managed_python = MPT_DIR / ".venv" / "bin" / "python"
    if managed_python.exists():
        return managed_python
    if not auto_install:
        raise RuntimeError("MoneyPrinterTurbo dependencies are not installed")

    worker.log("MONEYPRINTER BOOTSTRAP: installing locked dependencies with uv")
    bootstrap_python = _bootstrap_uv(worker)
    worker.run(
        [bootstrap_python, "-m", "uv", "sync", "--frozen", "--no-dev"],
        cwd=MPT_DIR,
        timeout=1200,
    )
    if not managed_python.exists():
        raise RuntimeError("MoneyPrinterTurbo uv sync completed without .venv/bin/python")
    return managed_python


def _append_job_log(worker, job_id: str, stdout: str, stderr: str) -> Path:
    worker.JOB_LOG_DIR.mkdir(parents=True, exist_ok=True)
    path = worker.JOB_LOG_DIR / f"{worker.safe_slug(job_id)}.log"
    with path.open("a", encoding="utf-8") as handle:
        handle.write(f"\n=== {worker.utc_now()} MONEYPRINTER ===\n")
        if stdout:
            handle.write(worker.sanitize_log_text(stdout))
            handle.write("\n")
        if stderr:
            handle.write(worker.sanitize_log_text(stderr))
            handle.write("\n")
    return path


def _parse_cli_payload(stdout: str) -> dict:
    lines = [line.strip() for line in str(stdout or "").splitlines() if line.strip()]
    for line in reversed(lines):
        if not line.startswith("{"):
            continue
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(payload, dict):
            return payload
    raise RuntimeError("MoneyPrinterTurbo CLI did not return its JSON result")


def _collect_mp4_strings(value: Any) -> list[str]:
    found: list[str] = []
    if isinstance(value, str):
        if value.lower().split("?", 1)[0].endswith(".mp4"):
            found.append(value)
    elif isinstance(value, dict):
        for item in value.values():
            found.extend(_collect_mp4_strings(item))
    elif isinstance(value, (list, tuple)):
        for item in value:
            found.extend(_collect_mp4_strings(item))
    return found


def _resolve_result_mp4(payload: dict) -> Path:
    candidates = _collect_mp4_strings(payload.get("result", payload))
    for raw in reversed(candidates):
        if str(raw).lower().startswith(("http://", "https://")):
            continue
        path = Path(str(raw)).expanduser()
        if not path.is_absolute():
            path = MPT_DIR / path
        if path.is_file():
            return path.resolve()
    raise RuntimeError("MoneyPrinterTurbo reported success but no local MP4 was found")


def _build_cli_args(worker, job: dict, python_bin: Path) -> tuple[list[Any], dict]:
    cfg = _moneyprinter_config(job)
    script = _script_from_job(job)
    terms = _terms_from_job(job)
    local_materials = _collect_local_materials(worker, job)
    audio = _resolve_audio(worker, job)

    source = str(cfg.get("video_source") or os.getenv("MPT_VIDEO_SOURCE", "pexels")).strip().lower()
    if local_materials:
        source = "local"
    elif source not in SUPPORTED_ONLINE_SOURCES:
        raise RuntimeError(f"Unsupported MoneyPrinterTurbo video source: {source}")

    _sync_local_config(worker, source, bool(audio))

    cmd: list[Any] = [
        python_bin,
        MPT_DIR / "cli.py",
        "--video-script",
        script,
        "--video-aspect",
        "9:16",
        "--video-source",
        source,
        "--video-count",
        "1",
        "--video-clip-duration",
        str(int(cfg.get("clip_duration_seconds") or 4)),
        "--video-concat-mode",
        str(cfg.get("concat_mode") or "sequential"),
        "--match-materials-to-script",
        "--bgm-type",
        str(cfg.get("bgm_type") or "none"),
        "--subtitle-enabled",
        "--subtitle-position",
        str(cfg.get("subtitle_position") or "center"),
        "--font-size",
        str(int(cfg.get("font_size") or 68)),
        "--stroke-width",
        str(float(cfg.get("stroke_width") or 2.0)),
        "--stop-at",
        "video",
    ]

    if source == "local":
        cmd.extend(["--video-materials", ",".join(str(path) for path in local_materials)])
    elif terms:
        cmd.extend(["--video-terms", ",".join(terms)])

    if audio:
        cmd.extend(["--custom-audio-file", str(audio)])
    else:
        voice_name = str(cfg.get("voice_name") or os.getenv("MPT_VOICE_NAME", "")).strip()
        voice_id = os.getenv("MPT_ELEVENLABS_VOICE_ID", "").strip()
        if not voice_name and voice_id:
            voice_name = f"elevenlabs:{voice_id}:August Nick"
        if voice_name:
            cmd.extend(["--voice-name", voice_name])
        elif not _as_bool(cfg.get("allow_default_tts"), False):
            raise RuntimeError(
                "MoneyPrinterTurbo needs a local voiceover audio file or "
                "MPT_VOICE_NAME/MPT_ELEVENLABS_VOICE_ID"
            )

    metadata = {
        "engine": "moneyprinter_turbo",
        "upstream_commit": MPT_PINNED_COMMIT,
        "video_source": source,
        "video_terms": terms,
        "local_material_count": len(local_materials),
        "custom_audio": bool(audio),
        "script_characters": len(script),
    }
    return cmd, metadata


def run_moneyprinter(worker, job: dict, job_id: str, project_id: str, timeout_seconds: int):
    cfg = _moneyprinter_config(job)
    auto_install = _as_bool(cfg.get("auto_install"), True)
    python_bin = ensure_moneyprinter(worker, auto_install=auto_install)
    cmd, metadata = _build_cli_args(worker, job, python_bin)

    worker.log(
        f"MONEYPRINTER START {job_id}: source={metadata['video_source']} "
        f"terms={len(metadata['video_terms'])} local={metadata['local_material_count']}"
    )
    started = time.monotonic()
    try:
        result = worker.run(
            cmd,
            cwd=MPT_DIR,
            timeout=max(int(timeout_seconds), int(cfg.get("timeout_seconds") or 900)),
        )
    except Exception as exc:
        raise RuntimeError(f"MoneyPrinterTurbo CLI failed: {exc}") from exc

    elapsed = round(time.monotonic() - started, 3)
    job_log = _append_job_log(worker, job_id, result.stdout, result.stderr)
    payload = _parse_cli_payload(result.stdout)
    source_mp4 = _resolve_result_mp4(payload)

    project_dir = worker.OPENMONTAGE / "projects" / project_id
    render_dir = project_dir / "renders"
    render_dir.mkdir(parents=True, exist_ok=True)
    final_mp4 = render_dir / "moneyprinter-final.mp4"
    shutil.copy2(source_mp4, final_mp4)

    probe = worker.probe_video(final_mp4)
    stream = (probe.get("streams") or [{}])[0]
    fmt = probe.get("format") or {}
    width = int(stream.get("width", 0))
    height = int(stream.get("height", 0))
    duration = float(fmt.get("duration") or stream.get("duration") or 0)
    codec = str(stream.get("codec_name") or "")
    if (width, height) != (1080, 1920):
        raise RuntimeError(
            f"MoneyPrinterTurbo output was {width}x{height}; expected 1080x1920"
        )
    if codec != "h264":
        raise RuntimeError(f"MoneyPrinterTurbo output codec was {codec!r}; expected h264")
    if not 14.5 <= duration <= 90.5:
        raise RuntimeError(
            f"MoneyPrinterTurbo output duration was {duration:.3f}s; expected 15-90s"
        )

    metadata["duration_seconds"] = duration
    metadata["width"] = width
    metadata["height"] = height
    metadata["codec"] = codec
    metadata["render_seconds"] = elapsed
    job["moneyprinter"] = metadata
    worker.log(f"MONEYPRINTER COMPLETED {job_id}: {final_mp4}")
    return final_mp4, job_log, metadata, elapsed


def install(resilient_module, worker_module) -> None:
    """Prefer MoneyPrinterTurbo for Fast Reel, falling back on any failure."""
    if getattr(resilient_module, "_moneyprinter_fast_reel_installed", False):
        return

    original = resilient_module.resilient_run_fast_reel

    def run_with_moneyprinter(job: dict, job_id: str, project_id: str, timeout_seconds: int):
        if not should_use_moneyprinter(job):
            return original(job, job_id, project_id, timeout_seconds)

        cfg = _moneyprinter_config(job)
        fallback = _as_bool(cfg.get("fallback_to_openmontage"), True)
        try:
            return run_moneyprinter(
                worker_module,
                job,
                job_id,
                project_id,
                timeout_seconds,
            )
        except Exception as exc:
            job["moneyprinter_fallback"] = {
                "used": bool(fallback),
                "error": worker_module.sanitize_log_text(str(exc))[:2000],
            }
            worker_module.log(
                f"MONEYPRINTER FAILED {job_id}: "
                f"{worker_module.sanitize_log_text(str(exc))}; "
                f"fallback={fallback}"
            )
            if not fallback:
                raise
            return original(job, job_id, project_id, timeout_seconds)

    resilient_module.resilient_run_fast_reel = run_with_moneyprinter
    resilient_module._moneyprinter_fast_reel_installed = True
