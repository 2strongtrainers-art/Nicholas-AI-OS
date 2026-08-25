"""Clip-ranking helpers for Hermes/OpenMontage.

The scoring criteria are adapted from the MIT-licensed Video Wizard project's
viral-editor concept, but implemented as a small Nicholas-AI-OS-native module.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Iterable

MIN_CLIP_SECONDS = 30.0
MAX_CLIP_SECONDS = 120.0


@dataclass(frozen=True)
class ClipCandidate:
    start_seconds: float
    end_seconds: float
    viral_score: float
    hook: str
    conclusion: str
    reason: str
    caption_style: str = "trivalley_elite"
    focus_x: float = 0.5
    focus_y: float = 0.5

    @property
    def duration_seconds(self) -> float:
        return round(self.end_seconds - self.start_seconds, 3)

    def to_dict(self) -> dict:
        data = asdict(self)
        data["duration_seconds"] = self.duration_seconds
        return data


def _bounded_float(value: Any, field: str, low: float, high: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field} must be numeric") from exc
    if not low <= number <= high:
        raise ValueError(f"{field} must be between {low} and {high}")
    return number


def normalize_candidate(raw: dict) -> ClipCandidate:
    if not isinstance(raw, dict):
        raise ValueError("candidate must be an object")
    start = _bounded_float(raw.get("start_seconds"), "start_seconds", 0, 86400)
    end = _bounded_float(raw.get("end_seconds"), "end_seconds", 0, 86400)
    duration = end - start
    if duration < MIN_CLIP_SECONDS or duration > MAX_CLIP_SECONDS:
        raise ValueError(
            f"candidate duration must be {MIN_CLIP_SECONDS:.0f}-{MAX_CLIP_SECONDS:.0f}s"
        )
    score = _bounded_float(raw.get("viral_score"), "viral_score", 0, 100)
    focus_x = _bounded_float(raw.get("focus_x", 0.5), "focus_x", 0, 1)
    focus_y = _bounded_float(raw.get("focus_y", 0.5), "focus_y", 0, 1)
    return ClipCandidate(
        start_seconds=round(start, 3),
        end_seconds=round(end, 3),
        viral_score=round(score, 2),
        hook=str(raw.get("hook") or "").strip()[:180],
        conclusion=str(raw.get("conclusion") or "").strip()[:180],
        reason=str(raw.get("reason") or raw.get("analysis") or "").strip()[:600],
        caption_style=str(raw.get("caption_style") or "trivalley_elite").strip().lower(),
        focus_x=round(focus_x, 4),
        focus_y=round(focus_y, 4),
    )


def rank_candidates(candidates: Iterable[dict | ClipCandidate], limit: int = 3) -> list[ClipCandidate]:
    normalized = [item if isinstance(item, ClipCandidate) else normalize_candidate(item) for item in candidates]
    normalized.sort(key=lambda item: (item.viral_score, item.duration_seconds), reverse=True)
    return normalized[: max(1, min(int(limit), 10))]


def candidate_to_fast_reel_clip(source_media: str, candidate: ClipCandidate) -> dict:
    return {
        "media": source_media,
        "start_seconds": candidate.start_seconds,
        "end_seconds": candidate.end_seconds,
        "viral_score": candidate.viral_score,
        "focus_x": candidate.focus_x,
        "focus_y": candidate.focus_y,
        "caption_style": candidate.caption_style,
    }


def build_hermes_prompt(transcript: str, target_min: int = 45, target_max: int = 90) -> str:
    text = str(transcript or "").strip()
    if len(text) < 100:
        raise ValueError("transcript must contain at least 100 characters")
    target_min = max(30, min(int(target_min), 90))
    target_max = max(target_min, min(int(target_max), 120))
    return f"""You are Nicholas Operator acting as a short-form content editor.

Analyze the timestamped transcript below and identify at most 5 standalone clips with the strongest short-form potential.

Score each candidate from 0-100 using these priorities:
- opening hook / immediate attention: 25 points
- complete thought or story arc: 20 points
- emotional or curiosity impact: 15 points
- satisfying conclusion: 15 points
- standalone clarity without outside context: 15 points
- shareability / discussion value: 10 points

Prefer complete clips around {target_min}-{target_max} seconds. Never invent timestamps. Reject fragments that depend on missing context. Fitness/coaching content should favor useful instruction, visible transformation, a surprising coaching insight, or a clear before/after idea over generic motivation.

Return JSON only with this exact shape:
{{
  "analysis_summary": "brief summary",
  "clips": [
    {{
      "start_seconds": 0.0,
      "end_seconds": 60.0,
      "viral_score": 0,
      "hook": "opening idea",
      "conclusion": "ending idea",
      "reason": "why this segment works",
      "caption_style": "trivalley_elite",
      "focus_x": 0.5,
      "focus_y": 0.5
    }}
  ]
}}

Use focus_x/focus_y only as a neutral framing hint; keep both at 0.5 unless visual-analysis evidence is supplied separately.

TRANSCRIPT
{text[:60000]}
"""
