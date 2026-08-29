import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "tool-intelligence"


class LucasProbableUpdateTests(unittest.TestCase):
    def load(self, name):
        return json.loads((DATA / name).read_text(encoding="utf-8"))

    def test_new_probables_are_review_only_evidence(self):
        probable = {row["part"]: row for row in self.load("probable-review.json")}
        self.assertEqual(set(probable), {741, 744, 745, 746, 748, 749})
        self.assertEqual(probable[745]["website_name"], "Post Bridge")
        self.assertEqual(probable[746]["website_name"], "Chordify")
        self.assertEqual(probable[748]["website_name"], "Planner 5D")
        self.assertTrue(all(row["match_confidence"] == "Probable" for row in probable.values()))

    def test_pending_remains_identity_free(self):
        pending = {row["part"]: row for row in self.load("pending-evidence.json")}
        self.assertEqual(set(pending), {731, 735, 737})
        for row in pending.values():
            self.assertEqual(row["website_name"], "")
            self.assertEqual(row["canonical_url"], "")
            self.assertEqual(row["match_confidence"], "Pending")

    def test_post_bridge_interfaces_are_evidence_backed_not_execution_claims(self):
        probable = {row["part"]: row for row in self.load("probable-review.json")}
        row = probable[745]
        self.assertTrue(str(row["api_available"]).startswith("Yes"))
        self.assertTrue(str(row["mcp_available"]).startswith("Yes"))
        self.assertIn("separately authenticated", row["agent_accessible"])


if __name__ == "__main__":
    unittest.main()
