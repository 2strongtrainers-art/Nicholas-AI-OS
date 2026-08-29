import json
import tempfile
import unittest
from pathlib import Path

from tool_intelligence.registry import import_hermes_evidence, search_tools

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "hermes/research/lucaswebq-parts-351-749-evidence.jsonl"


class ToolIntelligenceTests(unittest.TestCase):
    def test_policy_counts_exact_parts_urls_and_idempotency(self):
        with tempfile.TemporaryDirectory() as temp:
            registry = Path(temp)
            first = import_hermes_evidence(SOURCE, registry)
            second = import_hermes_evidence(SOURCE, registry)
            self.assertEqual((first.parsed, first.confirmed, first.probable, first.pending), (13, 4, 3, 6))
            self.assertEqual(first, second)
            canonical = json.loads((registry / "canonical-tools.json").read_text())
            review = json.loads((registry / "probable-review.json").read_text())
            pending = json.loads((registry / "pending-evidence.json").read_text())
            self.assertEqual({r["part"] for r in canonical}, {683, 704, 736, 743})
            self.assertEqual({r["part"] for r in review}, {741, 744, 749})
            self.assertEqual({r["part"] for r in pending}, {731, 735, 737, 745, 746, 748})
            self.assertEqual({r["canonical_url"] for r in canonical}, {"https://ocw.mit.edu/", "https://yousician.com/", "https://dola.com/", "https://www.startmycar.com/"})
            self.assertTrue(all(not r.get("website_name") and not r.get("canonical_url") for r in pending))
            self.assertTrue(all(r[field] == "Unknown" for r in [*canonical, *review, *pending] for field in ("api_available", "mcp_available", "cli_available")))

    def test_existing_stronger_record_is_preserved_and_enriched(self):
        with tempfile.TemporaryDirectory() as temp:
            registry = Path(temp)
            existing = [{"part": 683, "website_name": "MIT OCW curated", "canonical_url": "https://ocw.mit.edu/", "normalized_domain": "ocw.mit.edu", "match_confidence": "Confirmed", "curator_note": "stronger human-reviewed value", "evidence_sources": ["https://example.org/curated-evidence"]}]
            (registry / "canonical-tools.json").write_text(json.dumps(existing))
            import_hermes_evidence(SOURCE, registry)
            records = json.loads((registry / "canonical-tools.json").read_text())
            mit = next(record for record in records if record["part"] == 683)
            self.assertEqual(mit["curator_note"], "stronger human-reviewed value")
            self.assertIn("https://example.org/curated-evidence", mit["evidence_sources"])
            self.assertEqual(sum(record["part"] == 683 for record in records), 1)

    def test_router_uses_confirmed_only_and_does_not_infer_interfaces(self):
        with tempfile.TemporaryDirectory() as temp:
            registry = Path(temp)
            import_hermes_evidence(SOURCE, registry)
            matches = search_tools(registry, "free lecture notes and course exams")
            self.assertEqual(matches[0]["website_name"], "MIT OpenCourseWare")
            self.assertEqual(matches[0]["route"]["mode"], "public_web")
            self.assertEqual(set(matches[0]["route"]["structured_interfaces"].values()), {"Unknown"})
            self.assertNotIn("Coursera Plus", {record["website_name"] for record in matches})

    def test_probable_evidence_enriches_existing_canonical_without_queue_duplicate(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            registry = root / "registry"
            registry.mkdir()
            existing = [{"part": 900, "website_name": "MIT OpenCourseWare", "canonical_url": "https://ocw.mit.edu/", "normalized_domain": "ocw.mit.edu", "match_confidence": "Confirmed", "evidence_sources": ["https://ocw.mit.edu/"]}]
            (registry / "canonical-tools.json").write_text(json.dumps(existing))
            record = json.loads(SOURCE.read_text().splitlines()[0])
            record.update({"part": 901, "match_confidence": "Probable"})
            source = root / "probable.jsonl"
            source.write_text(json.dumps(record) + "\n")
            summary = import_hermes_evidence(source, registry)
            canonical = json.loads((registry / "canonical-tools.json").read_text())
            review = json.loads((registry / "probable-review.json").read_text())
            self.assertEqual((summary.canonical_total, summary.review_total), (1, 0))
            self.assertEqual(canonical[0]["match_confidence"], "Confirmed")
            self.assertEqual(review, [])


if __name__ == "__main__":
    unittest.main()
