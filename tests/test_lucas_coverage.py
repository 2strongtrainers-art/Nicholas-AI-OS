import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "tool-intelligence"


def read(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def load_source_recovery(coverage):
    rows = []
    for rel in coverage["source_recovery_files"]:
        payload = json.loads((ROOT / rel).read_text(encoding="utf-8"))
        if payload.get("creator"):
            assert payload["creator"] == "@lucaswebq"
        rows.extend(payload.get("records", []))
    return rows


def load_source_not_recovered(coverage):
    payload = json.loads((ROOT / coverage["source_not_recovered_file"]).read_text(encoding="utf-8"))
    if payload.get("creator"):
        assert payload["creator"] == "@lucaswebq"
    return payload


class LucasCoverageTests(unittest.TestCase):
    def test_every_part_351_749_is_accounted_once(self):
        coverage = read("lucas-coverage-351-749.json")
        confirmed = read("canonical-tools.json")
        probable = read("probable-review.json")
        pending = read("pending-evidence.json")
        recovered = load_source_recovery(coverage)

        confirmed_parts = {int(row["part"]) for row in confirmed}
        probable_parts = {int(row["part"]) for row in probable}
        recovered_parts = {int(row["part"]) for row in recovered}
        unresolved = recovered_parts - confirmed_parts - probable_parts
        unrecovered = set(map(int, coverage["source_not_recovered_parts"]))
        pending_parts = {int(row["part"]) for row in pending}

        self.assertEqual(len(recovered), len(recovered_parts), "duplicate Part in source-recovery files")
        self.assertEqual(confirmed_parts, set(coverage["confirmed_parts"]))
        self.assertEqual(probable_parts, set(coverage["probable_parts"]))
        self.assertEqual(unresolved, set(coverage["source_recovered_unresolved_parts"]))
        self.assertTrue(pending_parts.issubset(unresolved), "deep pending evidence must remain unresolved")

        buckets = [confirmed_parts, probable_parts, unresolved, unrecovered]
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
        self.assertEqual(counts["source_recovered_unresolved"], len(unresolved))
        self.assertEqual(counts["source_recovered_total"], len(recovered_parts))
        self.assertEqual(counts["source_not_recovered"], len(unrecovered))
        self.assertEqual(counts["accounted_total"], 399)

    def test_source_recovery_is_exact_and_auditable(self):
        coverage = read("lucas-coverage-351-749.json")
        recovered = load_source_recovery(coverage)
        video_ids = []
        for row in recovered:
            part = int(row["part"])
            self.assertGreaterEqual(part, 351)
            self.assertLessEqual(part, 749)
            video_id = str(row.get("video_id") or "")
            self.assertTrue(video_id.isdigit())
            self.assertEqual(row.get("lucas_source_url"), f"https://www.tiktok.com/@lucaswebq/video/{video_id}")
            self.assertTrue(row.get("caption_hint"))
            video_ids.append(video_id)
        self.assertEqual(len(video_ids), len(set(video_ids)), "duplicate Lucas video id")

    def test_unrecovered_backlog_is_explicit_and_safe(self):
        coverage = read("lucas-coverage-351-749.json")
        payload = load_source_not_recovered(coverage)
        rows = payload.get("records", [])
        parts = [int(row["part"]) for row in rows]

        self.assertEqual(payload.get("status"), "source_not_recovered")
        self.assertEqual(payload.get("record_count"), 336)
        self.assertEqual(len(rows), 336)
        self.assertEqual(len(parts), len(set(parts)), "duplicate Part in unrecovered backlog")
        self.assertEqual(set(parts), set(map(int, coverage["source_not_recovered_parts"])))

        for row in rows:
            self.assertEqual(row.get("status"), "source_not_recovered")
            self.assertIsNone(row.get("source"))
            self.assertIsNone(row.get("video_id"))
            self.assertIsNone(row.get("caption_hint"))
            self.assertIsNone(row.get("website_identity"))
            self.assertFalse(row.get("routing_enabled"))

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
