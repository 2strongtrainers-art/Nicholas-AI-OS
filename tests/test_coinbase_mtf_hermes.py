from __future__ import annotations

import copy
import unittest

from trading.coinbase_crypto_futures_paper import FuturesPaperRejected, load_policy
from trading.coinbase_mtf import (
    ALL_COINBASE_TIMEFRAMES,
    analyze_timeframe,
    apply_hermes_gate,
    build_mtf_view,
    candidate_fingerprint,
    multi_timeframe_signal,
    validate_hermes_review,
    validate_mtf_policy,
)
from trading.hermes_coinbase_supervisor import build_prompt


def product() -> dict:
    return {
        "product_id": "BIP-TEST-CDE",
        "product_type": "FUTURE",
        "base_display_symbol": "BTC",
        "base_currency_id": "BTC",
        "product_venue": "neptune",
        "trading_disabled": False,
        "is_disabled": False,
        "view_only": False,
        "best_bid_price": "124.99",
        "best_ask_price": "125.01",
        "future_product_details": {
            "contract_code": "BIP",
            "contract_size": "0.01",
            "contract_root_unit": "BTC",
            "contract_expiry_type": "PERPETUAL",
            "non_crypto": False,
            "twenty_four_by_seven": True,
            "perpetual_details": {
                "funding_rate": "0.0001",
                "max_leverage": "5",
                "underlying_type": "FUTURES_UNDERLYING_TYPE_SPOT",
            },
        },
        "fcm_trading_session_details": {
            "is_session_open": True,
            "session_state": "FCM_TRADING_SESSION_STATE_OPEN",
        },
    }


def bullish_candles(count: int = 180, step: float = 0.10) -> list[dict]:
    rows = []
    for i in range(count):
        base = 100.0 + i * step
        close = base + 0.05
        rows.append(
            {
                "start": str(1_700_000_000 + i * 60),
                "open": str(base),
                "high": str(close + 0.05),
                "low": str(base - 0.05),
                "close": str(close),
                "volume": "100",
            }
        )
    # Make the final candle an unambiguous breakout with normal volume.
    prior_high = max(float(row["high"]) for row in rows[-21:-1])
    rows[-1]["open"] = str(prior_high + 0.10)
    rows[-1]["low"] = str(prior_high + 0.05)
    rows[-1]["close"] = str(prior_high + 0.25)
    rows[-1]["high"] = str(prior_high + 0.30)
    rows[-1]["volume"] = "125"
    return rows


def bearish_candles(count: int = 180, step: float = 0.10) -> list[dict]:
    rows = []
    for i in range(count):
        base = 140.0 - i * step
        close = base - 0.05
        rows.append(
            {
                "start": str(1_700_000_000 + i * 60),
                "open": str(base),
                "high": str(base + 0.05),
                "low": str(close - 0.05),
                "close": str(close),
                "volume": "100",
            }
        )
    prior_low = min(float(row["low"]) for row in rows[-21:-1])
    rows[-1]["open"] = str(prior_low - 0.10)
    rows[-1]["high"] = str(prior_low - 0.05)
    rows[-1]["close"] = str(prior_low - 0.25)
    rows[-1]["low"] = str(prior_low - 0.30)
    rows[-1]["volume"] = "125"
    return rows


class CoinbaseMTFHermesTests(unittest.TestCase):
    def setUp(self) -> None:
        self.policy = load_policy()

    def test_policy_covers_every_coinbase_timeframe(self) -> None:
        validate_mtf_policy(self.policy)
        self.assertEqual(set(self.policy["timeframes"]), set(ALL_COINBASE_TIMEFRAMES))
        self.assertAlmostEqual(
            sum(float(cfg["weight"]) for cfg in self.policy["timeframes"].values()),
            1.0,
            places=8,
        )

    def test_single_timeframe_analysis_detects_bullish_structure(self) -> None:
        analysis = analyze_timeframe(bullish_candles(), "ONE_HOUR", self.policy)
        self.assertIsNotNone(analysis)
        assert analysis is not None
        self.assertEqual(analysis["direction"], "bullish")
        self.assertGreater(analysis["score"], 0.20)

    def test_aligned_all_timeframes_can_produce_long_candidate(self) -> None:
        candles = {timeframe: bullish_candles() for timeframe in ALL_COINBASE_TIMEFRAMES}
        view = build_mtf_view(candles, self.policy)
        self.assertEqual(view["available_timeframes"], len(ALL_COINBASE_TIMEFRAMES))
        self.assertEqual(view["regime"], "bullish")
        signal = multi_timeframe_signal(product(), candles, self.policy)
        self.assertIsNotNone(signal)
        assert signal is not None
        self.assertEqual(signal["side"], "long")
        self.assertGreaterEqual(
            signal["multi_timeframe"]["deterministic_confidence"],
            float(self.policy["minimum_deterministic_confidence"]),
        )

    def test_higher_timeframe_conflict_rejects_primary_long(self) -> None:
        candles = {}
        higher = set(self.policy["higher_timeframes"])
        for timeframe in ALL_COINBASE_TIMEFRAMES:
            candles[timeframe] = bearish_candles() if timeframe in higher else bullish_candles()
        signal = multi_timeframe_signal(product(), candles, self.policy)
        self.assertIsNone(signal)

    def test_hermes_reduce_can_only_cut_contracts(self) -> None:
        decision = {
            "contracts": 10,
            "notional_usd": 10000.0,
            "risk_dollars": 200.0,
            "reward_dollars": 400.0,
            "notional_leverage": 1.0,
        }
        fingerprint = "abc123"
        review = {
            "candidate_fingerprint": fingerprint,
            "action": "REDUCE",
            "size_multiplier": 0.5,
            "confidence": 70,
            "regime": "mixed bullish",
            "rationale": ["higher timeframes supportive but short-term conflict"],
            "conflicts": ["1m opposed"],
            "risk_flags": [],
            "live_execution_enabled": False,
        }
        gated = apply_hermes_gate(decision, review, self.policy, fingerprint)
        self.assertIsNotNone(gated)
        assert gated is not None
        self.assertEqual(gated["contracts"], 5)
        self.assertEqual(gated["risk_dollars"], 100.0)
        self.assertLessEqual(gated["notional_leverage"], decision["notional_leverage"])

    def test_hermes_cannot_increase_size(self) -> None:
        fingerprint = "abc123"
        review = {
            "candidate_fingerprint": fingerprint,
            "action": "ACCEPT",
            "size_multiplier": 1.5,
            "confidence": 99,
            "regime": "bullish",
            "rationale": [],
            "conflicts": [],
            "risk_flags": [],
            "live_execution_enabled": False,
        }
        with self.assertRaises(FuturesPaperRejected):
            validate_hermes_review(review, self.policy, fingerprint)

    def test_hermes_review_must_match_candidate_fingerprint(self) -> None:
        review = {
            "candidate_fingerprint": "wrong",
            "action": "REJECT",
            "size_multiplier": 0.0,
            "confidence": 50,
            "regime": "mixed",
            "rationale": [],
            "conflicts": [],
            "risk_flags": [],
            "live_execution_enabled": False,
        }
        with self.assertRaises(FuturesPaperRejected):
            validate_hermes_review(review, self.policy, "expected")

    def test_hermes_prompt_forbids_trade_creation_and_risk_increase(self) -> None:
        snapshot = {
            "candidate_fingerprint": "abc123",
            "paper_only": True,
            "live_execution_enabled": False,
            "multi_timeframe": {},
        }
        prompt = build_prompt(snapshot, self.policy).lower()
        self.assertIn("may not change", prompt)
        self.assertIn("never increase risk", prompt)
        self.assertIn("simulation only", prompt)
        self.assertIn("do not call tools", prompt)

    def test_missing_timeframe_fails_policy_validation(self) -> None:
        bad = copy.deepcopy(self.policy)
        bad["timeframes"].pop("ONE_DAY")
        with self.assertRaises(FuturesPaperRejected):
            validate_mtf_policy(bad)


if __name__ == "__main__":
    unittest.main()
