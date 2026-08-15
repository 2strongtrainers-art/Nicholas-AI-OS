#!/usr/bin/env python3
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

VOICE_ID = "eZ6srIcJSJNcqcDrI68r"
URL = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}?output_format=mp3_44100_128"
TEXT = "Nicholas AI OS is connected. GitHub and August Nick are now working together."

api_key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
if not api_key:
    raise SystemExit("ELEVENLABS_API_KEY is not available to this GitHub Action")

payload = {
    "text": TEXT,
    "model_id": "eleven_multilingual_v2",
    "voice_settings": {
        "stability": 0.45,
        "similarity_boost": 0.85,
        "style": 0.20,
        "use_speaker_boost": True,
        "speed": 1.10
    }
}

request = urllib.request.Request(
    URL,
    data=json.dumps(payload).encode("utf-8"),
    method="POST",
    headers={
        "xi-api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg"
    }
)

try:
    with urllib.request.urlopen(request, timeout=60) as response:
        audio = response.read()
        status = response.status
except urllib.error.HTTPError as exc:
    body = exc.read().decode("utf-8", errors="replace")[:1200]
    print(f"ElevenLabs request failed with HTTP {exc.code}: {body}", file=sys.stderr)
    raise SystemExit(1)
except Exception as exc:
    print(f"ElevenLabs request failed: {type(exc).__name__}: {exc}", file=sys.stderr)
    raise SystemExit(1)

if status != 200:
    raise SystemExit(f"Unexpected ElevenLabs status: {status}")
if len(audio) < 1000:
    raise SystemExit(f"Audio response was unexpectedly small: {len(audio)} bytes")

out = Path("output")
out.mkdir(exist_ok=True)
mp3 = out / "august-nick-secret-test.mp3"
mp3.write_bytes(audio)
manifest = out / "august-nick-secret-test.json"
manifest.write_text(json.dumps({
    "status": "passed",
    "voice_id": VOICE_ID,
    "model_id": "eleven_multilingual_v2",
    "bytes": len(audio),
    "text": TEXT,
    "voice_settings": payload["voice_settings"],
    "secret_exposed": False
}, indent=2), encoding="utf-8")

print(f"ElevenLabs authentication and August Nick synthesis passed: {len(audio)} bytes")
