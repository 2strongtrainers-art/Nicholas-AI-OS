#!/usr/bin/env python3
import json, os, subprocess, sys, tempfile, urllib.request, urllib.error
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps

W, H, FPS = 1080, 1920, 30
VOICE_ID = "eZ6srIcJSJNcqcDrI68r"
TTS_URL = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}?output_format=mp3_44100_128"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"


def run(cmd):
    print("+", " ".join(map(str, cmd)))
    subprocess.run(cmd, check=True)


def probe_duration(path):
    return float(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=nw=1:nk=1", str(path)
    ], text=True).strip())


def tts(text, out_path):
    key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if not key:
        raise RuntimeError("ELEVENLABS_API_KEY is unavailable")
    payload = {
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.40,
            "similarity_boost": 0.85,
            "style": 0.0,
            "use_speaker_boost": True,
            "speed": 1.03
        }
    }
    req = urllib.request.Request(
        TTS_URL, data=json.dumps(payload).encode(), method="POST",
        headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"}
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            audio = r.read()
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:1000]
        raise RuntimeError(f"ElevenLabs HTTP {e.code}: {body}")
    if len(audio) < 1000:
        raise RuntimeError("ElevenLabs returned unexpectedly small audio")
    Path(out_path).write_bytes(audio)


def download(url, out_path):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        Path(out_path).write_bytes(r.read())


def rounded_mask(size, radius):
    mask = Image.new("L", size, 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle((0, 0, size[0]-1, size[1]-1), radius=radius, fill=255)
    return mask


def make_frame(photo_path, job, out_path):
    src = ImageOps.exif_transpose(Image.open(photo_path)).convert("RGB")

    # Background: exact source photo, blurred and darkened to fill 9:16 without inventing a face.
    bg = ImageOps.fit(src, (W, H), method=Image.Resampling.LANCZOS)
    bg = bg.filter(ImageFilter.GaussianBlur(34)).convert("RGBA")
    shade = Image.new("RGBA", (W, H), (5, 9, 16, 145))
    canvas = Image.alpha_composite(bg, shade)

    # Foreground: preserve the actual uploaded photo, centered as the primary subject.
    max_w, max_h = 940, 1280
    ratio = min(max_w / src.width, max_h / src.height)
    fg = src.resize((int(src.width*ratio), int(src.height*ratio)), Image.Resampling.LANCZOS).convert("RGBA")
    mask = rounded_mask(fg.size, 42)
    x = (W - fg.width)//2
    y = 245
    shadow = Image.new("RGBA", (fg.width+36, fg.height+36), (0,0,0,0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((18,18,fg.width+18,fg.height+18), radius=50, fill=(0,0,0,110))
    canvas.alpha_composite(shadow, (x-18, y-8))
    canvas.paste(fg, (x,y), mask)

    d = ImageDraw.Draw(canvas)
    f_brand = ImageFont.truetype(FONT_BOLD, 54)
    f_name = ImageFont.truetype(FONT_BOLD, 47)
    f_role = ImageFont.truetype(FONT_REG, 29)
    f_cta = ImageFont.truetype(FONT_BOLD, 31)

    d.rounded_rectangle((54, 56, 1026, 176), radius=38, fill=(9,17,30,220))
    d.text((84, 83), job.get("brand", "TRIVALLEY.FIT"), font=f_brand, fill=(248,250,253,255))

    lower_y = 1580
    d.rounded_rectangle((54, lower_y, 1026, 1850), radius=42, fill=(9,17,30,225))
    d.text((84, lower_y+42), job.get("name", "Nicholas Kaplan"), font=f_name, fill=(248,250,253,255))
    d.text((84, lower_y+105), job.get("role", "Personalized Fitness Coaching"), font=f_role, fill=(177,196,221,255))
    d.text((84, lower_y+174), job.get("tagline", "Train with purpose. Perform at your best."), font=f_cta, fill=(95,181,255,255))

    canvas.convert("RGB").save(out_path, quality=95)


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: render_photo_intro.py jobs/photo-intro-*.json")
    job_path = Path(sys.argv[1])
    job = json.loads(job_path.read_text())
    out = Path("output"); out.mkdir(exist_ok=True)
    final_name = job.get("output_filename", f"{job_path.stem}.mp4")
    final_path = out / final_name

    with tempfile.TemporaryDirectory(prefix="photo-intro-") as td:
        work = Path(td)
        photo = work / "source.jpg"
        audio = work / "august-nick.mp3"
        frame = work / "frame.jpg"
        download(job["photo_url"], photo)
        tts(job["script"], audio)
        make_frame(photo, job, frame)
        dur = probe_duration(audio) + 0.45

        # Slow, restrained push-in keeps the exact photo visually alive while preserving likeness.
        vf = (
            f"scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,"
            f"zoompan=z='min(zoom+0.00022,1.035)':d={int(dur*FPS)}:s=1080x1920:fps={FPS},"
            "format=yuv420p"
        )
        run([
            "ffmpeg", "-y", "-loop", "1", "-i", str(frame), "-i", str(audio),
            "-t", f"{dur:.3f}", "-vf", vf,
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "19",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
            "-shortest", "-movflags", "+faststart", str(final_path)
        ])

    duration = probe_duration(final_path)
    min_duration = float(job.get("min_duration_seconds", 15))
    if duration < min_duration:
        raise RuntimeError(f"QA failed: {duration:.2f}s < {min_duration:.2f}s")
    manifest = {
        "workflow_id": job.get("workflow_id"),
        "brand": job.get("brand", "TRIVALLEY.FIT"),
        "output": str(final_path),
        "duration_seconds": duration,
        "resolution": [W, H],
        "voice": "August Nick",
        "voice_id": VOICE_ID,
        "watermark": "none",
        "likeness_source": "exact uploaded photo URL",
        "qa": "passed"
    }
    (out / f"{Path(final_name).stem}.manifest.json").write_text(json.dumps(manifest, indent=2))
    print(json.dumps(manifest, indent=2))

if __name__ == "__main__":
    main()
