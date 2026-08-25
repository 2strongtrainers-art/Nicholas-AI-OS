"""Nicholas-AI-OS short-form video intelligence helpers.

This package adapts high-value ideas from the MIT-licensed Video Wizard project
without importing its web/database stack. It provides clip ranking, caption
presets, optional face-focus analysis, and deterministic vertical crop helpers
for the existing OpenMontage pipeline.
"""

from .clip_intelligence import (
    ClipCandidate,
    build_hermes_prompt,
    candidate_to_fast_reel_clip,
    normalize_candidate,
    rank_candidates,
)
from .caption_presets import CAPTION_PRESETS, get_caption_preset

__all__ = [
    "CAPTION_PRESETS",
    "ClipCandidate",
    "build_hermes_prompt",
    "candidate_to_fast_reel_clip",
    "get_caption_preset",
    "normalize_candidate",
    "rank_candidates",
]
