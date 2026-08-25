import json
import unittest
from pathlib import Path

from trading.daytrade_engine import generate_candidate, load_day_policy, new_state, run_cycle
from trading.paper_engine import load_policy as load_risk_policy

ROOT = Path(__file__).resolve().parents[1]


def bars(last_close=100.50, last_volume=3000, count=30):
    result = []
    for i in range(count):
        if i < 15:
            o = 100.00
            h = 100.20
            l = 99.80
            c = 100.00
            v = 1000
        elif i == count - 1:
            o = 100.10
            h = max(100.60, last_close)
            l = 100.00
            c = last_close
            v = last_volume
        else:
            o = 100.00
            h = 100.10
            l = 99.90
            c = 100.00
            v = 1000
        result.append({
            "timestamp": f"2026-08-25T10:{i:02d}:00-04:00",
            "open": o,
            "high": h,
            "low": l,
            "close": c,
            "volume": v,
        })
    return result


class DayTradeEngineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.day_policy = load_day_policy(ROOT / "trading" / "daytrade_policy.json")
        cls.risk_policy = load_risk_policy(ROOT / "trading" / "risk_policy.json")

    def payload(self, **updates):
        data = {"symbol": "TEST", "spread_bps": 5.0, "bars": bars()}
        data.update(updates)
        return data

    def snapshot(self, payload=None, **updates):
        data = {
            "paper_only": True,
            "session_id": "2026-08-25",
            "session_complete": False,
            "symbols": [payload or self.payload()],
        }
        data.update(updates)
        return data

    def test_long_opening_range_breakout_candidate(self):
        candidate = generate_candidate(self.payload(), self.day_policy)
        self.assertIsNotNone(candidate)
        self.assertEqual(candidate.side, "long")
        self.assertGreater(candidate.entry, 100.50)
        self.assertLess(candidate.stop, candidate.entry)
        self.assertGreater(candidate.target, candidate.entry)
        self.assertGreaterEqual(candidate.relative_volume, 1.25)

    def test_rejects_wide_spread(self):
        candidate = generate_candidate(self.payload(spread_bps=50.0), self.day_policy)
        self.assertIsNone(candidate)

    def test_cycle_is_paper_only_and_risk_sized(self):
        state = new_state(self.risk_policy["starting_equity"], "2026-08-25")
        result = run_cycle(self.snapshot(), state, self.day_policy, self.risk_policy)
        self.assertFalse(result["live_execution_enabled"])
        self.assertEqual(len(result["state"]["open_positions"]), 1)
        event = result["events"][0]
        self.assertEqual(event["type"], "ENTRY")
        self.assertTrue(event["paper_only"])
        self.assertGreater(event["quantity"], 0)
        self.assertLessEqual(event["risk_dollars"], 250.0)

    def test_same_timestamp_does_not_double_enter(self):
        state = new_state(self.risk_policy["starting_equity"], "2026-08-25")
        first = run_cycle(self.snapshot(), state, self.day_policy, self.risk_policy)
        first["state"]["open_positions"].clear()
        second = run_cycle(self.snapshot(), first["state"], self.day_policy, self.risk_policy)
        self.assertEqual(second["events"], [])
        self.assertEqual(second["decisions"], [])

    def test_same_bar_stop_and_target_uses_stop(self):
        state = new_state(self.risk_policy["starting_equity"], "2026-08-25")
        opened = run_cycle(self.snapshot(), state, self.day_policy, self.risk_policy)
        position = opened["state"]["open_positions"]["TEST"]
        next_bars = bars()
        next_bars.append({
            "timestamp": "2026-08-25T10:30:00-04:00",
            "open": position["entry"],
            "high": position["target"] + 0.10,
            "low": position["stop"] - 0.10,
            "close": position["entry"],
            "volume": 1500,
        })
        result = run_cycle(
            self.snapshot(self.payload(bars=next_bars)),
            opened["state"],
            self.day_policy,
            self.risk_policy,
        )
        exits = [event for event in result["events"] if event["type"] == "EXIT"]
        self.assertEqual(len(exits), 1)
        self.assertEqual(exits[0]["reason"], "STOP_SAME_BAR")
        self.assertLess(exits[0]["pnl"], 0)

    def test_session_complete_flattens_position(self):
        state = new_state(self.risk_policy["starting_equity"], "2026-08-25")
        opened = run_cycle(self.snapshot(), state, self.day_policy, self.risk_policy)
        next_bars = bars()
        next_bars.append({
            "timestamp": "2026-08-25T15:59:00-04:00",
            "open": 100.55,
            "high": 100.60,
            "low": 100.50,
            "close": 100.57,
            "volume": 1200,
        })
        result = run_cycle(
            self.snapshot(self.payload(bars=next_bars), session_complete=True),
            opened["state"],
            self.day_policy,
            self.risk_policy,
        )
        self.assertEqual(result["state"]["open_positions"], {})
        self.assertEqual(result["events"][0]["reason"], "SESSION_END")


if __name__ == "__main__":
    unittest.main()
