"""Offline, no-network tests for the global intelligence desk."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import intel_desk_ingest as s


class NormalizationTests(unittest.TestCase):
    def test_url_validation_and_xss_boundary(self):
        self.assertEqual(s.safe_url("javascript:alert(1)"), "")
        self.assertEqual(s.safe_url("https://localhost/admin"), "")
        self.assertEqual(s.safe_url("https://example.org/report"), "https://example.org/report")
        self.assertIsNone(s.normalize_article({"url": "javascript:alert(1)", "title": "bad"}, "Security"))

    def test_article_preserves_provenance_and_no_fake_coordinate(self):
        a = s.normalize_article({
            "url": "https://news.example.org/a",
            "domain": "news.example.org",
            "title": "Iran and Ukraine face sanctions",
            "seendate": "20261116T104500Z",
        }, "Geopolitics")
        self.assertEqual(a["source"], "GDELT")
        self.assertEqual(a["observed_at"], "2026-11-16T10:45:00Z")
        self.assertEqual(a["position"], None)
        self.assertEqual(a["mentions"], ["Iran", "Ukraine"])
        self.assertIn("unverified", a["trust"].lower())

    def test_quake_has_real_position(self):
        f = {"id": "quake-1", "geometry": {"coordinates": [32.4, -2.7, 12.0]},
             "properties": {"mag": 5.2, "place": "Synthetic test area", "time": 1794840000000,
                            "url": "https://earthquake.usgs.gov/earthquakes/eventpage/quake-1"}}
        e = s.normalize_quake(f)
        self.assertEqual(e["position"], [-2.7, 32.4])
        self.assertIn("M5.2", e["title"])

    def test_bad_positions_rejected(self):
        for p in (None, [], [300, 2], ["x", 4], [True, 1]):
            self.assertIsNone(s.valid_coordinates(p))

    def test_eonet_rejects_polygon_instead_of_fabricating_point(self):
        f = {"properties": {"id": "test", "title": "Storm",
                            "link": "https://eonet.gsfc.nasa.gov/api/v3/events/test"},
             "geometry": {"type": "Polygon", "coordinates": [[[0, 0], [1, 1], [0, 0]]]}}
        self.assertIsNone(s.normalize_eonet(f))

    def test_connections_require_distinct_topics_and_publishers(self):
        def a(topic, domain, title, n):
            return {"kind": "report", "source": "GDELT", "topic": topic,
                    "publisher": domain, "title": title, "mentions": s.headline_mentions(title),
                    "url": "https://" + domain + "/" + str(n), "observed_at": s.now_iso()}
        items = [a("Energy", "a.example", "Iran oil tanker incident", 1),
                 a("Geopolitics", "b.example", "Iran sanctions announced", 2),
                 a("Energy", "a.example", "Unrelated hurricane", 3)]
        out = s.connections(items)
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["place_mention"], "Iran")
        self.assertEqual(out[0]["classification"], "CANDIDATE_ONLY")
        self.assertIn("no causation", out[0]["method"])

    def test_no_connection_from_one_publisher(self):
        a = {"kind": "report", "topic": "Energy", "publisher": "same.example",
             "mentions": ["Taiwan"], "title": "Taiwan A", "url": "https://same.example/a", "observed_at": s.now_iso()}
        b = dict(a, topic="Geopolitics", title="Taiwan B", url="https://same.example/b")
        self.assertEqual(s.connections([a, b]), [])

    def test_official_rss_preserves_identity_and_does_not_geolocate(self):
        xml = """<item><title>Iran sanctions and oil market alert</title>
            <link>https://www.state.gov/synthetic-test-article</link>
            <pubDate>Mon, 16 Nov 2026 21:00:00 GMT</pubDate></item>"""
        item = s.ET.fromstring(xml)
        data = s.normalize_rss_item(item, "State Department", "Geopolitics")
        self.assertEqual(data["source"], "State Department")
        self.assertEqual(data["trust"], "Official agency publication")
        self.assertEqual(data["position"], None)
        self.assertEqual(data["observed_at"], "2026-11-16T21:00:00Z")
        self.assertIn("Iran", data["mentions"])

    def test_rss_rejects_injected_non_https_link(self):
        xml = "<item><title>Test</title><link>javascript:alert(1)</link></item>"
        self.assertIsNone(s.normalize_rss_item(s.ET.fromstring(xml), "CISA", "Security"))

    def test_old_reports_are_not_connection_candidates(self):
        x = {"kind":"report", "topic":"Geopolitics", "publisher":"a.gov",
             "title":"Iran sanctions", "mentions":["Iran"], "url":"https://a.gov/a",
             "observed_at":"2026-01-01T00:00:00Z"}
        y = dict(x, topic="Economy", publisher="b.gov", url="https://b.gov/b")
        self.assertEqual(s.connections([x,y]), [])

    def test_gdelt_date_fail_closed(self):
        self.assertIsNone(s.parse_gdelt_date("yesterday"))
        self.assertIsNone(s.parse_gdelt_date(None))


if __name__ == "__main__":
    unittest.main()
