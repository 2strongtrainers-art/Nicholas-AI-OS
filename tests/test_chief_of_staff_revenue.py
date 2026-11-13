import json
from pathlib import Path
import unittest

from chief_of_staff.revenue import scorecard
from commerce.instagram.control import instant


EXAMPLE = Path(__file__).resolve().parents[1] / "chief_of_staff/revenue.example.json"


class RevenueScorecardTests(unittest.TestCase):
    def setUp(self):
        self.snapshot = json.loads(EXAMPLE.read_text())
        self.now = instant("2026-11-22T12:00:00-08:00")

    def test_cash_contribution_ignores_pipeline_and_avoided_expense(self):
        self.snapshot.update(verified_avoided_expense_cents=1000, avoided_expense_evidence="baseline receipt")
        result = scorecard(self.snapshot, self.now)
        self.assertEqual(result["cash"]["contribution_cents"], 28750)
        self.assertEqual(result["estimated_pipeline_value_cents"], 50000)
        self.assertEqual(result["verified_avoided_expense_cents"], 1000)

    def test_bookings_can_exist_without_a_sale(self):
        self.snapshot["pipeline"]["paid_customers"] = 0
        self.snapshot["metrics"].update(settled_sales=0, gross_revenue_cents=0)
        result = scorecard(self.snapshot, self.now)
        self.assertEqual(result["pipeline"]["booked_calls"], 2)
        self.assertEqual(result["cash"]["paid_orders"], 0)
        self.assertEqual(result["cash"]["contribution_cents"], -950)

    def test_avoided_expense_needs_a_reference(self):
        self.snapshot["verified_avoided_expense_cents"] = 1000
        with self.assertRaisesRegex(ValueError, "requires evidence"):
            scorecard(self.snapshot, self.now)

    def test_rejects_an_impossible_pipeline_and_incomplete_cash_costs(self):
        self.snapshot["pipeline"]["positive_replies"] = 9
        with self.assertRaisesRegex(ValueError, "exceed"):
            scorecard(self.snapshot, self.now)
        self.snapshot["pipeline"]["positive_replies"] = 2
        self.snapshot["metrics"]["costs_complete"] = False
        with self.assertRaisesRegex(ValueError, "incomplete_costs"):
            scorecard(self.snapshot, self.now)

    def test_rejects_unmatched_customer_and_sales_totals(self):
        self.snapshot["pipeline"]["paid_customers"] = 2
        with self.assertRaisesRegex(ValueError, "disagree"):
            scorecard(self.snapshot, self.now)


if __name__ == "__main__":
    unittest.main()
