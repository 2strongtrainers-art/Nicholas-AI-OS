import importlib.util
import sys
import unittest
from pathlib import Path


SCRIPTS = Path(__file__).parents[1] / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

MODULE_PATH = SCRIPTS / "openmontage_fast_reel_edl.py"
SPEC = importlib.util.spec_from_file_location("openmontage_fast_reel_edl", MODULE_PATH)
edl = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(edl)


class FastReelEdlTests(unittest.TestCase):
    def test_accepts_string_and_trimmed_object_clips(self):
        clips = edl.normalize_clip_specs(
            {
                "clips": [
                    "clip-a.mp4",
                    {"media": "clip-b.mov", "start_seconds": 2, "end_seconds": 7.5},
                ]
            }
        )
        self.assertEqual(len(clips), 2)
        self.assertEqual(clips[0]["start_seconds"], 0.0)
        self.assertIsNone(clips[0]["duration_seconds"])
        self.assertEqual(clips[1]["duration_seconds"], 5.5)

    def test_rejects_non_positive_trim(self):
        with self.assertRaises(RuntimeError):
            edl.normalize_clip_specs(
                {"clips": [{"media": "clip.mp4", "start_seconds": 5, "end_seconds": 4}]}
            )

    def test_caps_clip_count(self):
        with self.assertRaises(RuntimeError):
            edl.normalize_clip_specs({"clips": ["clip.mp4"] * (edl.MAX_CLIPS + 1)})


if __name__ == "__main__":
    unittest.main()
