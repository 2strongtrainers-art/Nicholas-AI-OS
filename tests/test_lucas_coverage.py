import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "tool-intelligence"


def read(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


class LucasCoverageTests(unittest.TestCase):
    def test_every_part_351_749_is_accounted_once(self):
        coverage = read("lucas-coverage-351-749.json")
        confirmed = read("canonical-tools.json")
        probable = read("probable-review.json")
        pending = read("pending-evidence.json")

        confirmed_parts = {int(row["part"]) for row in confirmed}
        probable_parts = {int(row["part"]) for row in probable}
        pending_parts = {int(row["part"]) for row in pending}
        unrecovered = set(map(int, coverage["source_not_recovered_parts"]))

        self.assertEqual(confirmed_parts, set(coverage["confirmed_parts"]))
        self.assertEqual(probable_parts, set(coverage["probable_parts"]))
        self.assertEqual(pending_parts, set(coverage["pending_source_recovered_parts"]))

        buckets = [confirmed_parts, probable_parts, pending_parts, unrecovered]
        for i, left in enumerate(buckets):
            for right in buckets[i + 1:]:
                self.assertTrue(left.isdisjoint(right))

        expected = set(range(351, 750))
        accounted = set().union(*buckets)
        self.assertEqual(accounted, expected)
        self.assertEqual(len(accounted), 399)

        counts = coverage["counts"]
        self.assertEqual(counts["confirmed"], len(confirmed_parts))
        self.assertEqual(counts["probable"], len(probable_parts))
        self.assertEqual(counts["pending_source_recovered"], len(pending_parts))
        self.assertEqual(counts["source_not_recovered"], len(unrecovered))
        self.assertEqual(counts["accounted_total"], 399)

    def test_confidence_buckets_do_not_overclaim(self):
        confirmed = read("canonical-tools.json")
        probable = read("probable-review.json")
        pending = read("pending-evidence.json")

        for row in confirmed:
            self.assertEqual(row.get("match_confidence"), "Confirmed")
            self.assertTrue(row.get("website_name"))
            self.assertTrue(row.get("canonical_url"))
            self.assertTrue(row.get("lucas_source_url"))

        for row in probable:
            self.assertEqual(row.get("match_confidence"), "Probable")
            self.assertTrue(row.get("website_name"))
            self.assertTrue(row.get("canonical_url"))

        for row in pending:
            self.assertEqual(row.get("match_confidence"), "Pending")
            self.assertTrue(row.get("lucas_source_url"))
            self.assertTrue(row.get("video_id"))
            self.assertFalse(row.get("website_name"))
            self.assertFalse(row.get("canonical_url"))


if __name__ == "__main__":
    unittest.main()
