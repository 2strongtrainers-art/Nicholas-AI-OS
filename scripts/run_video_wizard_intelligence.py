#!/usr/bin/env python3
"""Run Video Wizard-inspired short-form intelligence through Nicholas Operator.

This script is local/repository controlled. It does not publish content, send
messages, or call a video-generation SaaS. It asks Hermes/GPT-5.6 Sol to rank
clips from a supplied timestamped transcript, validates the returned JSON, and
emits Fast Reel-ready clip metadata for the existing OpenMontage pipeline.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from video_intelligence.caption_presets import get_caption_preset
from video_intelligence.clip_intelligence import (
    build_hermes_prompt,
    candidate_to_fast_reel_clip,
    rank_candidates,
)
from video_intelligence.face_focus import estimate_face_focus

HERMES = Path.home() / ".local" / "bin" / "hermes"


def _extract_json(text: str) -> dict:
    stripped = text.strip()
    try:
        value = json.loads(stripped)
        if isinstance(value, dict):
            return value
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", stripped, re.S)
    if not match:
        raise RuntimeError("Hermes returned no JSON object")
    value = json.loads(match.group(0))
    if not isinstance(value, dict):
        raise RuntimeError("Hermes JSON result must be an object")
    return value


def _read_transcript(path: str) -> str:
    transcript_path = Path(path).expanduser()
    if not transcript_path.is_absolute():
        transcript_path = ROOT / transcript_path
    if not transcript_path.is_file():
        raise FileNotFoundError(transcript_path)
    return transcript_path.read_text(encoding="utf-8", errors="replace")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--transcript", required=True, help="Timestamped transcript text file")
    parser.add_argument("--source-media", default="", help="Optional source video for Fast Reel metadata")
    parser.add_argument("--output", required=True, help="JSON output path")
    parser.add_argument("--caption-style", default="trivalley_elite")
    parser.add_argument("--face-focus", action="store_true", help="Estimate stable face focus when MediaPipe is available")
    parser.add_argument("--dry-run", action="store_true", help="Write the Hermes prompt instead of calling a model")
    args = parser.parse_args()

    transcript = _read_transcript(args.transcript)
    prompt = build_hermes_prompt(transcript)
    output_path = Path(args.output).expanduser()
    if not output_path.is_absolute():
        output_path = ROOT / output_path
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if args.dry_run:
        output_path.write_text(json.dumps({"dry_run": True, "prompt": prompt}, indent=2) + "\n")
        print(output_path)
        return 0

    if not HERMES.exists():
        raise SystemExit(f"Hermes binary not found: {HERMES}")

    result = subprocess.run(
        [
            str(HERMES),
            "--provider", "openai-codex",
            "--model", "gpt-5.6-sol",
            "--reasoning", "high",
            "--toolsets", "search",
            "--oneshot", prompt,
        ],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        timeout=900,
        check=True,
    )
    raw = _extract_json(result.stdout or "")
    clips = rank_candidates(raw.get("clips") or [], limit=3)
    if not clips:
        payload = {
            "analysis_summary": raw.get("analysis_summary") or "No valid short-form candidate returned.",
            "decision": "PASS",
            "clips": [],
            "fast_reel": None,
        }
    else:
        preset = get_caption_preset(args.caption_style)
        enriched = []
        for clip in clips:
            item = clip.to_dict()
            if args.source_media and args.face_focus:
                focus = estimate_face_focus(
                    args.source_media,
                    clip.start_seconds,
                    clip.end_seconds,
                )
                item.update(focus.to_dict())
            enriched.append(item)

        top = clips[0]
        if enriched:
            top = type(top)(
                start_seconds=top.start_seconds,
                end_seconds=top.end_seconds,
                viral_score=top.viral_score,
                hook=top.hook,
                conclusion=top.conclusion,
                reason=top.reason,
                caption_style=args.caption_style,
                focus_x=float(enriched[0].get("focus_x", top.focus_x)),
                focus_y=float(enriched[0].get("focus_y", top.focus_y)),
            )
        fast_reel = {
            "duration_seconds": min(90.0, top.duration_seconds),
            "hook": top.hook,
            "title": "TRIVALLEY ELITE",
            "body_lines": [top.reason[:110]] if top.reason else [],
            "cta": "FOLLOW FOR THE NEXT BREAKDOWN",
            "branding": "TriValley.fit",
            "caption_style": args.caption_style,
            "accent_color": preset["accent_color"],
            "background_color": preset["background_color"],
            "clips": [candidate_to_fast_reel_clip(args.source_media, top)] if args.source_media else [],
        }
        if fast_reel["clips"]:
            fast_reel["clips"][0]["focus_x"] = top.focus_x
            fast_reel["clips"][0]["focus_y"] = top.focus_y
        payload = {
            "analysis_summary": raw.get("analysis_summary") or "",
            "decision": "USE_TOP_CLIP",
            "clips": enriched,
            "fast_reel": fast_reel,
            "live_publish": False,
        }

    output_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
