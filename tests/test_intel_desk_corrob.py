"""Deterministic, offline evidence-corrob contract tests."""
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import intel_desk_corrob as c


def report(title, publisher="BBC", topic="Geopolitics",
           place="Ukraine", time="2026-11-16T20:00:00Z", url=None,
           source="BBC World"):
    host = {"BBC": "bbc.com", "NPR": "npr.org", "Reuters": "reuters.com"}
    return {"kind": "report", "source": source, "topic": topic,
            "publisher": publisher, "url": url or "https://" +
            host.get(publisher, "example.gov") + "/article",
            "title": title, "mentions": [place], "observed_at": time}


def snapshot(events, generated_at="2026-11-16T21:00:00Z"):
    return {"schema": "trivalley.global-intel.v1",
            "generated_at": generated_at, "events": events,
            "source_health": [], "connections": []}


def receipt():
    key = "global-intel-20261116210000"
    return {"schema": "trivalley.global-intel-review.v1",
            "receipt_key": key, "source_generated_at": "2026-11-16T21:00:00Z",
            "chief_snapshot": {"run_id": key, "items": [
                {"source": "github", "id": "global-intel-public-readonly"}]}}


class CorrobTests(unittest.TestCase):
    def test_independent_publisher_headline_lead_not_confirmed_incident(self):
        a = report("Ukraine drone strike damages strategic bridge", "BBC")
        b = report("Ukraine bridge strike: drone damages crossing", "NPR",
                   time="2026-11-16T19:30:00Z")
        data = c.make_report(snapshot([a, b]))
        self.assertEqual(data["counts"]["cross_publisher_leads"], 1)
        lead = data["cross_publisher_leads"][0]
        self.assertEqual(lead["publisher_families"], ["BBC", "NPR"])
        self.assertEqual(lead["classification"], "CROSS_PUBLISHER_COVERAGE_LEAD")
        self.assertIn("not an independently verified event", lead["caveat"])

    def test_same_publisher_or_same_generic_location_never_counts(self):
        a = report("Ukraine drone strike damages strategic bridge", "BBC")
        b = report("Ukraine strategic bridge hit by drone strike", "BBC",
                   url="https://bbc.com/second")
        self.assertEqual(c.make_report(snapshot([a, b]))["counts"]["cross_publisher_leads"], 0)
        c1 = report("United States missile strike reported overseas", "BBC",
                    place="United States")
        c2 = report("United States missile strike reported elsewhere", "NPR",
                    place="United States")
        self.assertEqual(c.make_report(snapshot([c1, c2]))["counts"]["cross_publisher_leads"], 0)

    def test_distinct_incident_types_no_joint_attack_claim(self):
        a = report("Ukraine drone strike damages strategic bridge", "BBC")
        b = report("Ukraine sanction restriction affects bridge trade", "NPR")
        self.assertEqual(c.make_report(snapshot([a, b]))["counts"]["cross_publisher_leads"], 0)

    def test_future_dates_and_wrong_topic_are_excluded(self):
        future = report("Ukraine drone strike damages strategic bridge",
                        time="2026-11-16T22:20:00Z")
        misc = report("Actor accepts film prize", topic="Geopolitics")
        auto = report("Ukraine drone strike damages strategic bridge", source="GDELT event data")
        data = c.make_report(snapshot([future, misc, auto]))
        excluded = data["counts"]["excluded_by_reason"]
        self.assertEqual(excluded["future_dated"], 1)
        self.assertEqual(excluded["off_topic_headline"], 1)
        self.assertEqual(excluded["catalog_or_automated_coding"], 1)

    def test_official_is_lead_not_claim_verification(self):
        a = report("Federal Reserve adjusts interest rates", publisher="Federal Reserve",
                   source="Federal Reserve", topic="Economy",
                   place="United States", url="https://www.federalreserve.gov/news.htm")
        data = c.make_report(snapshot([a]))
        self.assertEqual(len(data["official_publication_leads"]), 1)
        self.assertEqual(data["official_publication_leads"][0]["classification"],
                         "OFFICIAL_PUBLICATION_LEAD")
        self.assertEqual(data["counts"]["cross_publisher_leads"], 0)

    def test_receipt_same_key_without_false_chief_ack_or_spend(self):
        data = c.make_report(snapshot([]))
        r = c.amend_receipt(receipt(), data)
        self.assertEqual(r["corroboration"]["claim_level"], "LEAD_ONLY_UNVERIFIED")
        self.assertEqual(r["paid_provider_calls"], 0)
        self.assertEqual(r["outbound_actions"], 0)
        self.assertIn("acknowledgment_not_observed", r["chief_delivery"])
        self.assertEqual(len(r["chief_snapshot"]["items"]), 2)
        self.assertEqual(r["chief_snapshot"]["items"][1]["id"],
                         "global-intel-corroboration-review")
        with self.assertRaises(ValueError):
            c.amend_receipt(dict(r, receipt_key="global-intel-other"), data)

    def test_invalid_snapshots_fail_closed(self):
        with self.assertRaises(ValueError):
            c.make_report({"schema": "incorrect", "generated_at": "2026-11-16T21:00:00Z", "events": []})
        with self.assertRaises(ValueError):
            c.make_report(snapshot([{}] * 301))
        self.assertIsNone(c.stamp("not-a-date"))


if __name__ == "__main__":
    unittest.main()
