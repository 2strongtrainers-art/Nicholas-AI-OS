import unittest

from trading.paper_engine import RiskRejected, evaluate_setup, load_policy


class PaperTradingDeskTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.policy = load_policy()

    def account(self, **updates):
        data = {
            "equity": 100000,
            "realized_pnl": 0,
            "open_risk_pct": 0,
            "open_positions": 0,
            "trades_today": 0,
        }
        data.update(updates)
        return data

    def setup(self, **updates):
        data = {
            "symbol": "DEMO",
            "asset_class": "stock",
            "side": "long",
            "entry": 100,
            "stop": 99,
            "target": 103,
            "execution": "paper",
        }
        data.update(updates)
        return data

    def test_live_execution_disabled_in_policy(self):
        self.assertFalse(self.policy["live_execution_enabled"])
        self.assertEqual(self.policy["mode"], "paper_only")
        self.assertEqual(self.policy["live_broker_adapters"], [])

    def test_sizes_paper_trade_from_risk_budget(self):
        decision = evaluate_setup(self.setup(), self.account(), self.policy)
        self.assertEqual(decision.quantity, 250)
        self.assertEqual(decision.risk_dollars, 250)
        self.assertEqual(decision.reward_to_risk, 3)
        self.assertEqual(decision.status, "PAPER_ONLY")

    def test_rejects_live_execution_request(self):
        with self.assertRaises(RiskRejected):
            evaluate_setup(self.setup(execution="live"), self.account(), self.policy)

    def test_rejects_daily_loss_limit(self):
        with self.assertRaises(RiskRejected):
            evaluate_setup(self.setup(), self.account(realized_pnl=-1000), self.policy)

    def test_rejects_averaging_down(self):
        with self.assertRaises(RiskRejected):
            evaluate_setup(self.setup(average_down=True), self.account(), self.policy)

    def test_rejects_malformed_long_levels(self):
        with self.assertRaises(RiskRejected):
            evaluate_setup(self.setup(entry=100, stop=101, target=103), self.account(), self.policy)


if __name__ == "__main__":
    unittest.main()
