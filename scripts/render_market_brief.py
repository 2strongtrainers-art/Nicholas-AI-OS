#!/usr/bin/env python3
import json, os, subprocess, sys, tempfile, textwrap, urllib.request, urllib.error
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1080, 1920, 30
VOICE_ID = "eZ6srIcJSJNcqcDrI68r"
TTS_URL = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}?output_format=mp3_44100_128"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
BG = (13, 17, 23)
CARD = (24, 32, 45)
TEXT = (245, 247, 250)
MUTED = (169, 181, 199)
BLUE = (74, 158, 255)
GREEN = (73, 201, 132)
RED = (255, 105, 105)
GOLD = (232, 190, 82)


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
            "stability": 0.45,
            "similarity_boost": 0.85,
            "style": 0.20,
            "use_speaker_boost": True,
            "speed": 1.10
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


def wrap(text, n):
    return textwrap.wrap(str(text), width=n, break_long_words=False, break_on_hyphens=False)


def base_canvas(scene_num, total, kicker):
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((55, 90, 1025, 1760), radius=40, fill=CARD)
    d.rounded_rectangle((78, 115, 370, 173), radius=20, fill=BLUE)
    fsmall = ImageFont.truetype(FONT_BOLD, 27)
    d.text((100, 128), f"MARKET BRIEF  {scene_num}/{total}", font=fsmall, fill=TEXT)
    fk = ImageFont.truetype(FONT_REG, 27)
    d.text((84, 1800), kicker, font=fk, fill=MUTED)
    return im, d


def draw_text_scene(scene, idx, total, out_path):
    im, d = base_canvas(idx, total, scene.get("source_label", "Verified sources"))
    ft = ImageFont.truetype(FONT_BOLD, 66)
    fs = ImageFont.truetype(FONT_BOLD, 34)
    fb = ImageFont.truetype(FONT_REG, 41)
    y = 250
    for line in wrap(scene["headline"], 25):
        d.text((92, y), line, font=ft, fill=TEXT); y += 82
    y += 10
    d.text((92, y), scene.get("subhead", ""), font=fs, fill=BLUE); y += 95
    for line in wrap(scene.get("body", ""), 36):
        d.text((92, y), line, font=fb, fill=TEXT); y += 59
    if scene.get("bullets"):
        y += 32
        for b in scene["bullets"]:
            d.ellipse((95, y+11, 113, y+29), fill=GOLD)
            for j, line in enumerate(wrap(b, 34)):
                d.text((135, y + j*52), line, font=fb, fill=TEXT)
            y += max(66, 52*len(wrap(b, 34)))
    im.save(out_path)


def draw_returns_scene(scene, idx, total, out_path):
    im, d = base_canvas(idx, total, scene.get("source_label", "Alpaca market data"))
    ft = ImageFont.truetype(FONT_BOLD, 65)
    fs = ImageFont.truetype(FONT_BOLD, 33)
    fl = ImageFont.truetype(FONT_BOLD, 30)
    fv = ImageFont.truetype(FONT_BOLD, 27)
    y = 245
    for line in wrap(scene["headline"], 25):
        d.text((92, y), line, font=ft, fill=TEXT); y += 80
    d.text((92, y+10), scene.get("subhead", ""), font=fs, fill=BLUE)
    data = scene["returns"]
    chart_top, chart_bottom = y+110, 1510
    zero_x = 520
    d.line((zero_x, chart_top, zero_x, chart_bottom), fill=(100,110,125), width=2)
    max_abs = max(abs(float(v)) for v in data.values()) or 1
    row_h = (chart_bottom-chart_top)//len(data)
    for n,(sym,val) in enumerate(data.items()):
        yy = chart_top + n*row_h + 15
        d.text((115, yy), sym, font=fl, fill=TEXT)
        width = int((abs(float(val))/max_abs)*365)
        if float(val) >= 0:
            d.rectangle((zero_x, yy+4, zero_x+width, yy+38), fill=GREEN)
            d.text((zero_x+width+18, yy), f"+{val:.2f}%", font=fv, fill=GREEN)
        else:
            d.rectangle((zero_x-width, yy+4, zero_x, yy+38), fill=RED)
            d.text((zero_x-width-115, yy), f"{val:.2f}%", font=fv, fill=RED)
    d.text((92, 1580), scene.get("body", ""), font=ImageFont.truetype(FONT_REG, 33), fill=MUTED)
    im.save(out_path)


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: render_market_brief.py jobs/<job>.json")
    job_path = Path(sys.argv[1])
    job = json.loads(job_path.read_text())
    scenes = job["scenes"]
    out = Path("output"); out.mkdir(exist_ok=True)
    final_name = job.get("output_filename", f"{job_path.stem}.mp4")
    final_path = out / final_name

    with tempfile.TemporaryDirectory(prefix="market-brief-") as td:
        work = Path(td); segments=[]
        for i, scene in enumerate(scenes, 1):
            mp3 = work / f"voice_{i:02d}.mp3"
            png = work / f"scene_{i:02d}.png"
            seg = work / f"seg_{i:02d}.mp4"
            tts(scene["narration"], mp3)
            dur = probe_duration(mp3) + 0.35
            if scene.get("type") == "returns":
                draw_returns_scene(scene, i, len(scenes), png)
            else:
                draw_text_scene(scene, i, len(scenes), png)
            run([
                "ffmpeg", "-y", "-loop", "1", "-i", str(png), "-i", str(mp3),
                "-t", f"{dur:.3f}", "-r", str(FPS),
                "-vf", "format=yuv420p,fade=t=in:st=0:d=0.18",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
                "-shortest", "-movflags", "+faststart", str(seg)
            ])
            segments.append(seg)
        concat = work / "concat.txt"
        concat.write_text("".join(f"file '{p.as_posix()}'\n" for p in segments))
        run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat), "-c", "copy", "-movflags", "+faststart", str(final_path)])

    duration = probe_duration(final_path)
    manifest = {
        "workflow_id": job.get("workflow_id"),
        "output": str(final_path),
        "duration_seconds": duration,
        "resolution": [W,H],
        "voice": "August Nick",
        "voice_id": VOICE_ID,
        "qa": "passed" if duration > 30 else "failed",
        "sources": job.get("sources", []),
        "market_as_of": job.get("market_as_of")
    }
    if manifest["qa"] != "passed":
        raise RuntimeError("QA failed: output too short")
    (out / f"{Path(final_name).stem}.manifest.json").write_text(json.dumps(manifest, indent=2))
    print(json.dumps(manifest, indent=2))

if __name__ == "__main__":
    main()
