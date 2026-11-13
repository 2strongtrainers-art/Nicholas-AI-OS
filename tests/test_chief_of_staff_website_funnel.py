import json
from pathlib import Path
import unittest

from chief_of_staff.revenue import scorecard
from chief_of_staff.website_funnel import summarize
from commerce.instagram.control import instant


class WebsiteFunnelTests(unittest.TestCase):
    def setUp(self):
        self.now = instant("2026-11-22T12:00:00-08:00")
        self.website = {
            "period_start": "2026-11-15T00:00:00-08:00",
            "period_end": "2026-11-22T00:00:00-08:00",
            "observations": {
                "home_views": {
                    "source": "wix_analytics", "count": 15, "reference": "synthetic traffic",
                },
                "dumbbell_paid_orders": {
                    "source": "wix_orders", "count": 0, "reference": "synthetic order report",
                },
            },
        }

    def test_unknown_remains_distinct_from_a_confirmed_zero(self):
        result = summarize(self.website, self.now)
        self.assertEqual(result["observations"]["dumbbell_paid_orders"]["count"], 0)
        self.assertIsNone(result["observations"]["guide_preview_opens"]["count"])
        self.assertTrue(result["qa_traffic_possible"])

    def test_website_counts_do_not_alter_pilot_cash(self):
        example = Path(__file__).resolve().parents[1] / "chief_of_staff/revenue.example.json"
        original = json.loads(example.read_text())
        extended = {**original, "website": self.website}
        self.assertEqual(scorecard(extended, self.now)["cash"], scorecard(original, self.now)["cash"])
        self.assertEqual(scorecard(extended, self.now)["website"]["observations"]["home_views"]["count"], 15)

    def test_checkout_traffic_cannot_be_treated_as_paid_orders(self):
        self.website["observations"]["dumbbell_paid_orders"]["source"] = "wix_analytics"
        with self.assertRaisesRegex(ValueError, "needs evidence from wix_orders"):
            summarize(self.website, self.now)

    def test_missing_reference_and_future_windows_fail_validation(self):
        self.website["observations"]["home_views"]["reference"] = ""
        with self.assertRaisesRegex(ValueError, "source reference"):
            summarize(self.website, self.now)
        self.website["period_end"] = "2026-11-23T00:00:00-08:00"
        with self.assertRaisesRegex(ValueError, "complete, ordered"):
            summarize(self.website, self.now)


if __name__ == "__main__":
    unittest.main()
