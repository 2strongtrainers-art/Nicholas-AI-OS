#!/usr/bin/env python3
import json
import shutil
import subprocess
import sys
import tempfile
import textwrap
from pathlib import Path

WIDTH = 1080
HEIGHT = 1920
FPS = 30
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
BODY_FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"


def run(cmd, cwd=None):
    print("+", " ".join(str(x) for x in cmd))
    subprocess.run(cmd, cwd=cwd, check=True)


def wrap(text, width):
    return "\n".join(textwrap.wrap(text, width=width, break_long_words=False, break_on_hyphens=False))


def validate_job(job):
    required = ["workflow_id", "request", "created_at", "scenes"]
    missing = [k for k in required if k not in job]
    if missing:
        raise ValueError(f"Missing required fields: {', '.join(missing)}")
    if not isinstance(job["scenes"], list) or not job["scenes"]:
        raise ValueError("scenes must be a non-empty list")
    for i, scene in enumerate(job["scenes"], start=1):
        for key in ("headline", "body", "seconds"):
            if key not in scene:
                raise ValueError(f"scene {i} missing {key}")
        seconds = float(scene["seconds"])
        if seconds <= 0 or seconds > 30:
            raise ValueError(f"scene {i} seconds must be >0 and <=30")


def probe(path):
    raw = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries",
        "format=duration:stream=codec_type,width,height", "-of", "json", str(path)
    ], text=True)
    return json.loads(raw)


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: render_video.py jobs/<job>.json")

    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        raise SystemExit("ffmpeg and ffprobe are required")

    job_path = Path(sys.argv[1])
    job = json.loads(job_path.read_text(encoding="utf-8"))
    validate_job(job)

    output_dir = Path("output")
    output_dir.mkdir(exist_ok=True)
    output_name = job.get("output_filename") or f"{job_path.stem}.mp4"
    output_path = output_dir / output_name
    manifest_path = output_dir / f"{Path(output_name).stem}.manifest.json"

    expected_duration = sum(float(s["seconds"]) for s in job["scenes"])

    with tempfile.TemporaryDirectory(prefix="nicholas-ai-os-") as td:
        work = Path(td)
        segment_paths = []

        for idx, scene in enumerate(job["scenes"], start=1):
            seconds = float(scene["seconds"])
            headline_file = work / f"headline_{idx}.txt"
            body_file = work / f"body_{idx}.txt"
            headline_file.write_text(wrap(str(scene["headline"]), 24), encoding="utf-8")
            body_file.write_text(wrap(str(scene["body"]), 38), encoding="utf-8")

            segment = work / f"segment_{idx:02d}.mp4"
            segment_paths.append(segment)

            filter_graph = (
                "drawbox=x=72:y=250:w=936:h=8:color=white@0.85:t=fill,"
                f"drawtext=fontfile={FONT}:textfile={headline_file}:"
                "fontcolor=white:fontsize=76:line_spacing=18:"
                "x=(w-text_w)/2:y=420:fix_bounds=1,"
                f"drawtext=fontfile={BODY_FONT}:textfile={body_file}:"
                "fontcolor=white@0.90:fontsize=44:line_spacing=18:"
                "x=(w-text_w)/2:y=820:fix_bounds=1,"
                f"drawtext=fontfile={BODY_FONT}:text='NICHOLAS AI OS  •  GITHUB PROOF  •  {idx}/{len(job['scenes'])}':"
                "fontcolor=white@0.55:fontsize=26:x=(w-text_w)/2:y=h-170"
            )

            run([
                "ffmpeg", "-y",
                "-f", "lavfi", "-i", f"color=c=0x0d1117:s={WIDTH}x{HEIGHT}:r={FPS}:d={seconds}",
                "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
                "-vf", filter_graph,
                "-t", str(seconds), "-shortest",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                "-pix_fmt", "yuv420p", "-r", str(FPS),
                "-c:a", "aac", "-b:a", "128k",
                "-movflags", "+faststart", str(segment)
            ])

        concat_file = work / "concat.txt"
        concat_file.write_text("".join(f"file '{p.as_posix()}'\n" for p in segment_paths), encoding="utf-8")

        run([
            "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_file),
            "-c", "copy", "-movflags", "+faststart", str(output_path)
        ])

    media = probe(output_path)
    duration = float(media["format"]["duration"])
    video_streams = [s for s in media.get("streams", []) if s.get("codec_type") == "video"]
    audio_streams = [s for s in media.get("streams", []) if s.get("codec_type") == "audio"]
    if not video_streams:
        raise RuntimeError("QA failed: no video stream")
    video = video_streams[0]
    if int(video.get("width", 0)) != WIDTH or int(video.get("height", 0)) != HEIGHT:
        raise RuntimeError(f"QA failed: expected {WIDTH}x{HEIGHT}, got {video.get('width')}x{video.get('height')}")
    if abs(duration - expected_duration) > 1.0:
        raise RuntimeError(f"QA failed: expected ~{expected_duration}s, got {duration}s")
    if not audio_streams:
        raise RuntimeError("QA failed: no audio stream")

    manifest = {
        "job": str(job_path),
        "workflow_id": job["workflow_id"],
        "request": job["request"],
        "proof_mode": True,
        "render": {
            "output": str(output_path),
            "width": WIDTH,
            "height": HEIGHT,
            "fps": FPS,
            "duration_seconds": duration,
            "expected_duration_seconds": expected_duration,
            "has_video": True,
            "has_audio": True
        },
        "qa": "passed",
        "production_upgrades_pending": ["ElevenLabs narration", "licensed/generated visual assets", "captions synced to narration"]
    }
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
