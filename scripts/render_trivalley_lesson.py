#!/usr/bin/env python3
"""Render local, approved lesson assets; no provider calls or publication.

Extends the existing TriValley FFmpeg/Pillow method to one continuous narration,
source-document stills, synchronized avatar shots and optional word-timed captions.
All asset paths are relative to the private job folder. Never commit that folder.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFont

WIDTH, HEIGHT, FPS = 720, 1280, 24
ID = re.compile(r"[a-z0-9][a-z0-9-]{2,79}")
FONT = Path("/usr/share/fonts/truetype/noto/NotoSansDisplay-Bold.ttf")
IMAGE = {".png", ".jpg", ".jpeg", ".webp"}
VIDEO = {".mp4", ".mov", ".m4v", ".webm"}
AUDIO = {".mp3", ".wav", ".m4a", ".aac", ".flac"}


def command(args, timeout=300, capture=False):
    return subprocess.run(args, check=True, timeout=timeout,
                          capture_output=capture, text=capture)


def ffmpeg(*args, timeout=300, capture=False):
    return command(["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
                    *map(str, args)], timeout, capture)


def probe(path):
    return json.loads(command(["ffprobe", "-v", "error", "-show_format", "-show_streams",
                               "-of", "json", str(path)], 30, True).stdout)


def number(value, field, low=0, high=600):
    if type(value) not in (int, float) or not math.isfinite(value) or not low <= value <= high:
        raise ValueError(f"{field} must be a finite number from {low} to {high}.")
    return float(value)


def source(folder, value, suffixes):
    if not isinstance(value, str) or not value or "\\" in value:
        raise ValueError("Asset must be a relative POSIX path.")
    name = Path(value)
    if name.is_absolute() or ".." in name.parts:
        raise ValueError("Asset must stay inside the private job folder.")
    current = folder
    for part in name.parts:
        current /= part
        if current.is_symlink():
            raise ValueError("Asset symlinks are not supported.")
    path = folder / name
    if path.suffix.lower() not in suffixes or not path.is_file():
        raise ValueError(f"Missing or unsupported asset: {value}")
    return path


def load_job(path):
    folder = path.parent.resolve()
    job = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(job, dict) or job.get("schema_version") != 1 or not ID.fullmatch(str(job.get("episode_id", ""))):
        raise ValueError("A version 1 job and valid episode_id are required.")
    if job.get("language") not in ("en", "es"):
        raise ValueError("This renderer currently validates English or Spanish jobs.")
    job["duration"] = number(job.get("duration"), "duration", 8, 180)
    job["narration_path"] = source(folder, job.get("narration"), AUDIO)
    for key in ("music",):
        job[key + "_path"] = source(folder, job[key], AUDIO) if job.get(key) else None
    shots = job.get("shots")
    if not isinstance(shots, list) or not 1 <= len(shots) <= 40:
        raise ValueError("Provide between 1 and 40 shots.")
    prior = 0.0
    for i, shot in enumerate(shots):
        if not isinstance(shot, dict) or shot.get("kind") not in ("image", "video"):
            raise ValueError("Shot kind must be image or video.")
        shot["start"] = number(shot.get("start"), f"shot {i} start", 0, job["duration"])
        shot["end"] = number(shot.get("end"), f"shot {i} end", 0, job["duration"])
        if abs(shot["start"] - prior) > .001 or shot["end"] <= shot["start"]:
            raise ValueError("Shot timeline must be contiguous with positive durations.")
        shot["frames"] = round(shot["end"] * FPS) - round(shot["start"] * FPS)
        if shot["frames"] < 1:
            raise ValueError("A shot must contain at least one frame.")
        shot["source_path"] = source(folder, shot.get("source"), IMAGE if shot["kind"] == "image" else VIDEO)
        shot["offset"] = number(shot.get("offset", 0), "source offset", 0, 7200)
        shot["overlay_path"] = source(folder, shot["overlay"], IMAGE) if shot.get("overlay") else None
        prior = shot["end"]
    if abs(prior - job["duration"]) > .001:
        raise ValueError("Shots must cover the complete duration.")
    if job.get("transcript"):
        transcript = source(folder, job["transcript"], {".json"})
        raw = json.loads(transcript.read_text(encoding="utf-8"))
        job["words"] = raw.get("words", []) if isinstance(raw, dict) else raw
    else:
        job["words"] = []
    if not isinstance(job["words"], list):
        raise ValueError("Transcript words must be an array.")
    clean_words, previous = [], -1.0
    for word in job["words"]:
        if not isinstance(word, dict) or not isinstance(word.get("text"), str):
            raise ValueError("Each transcript word requires text and measured start/end timestamps.")
        if word.get("type", "word") != "word" or re.fullmatch(r"\[[^]]+\]", word["text"].strip()):
            continue
        text = word.get("text")
        if not isinstance(text, str) or not text.strip() or len(text) > 120:
            raise ValueError("Caption words must be nonempty bounded text.")
        start = number(word.get("start"), "word start", 0, job["duration"])
        end = number(word.get("end"), "word end", 0, job["duration"])
        if start < previous or end <= start:
            raise ValueError("Transcript word timestamps must be chronological and positive.")
        clean_words.append({"text": text.strip(), "start": start, "end": end})
        previous = start
    job["words"] = clean_words
    cues = job.get("captions", [])
    if not isinstance(cues, list):
        raise ValueError("captions must be an array.")
    previous = 0
    for cue in cues:
        if not isinstance(cue, dict):
            raise ValueError("Each caption cue must be an object.")
        start = number(cue.get("start"), "caption start", 0, job["duration"])
        end = number(cue.get("end"), "caption end", 0, job["duration"])
        text = cue.get("text")
        if start < previous or end <= start or not isinstance(text, str) or not text.strip() or len(text) > 160:
            raise ValueError("Caption cues must be ordered, non-overlapping, and bounded.")
        previous = end
    if not clean_words and not cues:
        raise ValueError("Supply actual timed words or manually reviewed timed caption cues.")
    return job


def timecode(seconds, srt=False):
    scale = 1000 if srt else 100
    value = round(seconds * scale)
    h, rem = divmod(value, 3600 * scale)
    m, rem = divmod(rem, 60 * scale)
    s, frac = divmod(rem, scale)
    return f"{h:02d}:{m:02d}:{s:02d},{frac:03d}" if srt else f"{h}:{m:02d}:{s:02d}.{frac:02d}"


def ass_text(text):
    # Source text cannot introduce ASS formatting or forced subtitle commands.
    return text.replace("\\", "").replace("{", "").replace("}", "").replace("\n", " ")


def caption_files(job, output):
    if not FONT.is_file():
        raise RuntimeError(f"Required caption font is unavailable: {FONT}")
    face = ImageFont.truetype(str(FONT), 39)
    measure = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    groups, current = [], []
    for word in job["words"]:
        candidate = " ".join(w["text"] for w in current + [word])
        if current and (len(current) >= 6 or len(candidate) > 48 or word["start"] - current[0]["start"] > 2.8):
            groups.append(current)
            current = []
        current.append(word)
        if re.search(r"[.!?]$", word["text"]) and len(current) >= 2:
            groups.append(current)
            current = []
    if current:
        groups.append(current)
    if not groups:
        groups = [[{"text": c["text"], "start": c["start"], "end": c["end"]}] for c in job["captions"]]
    ass = ["[Script Info]", "ScriptType: v4.00+", "PlayResX: 720", "PlayResY: 1280", "WrapStyle: 2", "ScaledBorderAndShadow: yes", "", "[V4+ Styles]",
           "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
           "Style: Captions,Noto Sans Display,39,&H00FAF7F5,&H0075BDE4,&H001F1308,&H001F1308,-1,0,0,0,100,100,0,0,1,2.3,0,2,50,50,170,1", "", "[Events]",
           "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"]
    srt, bounds = [], []
    for gi, group in enumerate(groups):
        words = [w["text"] for w in group]
        # Manual cue text is word-wrapped for display without inventing word timings.
        display_words = words if len(group) > 1 else words[0].split()
        split = None
        if measure.textlength(" ".join(display_words), font=face) > 620:
            options = [(max(measure.textlength(" ".join(display_words[:j]), font=face), measure.textlength(" ".join(display_words[j:]), font=face)), j)
                       for j in range(1, len(display_words))]
            if not options or min(options)[0] > 620:
                raise ValueError("Shorten a caption phrase to fit two phone-readable lines.")
            split = min(options)[1]
        start, end = group[0]["start"], group[-1]["end"]
        plain = " ".join(words)
        srt.extend([str(gi + 1), f"{timecode(start, True)} --> {timecode(end, True)}", plain, ""])
        for wi, word in enumerate(group):
            a = word["start"]
            b = group[wi + 1]["start"] if wi + 1 < len(group) else end
            if b <= a:
                continue
            pieces = []
            for j, token in enumerate(display_words):
                if j:
                    pieces.append("\\N" if j == split else " ")
                color = "&H75BDE4&" if len(group) > 1 and j == wi else "&HFAF7F5&"
                pieces.append("{\\c" + color + "}" + ass_text(token))
            ass.append(f"Dialogue: 0,{timecode(a)},{timecode(b)},Captions,,0,0,0,,{{\\an2\\pos(360,1100)}}" + "".join(pieces))
        bounds.append({"start": start, "end": end, "text": plain, "lines": 2 if split else 1})
    ap, sp = output / (job["episode_id"] + ".ass"), output / (job["episode_id"] + ".srt")
    ap.write_text("\n".join(ass), encoding="utf-8")
    sp.write_text("\n".join(srt), encoding="utf-8")
    return ap, sp, bounds


def render_shot(work, index, shot):
    path = work / f"shot-{index:03d}.mp4"
    inputs = []
    if shot["kind"] == "image":
        inputs += ["-loop", "1", "-framerate", FPS, "-i", shot["source_path"]]
        vf = f"[0:v]scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=increase,crop={WIDTH}:{HEIGHT},setsar=1,fps={FPS}[base]"
    else:
        info = probe(shot["source_path"])
        if shot["offset"] + shot["frames"] / FPS > float(info["format"]["duration"]) + .10:
            raise ValueError(f"Shot extends past source: {shot['source']}")
        inputs += ["-ss", shot["offset"], "-i", shot["source_path"]]
        vf = f"[0:v]scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=increase,crop={WIDTH}:{HEIGHT},setsar=1,fps={FPS},tpad=stop_mode=clone:stop_duration=0.1[base]"
    if shot["overlay_path"]:
        inputs += ["-loop", "1", "-framerate", FPS, "-i", shot["overlay_path"]]
        vf += ";[base][1:v]overlay=0:0:format=auto,format=yuv420p[v]"
    else:
        vf += ";[base]format=yuv420p[v]"
    ffmpeg(*inputs, "-filter_complex_threads", 1, "-filter_complex", vf, "-map", "[v]", "-an",
           "-frames:v", shot["frames"], "-c:v", "libx264", "-threads", 2, "-preset", "fast", "-crf", 18,
           "-pix_fmt", "yuv420p", path)
    return path


def render(job_path, output):
    job = load_job(job_path)
    output.mkdir(parents=True, exist_ok=True)
    narration_info = probe(job["narration_path"])
    narration_duration = float(narration_info["format"]["duration"])
    if narration_duration > job["duration"] + .06 or job["duration"] - narration_duration > 8:
        raise ValueError("Narration must fit naturally with at most eight seconds of ending space.")
    ass, srt, captions = caption_files(job, output)
    final = output / (job["episode_id"] + ".mp4")
    with tempfile.TemporaryDirectory(prefix="trivalley-lesson-") as tmp:
        work = Path(tmp)
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(render_shot, work, i, shot) for i, shot in enumerate(job["shots"])]
            parts = [f.result() for f in futures]
        concat = work / "shots.txt"
        concat.write_text("".join(f"file '{p.name}'\n" for p in parts), encoding="utf-8")
        # Use a fixed safe ASS filename so untrusted paths cannot inject filters.
        (work / "captions.ass").write_bytes(ass.read_bytes())
        inputs = ["-f", "concat", "-safe", "1", "-i", concat, "-i", job["narration_path"]]
        filters = f"[0:v]ass='{work}/captions.ass'[v];[1:a]aresample=48000,apad,atrim=0:{job['duration']},loudnorm=I=-16:TP=-1.5:LRA=7[voice]"
        if job["music_path"]:
            inputs += ["-stream_loop", "-1", "-i", job["music_path"]]
            filters += ";[voice]asplit=2[voiceout][side];[2:a]aresample=48000,volume=0.12[bed];[bed][side]sidechaincompress=threshold=0.018:ratio=7:attack=15:release=300[duck];[voiceout][duck]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.89:level=0[a]"
        else:
            filters += ";[voice]alimiter=limit=0.89:level=0[a]"
        ffmpeg(*inputs, "-filter_complex_threads", 1, "-filter_complex", filters,
               "-map", "[v]", "-map", "[a]", "-t", job["duration"], "-c:v", "libx264", "-threads", 3,
               "-preset", "fast", "-crf", 18, "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", 48000,
               "-ac", 2, "-b:a", "160k", "-movflags", "+faststart", final)
    info = probe(final)
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    a = next(s for s in info["streams"] if s["codec_type"] == "audio")
    if (v["codec_name"], v["width"], v["height"], v["pix_fmt"], v["r_frame_rate"], a["codec_name"]) != ("h264", WIDTH, HEIGHT, "yuv420p", "24/1", "aac"):
        raise RuntimeError("Output media format failed validation.")
    if abs(float(info["format"]["duration"]) - job["duration"]) > .1:
        raise RuntimeError("Output duration failed validation.")
    ffmpeg("-xerror", "-i", final, "-f", "null", "-", timeout=120)
    data = final.read_bytes()
    faststart = 0 <= data.find(b"moov") < data.find(b"mdat")
    if not faststart:
        raise RuntimeError("Output is not optimized for immediate playback.")
    quality = {"format": info, "full_decode": "passed", "faststart": faststart,
               "physical_device_playback": "not_observed", "visual_review": "pending",
               "caption_phrases": len(captions)}
    (output / (job["episode_id"] + ".qa.json")).write_text(json.dumps(quality, indent=2), encoding="utf-8")
    manifest = {"schema_version": 1, "episode_id": job["episode_id"], "language": job["language"],
                "status": "technical_qa_passed", "file": final.name, "subtitles": srt.name,
                "duration": float(info["format"]["duration"]), "narration_duration": narration_duration,
                "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data),
                "rendered_at": datetime.now(timezone.utc).isoformat(), "publication": "not_performed",
                "caption_timing_source": "measured_words" if job["words"] else "reviewed_cues",
                "shots": [{k: s[k] for k in ("kind", "source", "start", "end", "offset", "frames")} for s in job["shots"]]}
    (output / (job["episode_id"] + ".manifest.json")).write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("job", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    print(json.dumps(render(args.job.resolve(), args.output.resolve()), indent=2))


if __name__ == "__main__":
    main()
