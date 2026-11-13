import importlib.util
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
import tempfile
import unittest

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]


def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / (name + ".py"))
    loaded = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loaded)
    return loaded


renderer = module("render_trivalley_lesson")
planner = module("trivalley_creator_preflight")


class CreatorPlanTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime.now(timezone.utc)
        self.brief = {"schema_version": 1, "template": "coach-cue", "topic": "Guide setup",
                      "audience": "Guide owners", "takeaway": "Know where to begin", "cta": "Open your guide",
                      "sources": [{"reference": "owned workbook", "reviewed": True}], "claims_reviewed": True,
                      "max_estimated_credits": 500, "max_variations": 2,
                      "generation_plan": [{"id": "narration", "node_type": "tts", "model_id": "live-model",
                                           "estimated_credits_per_variation": 100, "variations": 2}]}
        self.snapshot = {"fetched_at": self.now.isoformat(), "node_types": [
            {"type": "tts", "available_models": [{"id": "live-model"}]}]}

    def test_paid_policy_defaults_closed_without_discarding_local_work(self):
        result = planner.preflight(self.brief, self.snapshot, now=self.now)
        self.assertFalse(result["generation_permitted"])
        self.assertEqual(result["estimated_credits"], 200)
        self.assertEqual(result["provider_calls_performed"], 0)

    def test_explicit_policy_still_requires_cap_model_and_current_snapshot(self):
        self.assertTrue(planner.preflight(self.brief, self.snapshot, allow_paid_ai=True, now=self.now)["generation_permitted"])
        self.brief["max_estimated_credits"] = 199
        with self.assertRaisesRegex(ValueError, "credit cap"):
            planner.preflight(self.brief, self.snapshot, allow_paid_ai=True, now=self.now)
        self.brief["max_estimated_credits"] = 500
        self.snapshot["fetched_at"] = (self.now - timedelta(days=2)).isoformat()
        with self.assertRaisesRegex(ValueError, "24 hours"):
            planner.preflight(self.brief, self.snapshot, allow_paid_ai=True, now=self.now)

    def test_unavailable_model_and_duplicate_jobs_fail(self):
        self.brief["generation_plan"][0]["model_id"] = "remembered-model"
        with self.assertRaisesRegex(ValueError, "absent"):
            planner.preflight(self.brief, self.snapshot, now=self.now)
        self.brief["generation_plan"][0]["model_id"] = "live-model"
        self.brief["generation_plan"].append(dict(self.brief["generation_plan"][0]))
        with self.assertRaisesRegex(ValueError, "unique"):
            planner.preflight(self.brief, self.snapshot, now=self.now)


class LessonRenderTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.folder = Path(self.temp.name)
        Image.new("RGB", (720, 1280), "#08131f").save(self.folder / "frame.png")
        (self.folder / "voice.wav").touch()
        self.job = {"schema_version": 1, "episode_id": "lesson-smoke-test", "language": "es", "duration": 8,
                    "narration": "voice.wav", "shots": [{"kind": "image", "source": "frame.png", "start": 0, "end": 8}],
                    "captions": [{"start": .2, "end": 3, "text": "Tu primera semana, más clara."}]}

    def write(self):
        path = self.folder / "job.json"
        path.write_text(json.dumps(self.job))
        return path

    def test_path_traversal_and_symlinks_fail_before_render(self):
        self.job["shots"][0]["source"] = "../frame.png"
        with self.assertRaisesRegex(ValueError, "inside"):
            renderer.load_job(self.write())
        (self.folder / "alias.png").symlink_to(self.folder / "frame.png")
        self.job["shots"][0]["source"] = "alias.png"
        with self.assertRaisesRegex(ValueError, "symlink"):
            renderer.load_job(self.write())

    def test_discontinuous_timeline_and_missing_captions_fail(self):
        self.job["shots"][0]["start"] = 1
        with self.assertRaisesRegex(ValueError, "contiguous"):
            renderer.load_job(self.write())
        self.job["shots"][0]["start"] = 0
        self.job["captions"] = []
        with self.assertRaisesRegex(ValueError, "timed"):
            renderer.load_job(self.write())

    def test_caption_commands_cannot_change_ass_layout(self):
        self.assertEqual(renderer.ass_text("{\\pos(1,1)}Hello"), "pos(1,1)Hello")

    def test_malformed_transcript_fails_before_render(self):
        self.job["transcript"] = "timing.json"
        for bad_words in (None, ["word"], [{"text": None}]):
            (self.folder / "timing.json").write_text(json.dumps({"words": bad_words}))
            with self.assertRaises(ValueError):
                renderer.load_job(self.write())

    def test_local_render_retains_audio_captions_and_faststart(self):
        renderer.ffmpeg("-f", "lavfi", "-i", "sine=frequency=440:duration=6", self.folder / "voice.wav")
        out = self.folder / "output"
        manifest = renderer.render(self.write(), out)
        self.assertEqual(manifest["status"], "technical_qa_passed")
        self.assertEqual(manifest["publication"], "not_performed")
        self.assertEqual(manifest["caption_timing_source"], "reviewed_cues")
        self.assertAlmostEqual(manifest["duration"], 8, delta=.1)
        self.assertIn("más clara", (out / manifest["subtitles"]).read_text())
        quality = json.loads((out / "lesson-smoke-test.qa.json").read_text())
        self.assertTrue(quality["faststart"])
        self.assertEqual(quality["visual_review"], "pending")


if __name__ == "__main__":
    unittest.main()
