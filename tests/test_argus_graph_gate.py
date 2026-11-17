"""Prove the ARGUS graph gate does not certify incidents or bypass Chief schema."""
from copy import deepcopy
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "chief_of_staff"))
import argus_graph_gate as gate
import brief as chief
from argus_event_graph import GraphIntegrityError

FIXTURE = ROOT / "tests" / "fixtures" / "argus-event-graph.synthetic.json"
NOW = datetime(2026, 11, 17, 21, 0, tzinfo=timezone.utc)


class GateTests(unittest.TestCase):
    def setUp(self):
        self.doc = json.loads(FIXTURE.read_text(encoding="utf-8"))

    def test_structural_pass_is_not_intelligence_certification(self):
        receipt, snapshot = gate.make_outputs(self.doc, as_of=NOW)
        self.assertEqual(receipt["status"], "STRUCTURAL_PASS_REVIEW_REQUIRED")
        self.assertEqual(receipt["causal_links_certified"], 0)
        self.assertEqual(receipt["human_analyst_review"], "not_observed")
        self.assertIsNone(receipt["n8n_execution_id"])
        self.assertEqual(receipt["chief_delivery"], "normalized_output_prepared; acknowledgment_not_observed")
        self.assertEqual(receipt["metrics"]["events"], 3)
        self.assertEqual(snapshot["items"][0]["priority"], "high")
        run_id, at, coverage, items = chief.normalize(snapshot)
        self.assertEqual(len(items), 1)
        self.assertEqual(coverage["github"], "partial")
        self.assertEqual(run_id, snapshot["run_id"])

    def test_deterministic_digest_and_no_private_source_leakage(self):
        a, _ = gate.make_outputs(self.doc, as_of=NOW)
        b, _ = gate.make_outputs(deepcopy(self.doc), as_of=NOW)
        self.assertEqual(a["input_sha256"], b["input_sha256"])
        text = json.dumps(a)
        self.assertNotIn("Fictional harbor", text)
        self.assertNotIn("https://example.org", text)
        self.assertNotIn("fictional-maritime", text)

    def test_bad_endpoint_blocks_both_outputs(self):
        self.doc["relationships"][0]["target_event_id"] = "not-a-valid-event"
        with self.assertRaises(GraphIntegrityError):
            gate.make_outputs(self.doc, as_of=NOW)

    def test_unrelated_link_cannot_pass(self):
        self.doc["relationships"][0]["target_event_id"] = "evt-c"
        with self.assertRaises(GraphIntegrityError):
            gate.make_outputs(self.doc, as_of=NOW)

    def test_private_receipt_permissions(self):
        receipt, _ = gate.make_outputs(self.doc, as_of=NOW)
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "receipt.json"
            gate.private_write(path, receipt)
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            self.assertEqual(json.loads(path.read_text())["status"], "STRUCTURAL_PASS_REVIEW_REQUIRED")

    def test_receipt_and_snapshot_must_not_alias(self):
        with tempfile.TemporaryDirectory() as folder:
            case = Path(folder) / "case.json"
            out = Path(folder) / "output.json"
            case.write_text(json.dumps(self.doc))
            result = gate.main([str(case), "--receipt", str(out), "--chief-snapshot", str(out)])
            self.assertEqual(result, 2)
            self.assertFalse(out.exists())

    def test_input_is_never_an_output(self):
        with tempfile.TemporaryDirectory() as folder:
            case = Path(folder) / "case.json"
            case.write_text(json.dumps(self.doc))
            ret = gate.main([str(case), "--receipt", str(case), "--chief-snapshot", str(Path(folder) / "other.json")])
            self.assertEqual(ret, 2)
            self.assertEqual(json.loads(case.read_text())["events"][0]["id"], "evt-a")


if __name__ == "__main__":
    unittest.main()
