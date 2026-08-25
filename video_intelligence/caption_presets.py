"""Caption style presets adapted for Nicholas-AI-OS Fast Reel jobs."""

from __future__ import annotations

CAPTION_PRESETS = {
    "viral": {
        "accent_color": "#67E8F9",
        "background_color": "#07111F",
        "emphasis": "bold",
        "description": "High-contrast kinetic social captioning.",
    },
    "minimal": {
        "accent_color": "#F8FAFC",
        "background_color": "#111827",
        "emphasis": "clean",
        "description": "Clean, restrained captions for professional content.",
    },
    "modern": {
        "accent_color": "#A78BFA",
        "background_color": "#0F172A",
        "emphasis": "clean-bold",
        "description": "Modern creator look with restrained motion.",
    },
    "default": {
        "accent_color": "#67E8F9",
        "background_color": "#07111F",
        "emphasis": "standard",
        "description": "Nicholas-AI-OS default Fast Reel presentation.",
    },
    "highlight": {
        "accent_color": "#FDE047",
        "background_color": "#111827",
        "emphasis": "keyword-highlight",
        "description": "Bright emphasis for key phrases and coaching cues.",
    },
    "colorshift": {
        "accent_color": "#22D3EE",
        "background_color": "#1E1B4B",
        "emphasis": "gradient",
        "description": "High-energy gradient presentation.",
    },
    "hormozi": {
        "accent_color": "#FDE047",
        "background_color": "#050505",
        "emphasis": "large-bold",
        "description": "Large, direct, high-contrast business/fitness captions.",
    },
    "mrbeast": {
        "accent_color": "#F43F5E",
        "background_color": "#0B1020",
        "emphasis": "max-energy",
        "description": "Aggressive attention-grabbing creator presentation.",
    },
    "mrbeastemoji": {
        "accent_color": "#F59E0B",
        "background_color": "#111827",
        "emphasis": "max-energy-emoji",
        "description": "High-energy presentation with emoji-friendly copy.",
    },
    "trivalley_elite": {
        "accent_color": "#E5E7EB",
        "background_color": "#05070A",
        "emphasis": "luxury-bold",
        "description": "TriValley Elite black-luxury coaching presentation.",
    },
}


def get_caption_preset(name: str | None) -> dict:
    key = str(name or "trivalley_elite").strip().lower()
    if key not in CAPTION_PRESETS:
        raise ValueError(f"Unknown caption preset: {key}")
    return dict(CAPTION_PRESETS[key])
