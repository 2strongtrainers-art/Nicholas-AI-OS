"""Regression tests for ARGUS fail-closed event graph."""
import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from argus_event_graph import GraphIntegrityError, validate_graph, to_networkx  # noqa

FIXTURE = ROOT / "tests" / "fixtures" / "argus-event-graph.synthetic.json"


class EventGraphTests(unittest.TestCase):
    def setUp(self):
        self.doc = json.loads(FIXTURE.read_text())

    def fail_reason(self, fragment):
        with self.assertRaises(GraphIntegrityError) as ctx:
            validate_graph(self.doc)
        self.assertIn(fragment, str(ctx.exception))

    def test_valid_fixture_and_multidigraph(self):
        counts = validate_graph(self.doc)
        self.assertEqual(counts["events"], 3)
        self.assertEqual(counts["sources"], 2)
        self.assertEqual(counts["candidate_links"], 1)
        g = to_networkx(self.doc)
        self.assertEqual(g.number_of_nodes(), 5)
        self.assertEqual(g.number_of_edges(), 4)
        self.assertTrue(g.has_edge("evt-a", "evt-b"))
        self.assertTrue(g.has_edge("source-1", "evt-a"))

    def test_bad_legacy_cross_theater_link_rejected(self):
        # Regression: a prior ARGUS link joined an Iraq event to Sudan while
        # asserting a Sudan/Ethiopia relationship. Referential validity alone
        # would not catch this semantic category error.
        self.doc["relationships"][0]["source_event_id"] = "evt-c"
        self.fail_reason("no shared controlled context tags")

    def test_orphan_event_source_rejected(self):
        self.doc["events"][0]["source_ids"] = ["missing-id"]
        self.fail_reason("orphan source_id")

    def test_orphan_link_endpoint_rejected(self):
        self.doc["relationships"][0]["target_event_id"] = "evt-missing"
        self.fail_reason("dangling or self-referential")

    def test_reversed_temporal_link_rejected(self):
        self.doc["relationships"][0].update(
            source_event_id="evt-b", target_event_id="evt-a")
        self.fail_reason("reversed temporal sequence")

    def test_inferred_causality_rejected(self):
        self.doc["relationships"][0]["type"] = "Caused"
        self.fail_reason("disallowed relationship type")

    def test_only_one_publisher_cannot_validate_documented_interaction(self):
        self.doc["relationships"][0].update(
            type="Documented interaction", review_status="reviewed",
            source_ids=["source-1"])
        self.fail_reason(">=2 source families")

    def test_candidate_hypothesis_cannot_be_reviewed(self):
        self.doc["relationships"][0].update(
            type="Hypothesis", review_status="reviewed")
        self.fail_reason("hypotheses cannot be promoted")

    def test_duplicate_event_id_rejected(self):
        duplicate = copy.deepcopy(self.doc["events"][0])
        self.doc["events"].append(duplicate)
        self.fail_reason("duplicate event id")

    def test_future_event_rejected(self):
        self.doc["events"][0]["occurred_on"] = "2027-11-01"
        self.fail_reason("event occurs after cutoff")

    def test_http_source_rejected(self):
        self.doc["sources"][0]["url"] = "http://example.org/unsafe"
        self.fail_reason("source URL must be absolute HTTPS")

    def test_relationship_source_must_belong_to_endpoint(self):
        self.doc["sources"].append({
            "id": "source-3", "title": "Unrelated record",
            "publisher_family": "Separate publisher",
            "url": "https://example.org/not-attached-to-either-endpoint"})
        self.doc["relationships"][0]["source_ids"] = ["source-3"]
        self.fail_reason("relationship sources are not cited by endpoint events")

    def test_related_link_requires_context_tag(self):
        self.doc["events"][1]["tags"] = []
        self.doc["relationships"][0]["type"] = "Shared subject"
        self.fail_reason("no shared controlled context tags")


if __name__ == "__main__":
    unittest.main()
