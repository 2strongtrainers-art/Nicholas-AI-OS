import importlib.util
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


PATH = Path(__file__).resolve().parents[1] / "paper_daemon.py"
SPEC = importlib.util.spec_from_file_location("paper_daemon", PATH)
daemon = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(daemon)


CFG = {
    "risk_per_trade_pct": 0.25,
    "max_total_open_risk_pct": 0.5,
    "max_daily_loss_pct": 1.0,
    "max_trades_per_day": 3,
    "min_reward_risk": 2.3,
    "slippage_bps": 3.0,
}


class PaperDaemonTests(unittest.TestCase):
    def test_live_execution_is_disabled(self):
        self.assertIs(daemon.LIVE_EXECUTION_ENABLED, False)

    def test_utc_day_rollover_resets_only_daily_counters(self):
        state = daemon.new_state(10_000)
        state["equity"] = 9_950
        state["realized_pnl_today"] = -50
        state["trades_today"] = 2
        daemon.roll_utc_day(state, datetime(2026, 8, 25, tzinfo=timezone.utc))
        self.assertEqual(state["day"], "2026-08-25")
        self.assertEqual(state["day_start_equity"], 9_950)
        self.assertEqual(state["realized_pnl_today"], 0)
        self.assertEqual(state["trades_today"], 0)

    def test_position_uses_fixed_fractional_risk_and_2_3r_target(self):
        state = daemon.new_state(10_000)
        candidate = {
            "side": 1, "stop": 99.0, "score": 6,
            "signal_ts": "2026-08-25T00:00:00+00:00",
            "entry_bar_ts": "2026-08-25T00:05:00+00:00",
        }
        position = daemon.open_paper_position("BTCUSDT", candidate, 100.0, state, CFG)
        self.assertAlmostEqual(position["risk_dollars"], 25.0)
        self.assertAlmostEqual(
            position["target"] - position["entry"],
            2.3 * (position["entry"] - position["stop"]),
        )

    def test_daily_loss_and_trade_count_kill_switches(self):
        state = daemon.new_state(10_000)
        state["day_start_equity"] = 10_000
        state["realized_pnl_today"] = -100
        self.assertFalse(daemon.can_open(state, CFG))
        state["realized_pnl_today"] = 0
        state["trades_today"] = 3
        self.assertFalse(daemon.can_open(state, CFG))

    def test_stop_wins_when_stop_and_target_touch_same_bar(self):
        position = {
            "symbol": "BTCUSDT", "side": 1, "side_name": "LONG",
            "entry": 100.0, "stop": 99.0, "target": 102.3, "qty": 25.0,
            "risk_dollars": 25.0, "signal_ts": "2026-08-25T00:00:00+00:00",
            "last_exit_check_ts": "2026-08-25T00:05:00+00:00",
        }
        idx = pd.DatetimeIndex(["2026-08-25T00:10:00Z"])
        bars = pd.DataFrame({"open":[100], "high":[103], "low":[98], "close":[101], "volume":[1]}, index=idx)
        event, _ = daemon.settle_position(position, bars, 10.0, 3.0)
        self.assertEqual(event["reason"], "stop")
        self.assertLess(event["pnl"], 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
