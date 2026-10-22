import copy
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("commerce_control", ROOT / "control.py")
C = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(C)
NOW = datetime(2026, 10, 22, 18, tzinfo=timezone.utc)


class CommerceTests(unittest.TestCase):
    def setUp(self):
        self.config = C.load(ROOT / "config.json")
        self.metrics = dict(currency="USD", costs_complete=True, settled_sales=10,
                            gross_revenue_cents=19000, period_start="2026-10-01T00:00:00Z",
                            period_end=NOW.isoformat(), as_of=NOW.isoformat(),
                            **{k: 0 for k in C.COSTS})

    def test_default_cannot_launch(self):
        result = C.report(self.config, now=NOW)
        self.assertEqual(result["launch_status"], "BLOCKED")
        self.assertIn("CHECKOUT_TEST_UNVERIFIED", result["blockers"])
        self.assertFalse(result["live_execution_enabled"])
        self.assertEqual(result["external_actions_taken"], [])

    def test_every_cost_included(self):
        self.metrics.update({k: 1000 for k in C.COSTS})
        result = C.economics(self.metrics, self.config["policy"], NOW)
        self.assertEqual(result["net_profit_cents"], 12000)
        self.assertEqual(result["total_costs_cents"], 7000)

    def test_loss_recommends_stop_without_taking_action(self):
        self.metrics["advertising_cents"] = 20000
        result = C.report(self.config, self.metrics, now=NOW)
        self.assertEqual(result["economics"]["recommendation"], "STOP_NEW_SPEND_REVIEW_LOSS")
        self.assertIn("ECONOMICS_REVIEW_REQUIRED", result["blockers"])
        self.assertEqual(result["external_actions_taken"], [])

    def test_positive_small_sample_does_not_scale(self):
        self.metrics.update(settled_sales=1, gross_revenue_cents=1900)
        self.assertEqual(C.economics(self.metrics, self.config["policy"], NOW)["recommendation"],
                         "HOLD_INSUFFICIENT_SALES")

    def test_zero_sales_and_costs_is_not_profit_proof(self):
        self.metrics.update(settled_sales=0, gross_revenue_cents=0)
        out = C.economics(self.metrics, self.config["policy"], NOW)
        self.assertIsNone(out["net_margin"])
        self.assertEqual(out["recommendation"], "HOLD_INSUFFICIENT_SALES")

    def test_below_margin_holds(self):
        self.metrics["labor_cents"] = 15000
        self.assertEqual(C.economics(self.metrics, self.config["policy"], NOW)["recommendation"],
                         "HOLD_MARGIN_BELOW_TARGET")

    def test_missing_cost_never_means_zero(self):
        for key in C.COSTS:
            with self.subTest(key=key):
                data = copy.deepcopy(self.metrics)
                del data[key]
                self.assertIn("SALES_AND_COST_DATA_INVALID_OR_STALE",
                              C.report(self.config, data, now=NOW)["blockers"])

    def test_incomplete_costs_rejected(self):
        self.metrics["costs_complete"] = False
        with self.assertRaises(ValueError):
            C.economics(self.metrics, self.config["policy"], NOW)

    def test_invalid_amounts_rejected(self):
        for value in (-1, True, 1.2, "100", float("nan"), 10**13):
            with self.subTest(value=str(value)), self.assertRaises(ValueError):
                C.integer(value, "cents")

    def test_invalid_periods_rejected(self):
        for key, value in [("as_of", "2026-10-23T00:00:00Z"),
                           ("as_of", "2026-10-22T18:00:00"),
                           ("period_start", "2026-10-23T00:00:00Z"),
                           ("period_start", "2026-01-01T00:00:00Z"),
                           ("period_end", "2026-10-10T00:00:00Z")]:
            data = copy.deepcopy(self.metrics)
            data[key] = value
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                C.economics(data, self.config["policy"], NOW)

    def test_stale_asof_rejected(self):
        old = NOW - timedelta(days=3)
        self.metrics.update(as_of=old.isoformat(), period_end=old.isoformat())
        with self.assertRaises(ValueError):
            C.economics(self.metrics, self.config["policy"], NOW)

    def test_inconsistent_sales_rejected(self):
        self.metrics["settled_sales"] = 0
        with self.assertRaises(ValueError):
            C.economics(self.metrics, self.config["policy"], NOW)

    def test_sufficient_current_evidence_only_allows_review(self):
        self.config["offer"].update(status="approved", product_url="https://www.trivalley.fit/product-page/planner")
        evidence = {k: dict(passed=True, checked_at=NOW.isoformat(), reference="operator-test-001")
                    for k in C.REQUIRED_EVIDENCE}
        out = C.report(self.config, self.metrics, evidence, NOW)
        self.assertEqual(out["launch_status"], "READY_FOR_OPERATOR_REVIEW")
        self.assertFalse(out["live_execution_enabled"])
        self.assertEqual(out["external_actions_taken"], [])
        evidence["delivery_test"]["checked_at"] = (NOW-timedelta(days=8)).isoformat()
        self.assertIn("DELIVERY_TEST_UNVERIFIED", C.report(self.config, self.metrics, evidence, NOW)["blockers"])

    def test_future_evidence_rejected(self):
        evidence = {"checkout_test": dict(passed=True, reference="test", checked_at=(NOW+timedelta(seconds=1)).isoformat())}
        self.assertIn("CHECKOUT_TEST_UNVERIFIED", C.report(self.config, evidence=evidence, now=NOW)["blockers"])

    def test_untrusted_product_urls_rejected(self):
        for url in ("http://www.trivalley.fit/x", "https://evil.test/x", "https://trivalley.fit@evil.test/x",
                    "https://www.trivalley.fit/x?token=secret"):
            self.config["offer"]["product_url"] = url
            self.assertIn("PRODUCT_URL_INVALID", C.report(self.config, now=NOW)["blockers"])

    def test_live_config_cannot_enable_execution(self):
        self.config["live_execution_enabled"] = True
        with self.assertRaises(ValueError):
            C.report(self.config, now=NOW)

    def test_malformed_evidence_fails_closed(self):
        out = C.report(self.config, evidence={"checkout_test": "passed"}, now=NOW)
        self.assertIn("CHECKOUT_TEST_UNVERIFIED", out["blockers"])

    def test_invalid_config_shape_rejected(self):
        for value in ([], None, {"offer": None, "policy": {}}):
            with self.subTest(value=value), self.assertRaises(ValueError):
                C.validate_config(value)

    def test_first_launch_does_not_require_prior_sales(self):
        self.config["offer"].update(status="approved", product_url="https://www.trivalley.fit/product-page/planner")
        evidence = {k: dict(passed=True, checked_at=NOW.isoformat(), reference="operator-test-001")
                    for k in C.REQUIRED_EVIDENCE}
        out = C.report(self.config, evidence=evidence, now=NOW)
        self.assertEqual(out["launch_status"], "READY_FOR_OPERATOR_REVIEW")
        self.assertEqual(out["growth_status"], "HOLD")

    def test_seven_drafts_have_stable_digests(self):
        content = C.load(ROOT / "content.json")
        out = C.queue(self.config, content)
        self.assertEqual(len(out["items"]), 7)
        self.assertTrue(all(x["status"] == "DRAFT" and x["publishable"] is False for x in out["items"]))
        self.assertEqual(out, C.queue(self.config, content))
        content[0]["caption"] += " edited"
        changed = C.queue(self.config, content)
        self.assertNotEqual(out["items"][0]["review_digest"], changed["items"][0]["review_digest"])

    def test_duplicate_posts_rejected(self):
        post = C.load(ROOT / "content.json")[0]
        with self.assertRaises(ValueError):
            C.queue(self.config, [post, post])

    def test_asset_path_traversal_rejected(self):
        post = C.load(ROOT / "content.json")[0]
        post["id"] = "../../control"
        with self.assertRaises(ValueError):
            C.queue(self.config, [post])

    def test_cli_does_not_leak_invalid_input(self):
        with tempfile.TemporaryDirectory() as directory:
            bad = Path(directory) / "private.local.json"
            bad.write_text('{"secret":"DO_NOT_EXPOSE",broken}')
            proc = subprocess.run([sys.executable, str(ROOT / "control.py"), "report", "--config", str(bad)],
                                  capture_output=True, text=True, timeout=10)
            self.assertEqual(proc.returncode, 2)
            self.assertNotIn("DO_NOT_EXPOSE", proc.stdout + proc.stderr)
            self.assertEqual(proc.stderr, "")

    def test_duplicate_and_nonfinite_json_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "data"
            for content in ('{"x":1,"x":2}', '{"x":NaN}'):
                path.write_text(content)
                with self.assertRaises(ValueError):
                    C.load(path)

    def test_bad_policy_rejected(self):
        for value in (True, float("nan"), -1, 1.1):
            self.config["policy"]["minimum_net_margin"] = value
            with self.assertRaises(ValueError):
                C.validate_config(self.config)


if __name__ == "__main__":
    unittest.main()
