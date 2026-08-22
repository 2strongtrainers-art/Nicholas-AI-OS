import importlib.util
import unittest
from pathlib import Path


WORKER_PATH = Path(__file__).parents[1] / "scripts" / "openmontage_worker.py"
SPEC = importlib.util.spec_from_file_location("openmontage_worker", WORKER_PATH)
worker = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(worker)


class RoutingTests(unittest.TestCase):
    def test_regular_reel_defaults_to_fast(self):
        mode, reason = worker.classify_render_mode(
            {"request": "OpenMontage bridge this into an Instagram Reel."}
        )
        self.assertEqual(mode, "fast_reel")
        self.assertIn("default fast path", reason)

    def test_full_production_phrase_routes_full(self):
        mode, _ = worker.classify_render_mode(
            {"brief": "Research this and build a documentary Reel."}
        )
        self.assertEqual(mode, "full_production")

    def test_explicit_mode_wins(self):
        mode, _ = worker.classify_render_mode(
            {
                "render_mode": "fast_reel",
                "brief": "Make this cinematic with real footage from the internet.",
            }
        )
        self.assertEqual(mode, "fast_reel")

    def test_caption_lines_are_bounded(self):
        lines = worker.split_body_lines([str(n) * 150 for n in range(8)], "")
        self.assertEqual(len(lines), 6)
        self.assertTrue(all(len(line) <= 110 for line in lines))


if __name__ == "__main__":
    unittest.main()
