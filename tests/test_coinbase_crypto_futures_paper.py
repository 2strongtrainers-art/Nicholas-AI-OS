import copy
import unittest

from trading.coinbase_crypto_futures_paper import (
    FuturesPaperRejected,
    discover_products,
    is_eligible_product,
    load_policy,
    market_signal,
    size_paper_trade,
)


class CoinbaseCryptoFuturesPaperTests(unittest.TestCase):
    def setUp(self):
        self.policy = load_policy()
        self.product = {
            "product_id": "BIP-PERP-CDE",
            "product_type": "FUTURE",
            "product_venue": "FCM",
            "base_display_symbol": "BTC",
            "base_currency_id": "BTC",
            "quote_currency_id": "USD",
            "trading_disabled": False,
            "view_only": False,
            "best_bid_price": "107090.0",
            "best_ask_price": "107100.0",
            "approximate_quote_24h_volume": "500000000",
            "future_product_details": {
                "venue": "FCM",
                "contract_code": "BIP",
                "contract_size": "0.01",
                "contract_root_unit": "BTC",
                "contract_expiry_type": "PERPETUAL",
                "twenty_four_by_seven": True,
                "non_crypto": False,
                "perpetual_details": {
                    "max_leverage": "10",
                    "funding_rate": "0.00005",
                    "underlying_type": "FUTURES_UNDERLYING_TYPE_SPOT",
                },
            },
        }

    @staticmethod
    def rising_candles(count=80):
        rows = []
        for i in range(count):
            base = 100000.0 + i * 100.0
            rows.append({
                "start": str(1700000000 + i * 300),
                "open": str(base),
                "high": str(base + 60.0),
                "low": str(base - 60.0),
                "close": str(base + 40.0),
                "volume": "1000",
            })
        return rows

    @staticmethod
    def falling_candles(count=80):
        rows = []
        for i in range(count):
            base = 110000.0 - i * 100.0
            rows.append({
                "start": str(1700000000 + i * 300),
                "open": str(base),
                "high": str(base + 60.0),
                "low": str(base - 60.0),
                "close": str(base - 40.0),
                "volume": "1000",
            })
        return rows

    def test_policy_is_hard_paper_only(self):
        self.assertEqual(self.policy["mode"], "paper_only")
        self.assertFalse(self.policy["live_execution_enabled"])
        self.assertFalse(self.policy["accept_trade_permission_api_keys"])
        self.assertTrue(self.policy["public_market_data_only"])
        self.assertLessEqual(float(self.policy["max_notional_leverage"]), 2.0)

    def test_eligible_us_btc_perpetual(self):
        self.assertTrue(is_eligible_product(self.product, self.policy))

    def test_spot_and_non_crypto_are_rejected(self):
        spot = copy.deepcopy(self.product)
        spot["product_type"] = "SPOT"
        self.assertFalse(is_eligible_product(spot, self.policy))

        oil = copy.deepcopy(self.product)
        oil["base_display_symbol"] = "CL"
        oil["future_product_details"]["non_crypto"] = True
        self.assertFalse(is_eligible_product(oil, self.policy))

    def test_only_allowed_underlyings_are_discovered(self):
        eth = copy.deepcopy(self.product)
        eth["product_id"] = "ETP-PERP-CDE"
        eth["base_display_symbol"] = "ETH"
        eth["base_currency_id"] = "ETH"
        eth["future_product_details"]["contract_code"] = "ETP"
        eth["future_product_details"]["contract_size"] = "0.1"

        sol = copy.deepcopy(self.product)
        sol["product_id"] = "SLP-PERP-CDE"
        sol["base_display_symbol"] = "SOL"
        sol["base_currency_id"] = "SOL"
        sol["future_product_details"]["contract_code"] = "SLP"
        sol["future_product_details"]["contract_size"] = "5"

        found = discover_products([sol, self.product, eth], self.policy)
        self.assertEqual({p["base_display_symbol"] for p in found}, {"BTC", "ETH"})

    def test_rising_market_produces_long_breakout(self):
        signal = market_signal(self.product, self.rising_candles(), self.policy)
        self.assertIsNotNone(signal)
        self.assertEqual(signal["side"], "long")
        self.assertLess(signal["stop"], signal["entry"])
        self.assertGreater(signal["target"], signal["entry"])

    def test_falling_market_produces_short_breakout(self):
        signal = market_signal(self.product, self.falling_candles(), self.policy)
        self.assertIsNotNone(signal)
        self.assertEqual(signal["side"], "short")
        self.assertGreater(signal["stop"], signal["entry"])
        self.assertLess(signal["target"], signal["entry"])

    def test_sizing_respects_risk_and_two_x_notional_cap(self):
        signal = market_signal(self.product, self.rising_candles(), self.policy)
        decision = size_paper_trade(
            self.product,
            signal,
            {
                "equity": 100000,
                "realized_pnl": 0,
                "open_risk_pct": 0,
                "open_positions": 0,
                "trades_today": 0,
            },
            self.policy,
        )
        self.assertGreaterEqual(decision.contracts, 1)
        self.assertLessEqual(decision.risk_dollars, 250.0 + 1e-6)
        self.assertLessEqual(decision.notional_leverage, 2.0 + 1e-9)
        self.assertAlmostEqual(decision.reward_to_risk, 2.0, places=6)
        self.assertEqual(decision.status, "PAPER_ONLY")

    def test_daily_loss_lockout(self):
        signal = market_signal(self.product, self.rising_candles(), self.policy)
        with self.assertRaises(FuturesPaperRejected):
            size_paper_trade(
                self.product,
                signal,
                {
                    "equity": 100000,
                    "realized_pnl": -1000,
                    "open_risk_pct": 0,
                    "open_positions": 0,
                    "trades_today": 0,
                },
                self.policy,
            )

    def test_product_max_leverage_is_additional_ceiling(self):
        product = copy.deepcopy(self.product)
        product["future_product_details"]["perpetual_details"]["max_leverage"] = "0.5"
        signal = market_signal(product, self.rising_candles(), self.policy)
        with self.assertRaises(FuturesPaperRejected):
            size_paper_trade(
                product,
                signal,
                {
                    "equity": 100000,
                    "realized_pnl": 0,
                    "open_risk_pct": 0,
                    "open_positions": 0,
                    "trades_today": 0,
                },
                self.policy,
            )


if __name__ == "__main__":
    unittest.main()
