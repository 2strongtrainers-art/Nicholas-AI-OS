import os
import unittest
from unittest.mock import patch

from scripts import openmontage_moneyprinter as mpt


class MoneyPrinterRoutingTests(unittest.TestCase):
    def test_moneyprinter_is_default_fast_reel_engine(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertTrue(mpt.should_use_moneyprinter({"fast_reel": {}}))

    def test_explicit_openmontage_engine_wins(self):
        job = {"render_engine": "openmontage", "fast_reel": {}}
        with patch.dict(
            os.environ,
            {"NICHOLAS_FAST_REEL_ENGINE": "moneyprinter"},
            clear=False,
        ):
            self.assertFalse(mpt.should_use_moneyprinter(job))

    def test_explicit_disable_wins(self):
        job = {"fast_reel": {"moneyprinter": {"enabled": False}}}
        self.assertFalse(mpt.should_use_moneyprinter(job))

    def test_explicit_terms_are_preserved(self):
        job = {
            "fast_reel": {
                "moneyprinter": {
                    "broll_queries": [
                        "boxing footwork training",
                        "heavy bag combinations",
                    ]
                }
            }
        }
        self.assertEqual(
            mpt._terms_from_job(job),
            ["boxing footwork training", "heavy bag combinations"],
        )

    def test_terms_can_be_derived_without_llm(self):
        job = {
            "request": (
                "Create a Reel about explosive boxing footwork and athletic conditioning"
            ),
            "fast_reel": {"hook": "MOVE FASTER WITHOUT WASTING ENERGY"},
        }
        terms = mpt._terms_from_job(job)
        self.assertTrue(terms)
        self.assertLessEqual(len(terms), 6)

    def test_mp4_paths_are_found_recursively(self):
        payload = {
            "result": {
                "videos": [
                    {"path": "storage/tasks/a/final-1.mp4"},
                    {"url": "https://example.com/not-selected.mp4"},
                ]
            }
        }
        found = mpt._collect_mp4_strings(payload)
        self.assertIn("storage/tasks/a/final-1.mp4", found)
        self.assertIn("https://example.com/not-selected.mp4", found)

    def test_toml_assignment_replaces_existing_key(self):
        text = 'pexels_api_keys = []\nsubtitle_provider = "edge"\n'
        updated = mpt._set_toml_assignment(text, "subtitle_provider", '"whisper"')
        self.assertIn('subtitle_provider = "whisper"', updated)
        self.assertNotIn('subtitle_provider = "edge"', updated)


if __name__ == "__main__":
    unittest.main()
