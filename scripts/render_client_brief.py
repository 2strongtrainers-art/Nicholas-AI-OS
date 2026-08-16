#!/usr/bin/env python3
import json, os, subprocess, sys, tempfile, textwrap, urllib.request, urllib.error
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1080, 1920, 30
VOICE_ID = "eZ6srIcJSJNcqcDrI68r"
TTS_URL = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}?output_format=mp3_44100_128"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
BG = (10, 15, 24)
CARD = (20, 29, 43)
CARD2 = (28, 40, 58)
TEXT = (247, 249, 252)
MUTED = (174, 186, 204)
BLUE = (64, 154, 255)
GREEN = (76, 205, 142)
GOLD = (236, 190, 83)
RED = (255, 112, 112)


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


def wrap(text, n):
    return textwrap.wrap(str(text), width=n, break_long_words=False, break_on_hyphens=False)


def base_canvas(job, idx, total, footer):
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((48, 70, 1032, 1775), radius=46, fill=CARD)
    d.rounded_rectangle((76, 105, 410, 170), radius=24, fill=BLUE)
    fsmall = ImageFont.truetype(FONT_BOLD, 27)
    d.text((98, 123), f"TRIVALLEY.FIT  {idx}/{total}", font=fsmall, fill=TEXT)
    fclient = ImageFont.truetype(FONT_BOLD, 29)
    d.text((80, 1810), job.get("client", "CLIENT BRIEF").upper(), font=fclient, fill=TEXT)
    ff = ImageFont.truetype(FONT_REG, 24)
    d.text((80, 1852), footer[:78], font=ff, fill=MUTED)
    return im, d


def draw_text_scene(job, scene, idx, total, out_path):
    im, d = base_canvas(job, idx, total, scene.get("source_label", "Coach Nick • TriValley.fit"))
    ft = ImageFont.truetype(FONT_BOLD, 67)
    fs = ImageFont.truetype(FONT_BOLD, 35)
    fb = ImageFont.truetype(FONT_REG, 39)
    y = 245
    for line in wrap(scene["headline"], 25):
        d.text((92, y), line, font=ft, fill=TEXT); y += 82
    if scene.get("subhead"):
        y += 8
        for line in wrap(scene["subhead"], 38):
            d.text((92, y), line, font=fs, fill=BLUE); y += 48
        y += 35
    if scene.get("body"):
        for line in wrap(scene["body"], 38):
            d.text((92, y), line, font=fb, fill=TEXT); y += 56
    if scene.get("bullets"):
        y += 34
        for b in scene["bullets"]:
            d.ellipse((98, y+13, 116, y+31), fill=GOLD)
            lines = wrap(b, 36)
            for j, line in enumerate(lines):
                d.text((140, y + j*52), line, font=fb, fill=TEXT)
            y += max(70, len(lines)*52 + 14)
    im.save(out_path)


def draw_numbers_scene(job, scene, idx, total, out_path):
    im, d = base_canvas(job, idx, total, scene.get("source_label", "Verified coaching data"))
    ft = ImageFont.truetype(FONT_BOLD, 63)
    fs = ImageFont.truetype(FONT_BOLD, 32)
    fn = ImageFont.truetype(FONT_BOLD, 62)
    fl = ImageFont.truetype(FONT_REG, 27)
    y = 235
    for line in wrap(scene["headline"], 27):
        d.text((92, y), line, font=ft, fill=TEXT); y += 78
    d.text((92, y+5), scene.get("subhead", ""), font=fs, fill=BLUE)
    y += 105
    metrics = scene.get("metrics", [])
    for m in metrics:
        d.rounded_rectangle((90, y, 990, y+195), radius=28, fill=CARD2)
        d.text((125, y+32), str(m.get("value", "")), font=fn, fill=GREEN if m.get("positive", True) else GOLD)
        d.text((125, y+116), str(m.get("label", "")), font=fl, fill=MUTED)
        y += 225
    if scene.get("body"):
        y += 12
        fbody = ImageFont.truetype(FONT_REG, 32)
        for line in wrap(scene["body"], 45):
            d.text((96, y), line, font=fbody, fill=TEXT); y += 46
    im.save(out_path)


def draw_price_scene(job, scene, idx, total, out_path):
    im, d = base_canvas(job, idx, total, scene.get("source_label", "24 Hour Fitness • verified Aug 15, 2026"))
    ft = ImageFont.truetype(FONT_BOLD, 61)
    fs = ImageFont.truetype(FONT_BOLD, 32)
    fl = ImageFont.truetype(FONT_BOLD, 31)
    fp = ImageFont.truetype(FONT_BOLD, 43)
    y = 230
    for line in wrap(scene["headline"], 27):
        d.text((92, y), line, font=ft, fill=TEXT); y += 76
    d.text((92, y+5), scene.get("subhead", ""), font=fs, fill=BLUE)
    y += 105
    rows = scene.get("prices", [])
    for i, row in enumerate(rows):
        fill = (31, 69, 61) if i == 0 else CARD2
        d.rounded_rectangle((90, y, 990, y+190), radius=28, fill=fill)
        d.text((125, y+32), row["name"], font=fl, fill=TEXT)
        d.text((125, y+92), row.get("note", ""), font=ImageFont.truetype(FONT_REG, 25), fill=MUTED)
        price = row["price"]
        tw = d.textbbox((0,0), price, font=fp)[2]
        d.text((950-tw, y+59), price, font=fp, fill=GREEN if i == 0 else TEXT)
        y += 215
    if scene.get("body"):
        fbody = ImageFont.truetype(FONT_REG, 31)
        y += 18
        for line in wrap(scene["body"], 46):
            d.text((94, y), line, font=fbody, fill=TEXT); y += 45
    im.save(out_path)


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: render_client_brief.py jobs/<job>.json")
    job_path = Path(sys.argv[1])
    job = json.loads(job_path.read_text())
    scenes = job["scenes"]
    out = Path("output"); out.mkdir(exist_ok=True)
    final_name = job.get("output_filename", f"{job_path.stem}.mp4")
    final_path = out / final_name

    with tempfile.TemporaryDirectory(prefix="client-brief-") as td:
        work = Path(td); segments=[]
        for i, scene in enumerate(scenes, 1):
            mp3 = work / f"voice_{i:02d}.mp3"
            png = work / f"scene_{i:02d}.png"
            seg = work / f"seg_{i:02d}.mp4"
            tts(scene["narration"], mp3)
            dur = probe_duration(mp3) + 0.40
            if scene.get("type") == "numbers":
                draw_numbers_scene(job, scene, i, len(scenes), png)
            elif scene.get("type") == "prices":
                draw_price_scene(job, scene, i, len(scenes), png)
            else:
                draw_text_scene(job, scene, i, len(scenes), png)
            run([
                "ffmpeg", "-y", "-loop", "1", "-i", str(png), "-i", str(mp3),
                "-t", f"{dur:.3f}", "-r", str(FPS),
                "-vf", "format=yuv420p,fade=t=in:st=0:d=0.18,fade=t=out:st=" + f"{max(dur-0.20,0):.3f}" + ":d=0.18",
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
        "client": job.get("client"),
        "output": str(final_path),
        "duration_seconds": duration,
        "resolution": [W, H],
        "voice": "August Nick",
        "voice_id": VOICE_ID,
        "delivery_profile": "conversational_nick",
        "qa": "passed" if duration > 45 else "failed",
        "sources": job.get("sources", [])
    }
    if manifest["qa"] != "passed":
        raise RuntimeError("QA failed: output too short")
    (out / f"{Path(final_name).stem}.manifest.json").write_text(json.dumps(manifest, indent=2))
    print(json.dumps(manifest, indent=2))

if __name__ == "__main__":
    main()
