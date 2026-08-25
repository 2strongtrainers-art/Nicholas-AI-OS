import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from video_intelligence.caption_presets import get_caption_preset
from video_intelligence.clip_intelligence import (
    build_hermes_prompt,
    candidate_to_fast_reel_clip,
    normalize_candidate,
    rank_candidates,
)
from video_intelligence.smart_crop import crop_filter


ROOT = Path(__file__).resolve().parents[1]


class VideoIntelligenceTests(unittest.TestCase):
    def candidate(self, **updates):
        data = {
            "start_seconds": 10,
            "end_seconds": 70,
            "viral_score": 80,
            "hook": "Stop wasting your first rep.",
            "conclusion": "That is how you make the set count.",
            "reason": "Strong coaching payoff.",
        }
        data.update(updates)
        return data

    def test_candidate_validation_and_duration(self):
        clip = normalize_candidate(self.candidate())
        self.assertEqual(clip.duration_seconds, 60)
        self.assertEqual(clip.focus_x, 0.5)
        self.assertEqual(clip.caption_style, "trivalley_elite")

    def test_rejects_too_short_candidate(self):
        with self.assertRaises(ValueError):
            normalize_candidate(self.candidate(end_seconds=25))

    def test_ranks_score_then_duration(self):
        ranked = rank_candidates([
            self.candidate(viral_score=75, end_seconds=80),
            self.candidate(viral_score=90, end_seconds=60),
            self.candidate(viral_score=90, end_seconds=90),
        ])
        self.assertEqual(ranked[0].viral_score, 90)
        self.assertEqual(ranked[0].duration_seconds, 80)

    def test_fast_reel_clip_keeps_focus_metadata(self):
        clip = normalize_candidate(self.candidate(focus_x=0.72, focus_y=0.41))
        result = candidate_to_fast_reel_clip("footage.mp4", clip)
        self.assertEqual(result["media"], "footage.mp4")
        self.assertEqual(result["focus_x"], 0.72)
        self.assertEqual(result["focus_y"], 0.41)

    def test_prompt_is_strict_and_timestamp_grounded(self):
        prompt = build_hermes_prompt("[00:00] " + "training insight " * 20)
        self.assertIn("Never invent timestamps", prompt)
        self.assertIn("Return JSON only", prompt)
        self.assertIn("opening hook", prompt)

    def test_caption_presets_include_trivalley_elite(self):
        preset = get_caption_preset("trivalley_elite")
        self.assertEqual(preset["emphasis"], "luxury-bold")
        with self.assertRaises(ValueError):
            get_caption_preset("does-not-exist")

    def test_subject_crop_filter_is_bounded(self):
        filt = crop_filter(1.4, -0.2)
        self.assertIn("(iw-1080)*1.000000", filt)
        self.assertIn("(ih-1920)*0.000000", filt)
        self.assertIn("fps=24", filt)

    def test_runner_dry_run_from_scripts_path(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            temp = Path(temp_dir)
            transcript = temp / "transcript.txt"
            output = temp / "result.json"
            transcript.write_text("[00:00] " + "useful coaching sentence " * 20, encoding="utf-8")
            subprocess.run(
                [
                    sys.executable,
                    str(ROOT / "scripts" / "run_video_wizard_intelligence.py"),
                    "--transcript", str(transcript),
                    "--output", str(output),
                    "--dry-run",
                ],
                cwd=ROOT,
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=30,
            )
            payload = json.loads(output.read_text(encoding="utf-8"))
            self.assertTrue(payload["dry_run"])
            self.assertIn("Return JSON only", payload["prompt"])


if __name__ == "__main__":
    unittest.main()
