import copy
import unittest
from datetime import date, datetime, timedelta, timezone
from unittest.mock import patch

from scripts import run_market_desk_report as hosted_report
from trading.confluence_report import ConfluenceError
from trading.market_desk_pipeline import research_pipeline


def snapshot(count=35, *, provider="alpaca_iex", estimated=False, complete=False):
    start = datetime.fromisoformat("2026-11-13T09:30:00-05:00")
    bars = []
    for i in range(count):
        px = 100.0 + 0.02 * i
        bars.append({"timestamp": (start + timedelta(minutes=i)).isoformat(),
                     "open": px, "high": px + 0.12, "low": px - 0.12,
                     "close": px + 0.01, "volume": 1500 + i * 5})
    return {"paper_only": True, "live_execution_enabled": False,
            "provider": provider, "session_id": "2026-11-13",
            "session_complete": complete, "fetched_at": "2026-11-13T16:30:00-05:00",
            "symbols": [{"symbol": "SPY", "bars": bars, "spread_bps": 3.5,
                         "spread_estimated": estimated, "quote_timestamp": bars[-1]["timestamp"]}]}


class PipelineTests(unittest.TestCase):
    def test_contiguous_alpaca_session_quality_only(self):
        rep = research_pipeline(snapshot(), historical=True)
        self.assertFalse(rep["trade_authorized"])
        self.assertEqual(rep["orders_sent"], 0)
        self.assertEqual(rep["symbols"][0]["quality_gate"], "PASS_PAPER_REVIEW")
        self.assertEqual(rep["replay"]["status"], "NOT_REQUESTED")

    def test_hosted_manual_validation_uses_the_completed_session(self):
        session = date(2026, 11, 13)
        weekend = datetime(2026, 11, 15, 18, tzinfo=timezone.utc)
        with patch.dict("os.environ", {"APCA_API_KEY_ID": "fixture", "APCA_API_SECRET_KEY": "fixture"}), \
             patch.object(hosted_report, "datetime", wraps=datetime) as clock, \
             patch.object(hosted_report, "build_snapshot", return_value=snapshot()) as feed:
            clock.now.return_value = weekend
            self.assertEqual(hosted_report.run_report()["status"], "SKIPPED_NOT_AFTER_MARKET_CLOSE")
            feed.assert_not_called()
            receipt = hosted_report.run_report(session)
        self.assertEqual(receipt["session"], session.isoformat())
        self.assertEqual(receipt["status"], "RESEARCH_ONLY")
        self.assertEqual(receipt["orders_sent"], 0)
        self.assertEqual(feed.call_args.kwargs["now"].date(), session)
        self.assertFalse(feed.call_args.kwargs["include_current_quotes"])

    def test_whitespace_alpaca_credentials_do_not_use_the_fallback_feed(self):
        with patch.dict("os.environ", {"APCA_API_KEY_ID": " ", "APCA_API_SECRET_KEY": "fixture"}), \
             patch.object(hosted_report, "build_snapshot") as feed:
            receipt = hosted_report.run_report(date(2026, 11, 13))
        self.assertEqual(receipt["status"], "SKIPPED_NO_ALPACA_DATA_CREDENTIALS")
        feed.assert_not_called()

    def test_missing_minutes_block_paper(self):
        snap = snapshot()
        snap["symbols"][0]["bars"].pop(5)
        rep = research_pipeline(snap, historical=True)
        self.assertEqual(rep["symbols"][0]["missing_minutes"], 1)
        self.assertIn("missing_intraday_minutes", rep["symbols"][0]["paper_blockers"])
        self.assertEqual(rep["symbols"][0]["quality_gate"], "RESEARCH_ONLY_BLOCKED")

    def test_boundary_1600_excluded_and_counted(self):
        snap = snapshot(390, complete=True)
        snap["symbols"][0]["bars"].append({"timestamp": "2026-11-13T16:00:00-05:00",
                    "open": 100, "high": 101, "low": 99, "close": 100, "volume": 1})
        rep = research_pipeline(snap, historical=True)
        self.assertEqual(rep["symbols"][0]["boundary_bars_excluded"], 1)
        self.assertEqual(rep["symbols"][0]["bars_checked"], 390)
        self.assertEqual(rep["symbols"][0]["quality_gate"], "PASS_PAPER_REVIEW")

    def test_after_close_bar_other_than_boundary_rejected(self):
        snap = snapshot()
        snap["symbols"][0]["bars"][-1]["timestamp"] = "2026-11-13T16:01:00-05:00"
        rep = research_pipeline(snap, historical=True)
        self.assertEqual(rep["symbols"][0]["quality_gate"], "REJECTED")

    def test_yahoo_and_estimated_spread_not_paper_ready(self):
        rep = research_pipeline(snapshot(provider="yahoo_chart_fallback"), historical=True)
        self.assertIn("not_approved_alpaca_source", rep["symbols"][0]["paper_blockers"])
        rep = research_pipeline(snapshot(estimated=True), historical=True)
        self.assertIn("spread_unverified", rep["symbols"][0]["paper_blockers"])

    def test_spread_quote_must_be_recent(self):
        snap = snapshot()
        snap["symbols"][0]["quote_timestamp"] = "2026-11-13T09:30:00-05:00"
        rep = research_pipeline(snap, historical=True)
        self.assertIn("spread_quote_stale", rep["symbols"][0]["paper_blockers"])
        snap["symbols"][0].pop("quote_timestamp")
        rep = research_pipeline(snap, historical=True)
        self.assertIn("spread_quote_timestamp_missing", rep["symbols"][0]["paper_blockers"])

    def test_incomplete_full_session_blocked(self):
        rep = research_pipeline(snapshot(389, complete=True), historical=True)
        self.assertIn("incomplete_full_session", rep["symbols"][0]["paper_blockers"])

    def test_replay_requires_full_session_and_explicit_flag(self):
        rep = research_pipeline(snapshot(), historical=True, paper_replay=True)
        self.assertEqual(rep["replay"]["status"], "BLOCKED_INCOMPLETE_OR_UNVERIFIED_DATA")
        full = research_pipeline(snapshot(390, complete=True), historical=True, paper_replay=True)
        self.assertEqual(full["replay"]["status"], "ILLUSTRATIVE_PAPER_REPLAY_ONLY")
        self.assertEqual(full["replay"]["orders_sent"], 0)
        self.assertEqual(full["replay"]["symbols_tested"], ["SPY"])

    def test_duplicated_symbol_and_live_controls_rejected(self):
        snap = snapshot()
        snap["symbols"].append(copy.deepcopy(snap["symbols"][0]))
        with self.assertRaises(ConfluenceError):
            research_pipeline(snap, historical=True)
        snap = snapshot()
        snap["live_execution_enabled"] = True
        with self.assertRaises(ConfluenceError):
            research_pipeline(snap, historical=True)

    def test_unknown_provider_and_potential_order_url_rejected(self):
        snap = snapshot(provider="unknown")
        with self.assertRaises(ConfluenceError):
            research_pipeline(snap, historical=True)
        snap = snapshot()
        snap["broker_order_url"] = "https://example.com/orders"
        with self.assertRaises(ConfluenceError):
            research_pipeline(snap, historical=True)

    def test_input_not_mutated(self):
        snap = snapshot(390, complete=True)
        snap["symbols"][0]["bars"].append({"timestamp": "2026-11-13T16:00:00-05:00",
            "open": 100, "high": 101, "low": 99, "close": 100, "volume": 1})
        original = copy.deepcopy(snap)
        research_pipeline(snap, historical=True)
        self.assertEqual(snap, original)


if __name__ == "__main__":
    unittest.main()
