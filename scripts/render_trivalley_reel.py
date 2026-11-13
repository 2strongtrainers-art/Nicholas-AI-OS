#!/usr/bin/env python3
"""Render a TriValley.fit Reel from an approved local edit and its media."""

import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFont, ImageOps


WIDTH, HEIGHT, FPS = 720, 1280, 30
INK = (10, 14, 18)
WHITE, GOLD, MUTED = "#f7f5f0", "#f1be7c", "#bec5c9"
FONTS = Path("/usr/share/fonts/truetype/open-sans")
VIDEO = {".mp4", ".mov", ".m4v", ".webm"}
AUDIO = {".mp3", ".m4a", ".wav", ".aac"}
IMAGES = {".png", ".jpg", ".jpeg"}
ID = re.compile(r"[a-z0-9][a-z0-9-]{2,62}")


def ffmpeg(*args):
    subprocess.run(
        ["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y", *map(str, args)],
        check=True,
        timeout=180,
    )


def media_info(path):
    return json.loads(subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries",
         "format=duration:stream=codec_type,codec_name,width,height,pix_fmt,r_frame_rate",
         "-of", "json", str(path)],
        text=True, timeout=30,
    ))


def seconds(value, low, high, field):
    if type(value) not in (int, float) or not math.isfinite(value) or not low <= value <= high:
        raise ValueError(f"{field} must be {low}–{high} seconds.")
    return float(value)


def copy(value, limit, field):
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        raise ValueError(f"{field} must contain 1–{limit} characters.")
    return value.strip()


def asset(folder, name, extensions):
    if not isinstance(name, str) or not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_. -]{0,99}", name):
        raise ValueError("Use a plain filename for each source asset.")
    path = folder / name
    if path.suffix.lower() not in extensions or path.is_symlink() or not path.is_file():
        raise ValueError(f"Missing or unsupported source asset: {name}")
    return path


def load_edit(folder):
    edit = json.loads((folder / "reel.json").read_text(encoding="utf-8"))
    if not isinstance(edit, dict) or not isinstance(edit.get("episode_id"), str) or not ID.fullmatch(edit["episode_id"]):
        raise ValueError("Provide a valid episode_id in reel.json.")
    if not isinstance(edit.get("segments"), list) or not 1 <= len(edit["segments"]) <= 10:
        raise ValueError("Provide one to ten edit segments.")
    for item in edit["segments"]:
        if not isinstance(item, dict):
            raise ValueError("Each segment must be an object.")
        item["clip"] = asset(folder, item.get("clip"), VIDEO)
        item["start"] = seconds(item.get("start", 0), 0, 3600, "Clip start")
        item["seconds"] = seconds(item.get("seconds"), 1, 15, "Clip duration")
        item["caption"] = copy(item["caption"], 112, "Caption") if item.get("caption") else ""
        if item.get("narration"):
            item["narration"] = asset(folder, item["narration"], AUDIO)
    card = edit.get("end_card", {})
    if not isinstance(card, dict):
        raise ValueError("end_card must be an object.")
    edit["end_card"] = {
        "seconds": seconds(card.get("seconds", 5), 3, 8, "End card"),
        "headline": copy(card.get("headline", "BOOK YOUR\nELITE ASSESSMENT"), 54, "End card headline"),
        "detail": copy(card.get("detail", "$297  /  60 MINUTES"), 54, "End card details"),
        "cta": copy(card.get("cta", "TRIVALLEY.FIT  /  LINK IN BIO"), 54, "End card link"),
        "portrait": asset(folder, card["portrait"], IMAGES) if card.get("portrait") else None,
    }
    edit["logo"] = asset(folder, edit["logo"], IMAGES) if edit.get("logo") else None
    edit["music"] = asset(folder, edit["music"], AUDIO) if edit.get("music") else None
    duration = sum(s["seconds"] for s in edit["segments"]) + edit["end_card"]["seconds"]
    if not 8 <= duration <= 60:
        raise ValueError("The complete Reel must run 8–60 seconds.")
    return edit, duration


def font(face, size):
    return ImageFont.truetype(str(FONTS / face), size)


def wrap(draw, content, face, width):
    lines, line = [], ""
    for word in content.split():
        candidate = f"{line} {word}".strip()
        if draw.textlength(candidate, font=face) > width:
            if not line or draw.textlength(word, font=face) > width:
                raise ValueError("A word is too wide for the mobile caption area.")
            lines.append(line)
            line = word
        else:
            line = candidate
    return [*lines, line]


def brand(image, logo):
    draw = ImageDraw.Draw(image)
    x = 50
    if logo:
        with Image.open(logo) as source:
            mark = ImageOps.contain(source.convert("RGBA"), (44, 44))
        image.alpha_composite(mark, (49, 114))
        x = 104
    draw.text((x, 122), "TRIVALLEY.FIT", font=font("OpenSans-ExtraBold.ttf", 24), fill=WHITE, anchor="lt")
    draw.line((49, 174, 610, 174), fill=(215, 196, 162, 140), width=1)


def overlay(path, logo, caption):
    image = Image.new("RGBA", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(image)
    for y in range(192):
        draw.line((0, y, WIDTH, y), fill=INK + (round(220 * (1 - y / 192)),))
    brand(image, logo)
    if caption:
        face = font("OpenSans-Bold.ttf", 30)
        lines = wrap(draw, caption, face, 501)
        if len(lines) > 3:
            raise ValueError("Shorten the caption to fit three mobile lines.")
        top = 1012 - 40 * len(lines) - 32
        draw.rounded_rectangle((47, top, 606, 1012), radius=14, fill=INK + (226,))
        for i, line in enumerate(lines):
            draw.text((72, top + 16 + i * 40), line, font=face, fill=WHITE, anchor="lt")
    image.save(path)


def end_card(path, logo, card):
    image = Image.new("RGBA", (WIDTH, HEIGHT), INK + (255,))
    if card["portrait"]:
        with Image.open(card["portrait"]) as source:
            portrait = ImageOps.fit(source.convert("RGBA"), (450, 650), centering=(.53, .40))
        image.alpha_composite(portrait, (270, 229))
        shade = Image.new("RGBA", (WIDTH, HEIGHT))
        d = ImageDraw.Draw(shade)
        for x in range(490):
            d.line((x, 218, x, 875), fill=INK + (round(255 * (1 - x / 490)),))
        image.alpha_composite(shade)
    brand(image, logo)
    draw = ImageDraw.Draw(image)
    face = font("OpenSans-CondBold.ttf", 77 if not card["portrait"] else 64)
    lines = [line for part in card["headline"].splitlines() for line in wrap(draw, part, face, 540 if not card["portrait"] else 407)]
    if len(lines) > 4:
        raise ValueError("Shorten the end card headline.")
    for i, line in enumerate(lines):
        draw.text((49, 267 + i * 85), line, font=face, fill=WHITE if i == 0 else GOLD, anchor="lt")
    draw.rounded_rectangle((49, 822, 608, 914), radius=15, fill="#1c1e20", outline="#9a7952", width=2)
    for text, y, size, color in ((card["detail"], 849, 30, GOLD), (card["cta"], 958, 22, WHITE)):
        face = font("OpenSans-Bold.ttf", size)
        if draw.textlength(text, font=face) > 508:
            raise ValueError("Shorten the end card details or link.")
        draw.text((71 if y < 900 else 49, y), text, font=face, fill=color, anchor="lt")
    image.save(path)


def render_segment(work, index, item, logo):
    source = item["clip"]
    info = media_info(source)
    if not any(s["codec_type"] == "video" for s in info["streams"]):
        raise ValueError(f"Video stream missing in {source.name}.")
    if item["start"] + item["seconds"] > float(info["format"]["duration"]) + 0.12:
        raise ValueError(f"Trim extends beyond {source.name}.")
    graphics = work / f"overlay-{index}.png"
    overlay(graphics, logo, item["caption"])
    inputs = ["-ss", item["start"], "-i", source, "-i", graphics]
    if item.get("narration"):
        narration = item["narration"]
        if float(media_info(narration)["format"]["duration"]) > item["seconds"] + .05:
            raise ValueError(f"Narration is longer than the shot: {narration.name}")
        inputs += ["-i", narration]
        audio = "2:a:0"
    elif any(s["codec_type"] == "audio" for s in info["streams"]):
        audio = "0:a:0"
    else:
        inputs += ["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000"]
        audio = "2:a:0"
    path = work / f"part-{index}.mp4"
    video = (
        f"[0:v:0]scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=increase,crop={WIDTH}:{HEIGHT},"
        f"setsar=1,fps={FPS},tpad=stop_mode=clone:stop_duration=0.15[shot];"
        "[shot][1:v:0]overlay=format=auto,format=yuv420p[video]"
    )
    ffmpeg(*inputs, "-filter_complex_threads", "1", "-filter_complex", video,
           "-map", "[video]", "-map", audio, "-af", "apad", "-t", item["seconds"],
           "-c:v", "libx264", "-threads", "3", "-preset", "fast", "-crf", "18",
           "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", "-ac", "2", "-b:a", "160k", path)
    return path


def render(folder, out_dir):
    edit, duration = load_edit(folder)
    out_dir.mkdir(parents=True, exist_ok=True)
    name = edit["episode_id"]
    with tempfile.TemporaryDirectory(prefix="trivalley-reel-") as temp:
        work = Path(temp)
        parts = [render_segment(work, i, shot, edit["logo"]) for i, shot in enumerate(edit["segments"])]
        card_img, card_video = work / "end.png", work / "end.mp4"
        end_card(card_img, edit["logo"], edit["end_card"])
        ffmpeg("-loop", "1", "-framerate", FPS, "-i", card_img, "-f", "lavfi", "-i",
               "anullsrc=channel_layout=stereo:sample_rate=48000", "-t", edit["end_card"]["seconds"],
               "-c:v", "libx264", "-threads", "3", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p",
               "-c:a", "aac", "-ar", "48000", "-ac", "2", "-b:a", "160k", card_video)
        concat = work / "edit.txt"
        concat.write_text("".join(f"file '{p.name}'\n" for p in [*parts, card_video]), encoding="utf-8")
        draft = work / "review.mp4"
        inputs = ["-f", "concat", "-safe", "1", "-i", concat]
        if edit["music"]:
            inputs += ["-stream_loop", "-1", "-i", edit["music"]]
            audio = ["-filter_complex",
                     "[1:a]volume=0.14[bed];[0:a][bed]amix=inputs=2:duration=first:normalize=0,"
                     "loudnorm=I=-16:TP=-1.5:LRA=7[mix]", "-map", "[mix]"]
        else:
            audio = ["-map", "0:a:0", "-af", "loudnorm=I=-16:TP=-1.5:LRA=7"]
        ffmpeg(*inputs, "-map", "0:v:0", *audio, "-c:v", "copy", "-c:a", "aac",
               "-ar", "48000", "-ac", "2", "-b:a", "160k", "-movflags", "+faststart", "-t", duration, draft)
        info = media_info(draft)
        video = next(s for s in info["streams"] if s["codec_type"] == "video")
        audio_stream = next(s for s in info["streams"] if s["codec_type"] == "audio")
        actual = float(info["format"]["duration"])
        if (video["codec_name"], video["width"], video["height"], video["pix_fmt"], video["r_frame_rate"]) != (
                "h264", WIDTH, HEIGHT, "yuv420p", "30/1") or audio_stream["codec_name"] != "aac" or abs(actual - duration) > .18:
            raise RuntimeError("The rendered file failed the Reel format or duration check.")
        ffmpeg("-xerror", "-i", draft, "-f", "null", "-")
        output = out_dir / f"{name}.mp4"
        output.write_bytes(draft.read_bytes())
    with output.open("rb") as source:
        digest = hashlib.file_digest(source, "sha256").hexdigest()
    manifest = {"episode_id": name, "file": output.name, "sha256": digest,
                "seconds": actual, "width": WIDTH, "height": HEIGHT, "qa": "passed"}
    (out_dir / f"{name}.manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    render(args.source, args.output)


if __name__ == "__main__":
    main()
