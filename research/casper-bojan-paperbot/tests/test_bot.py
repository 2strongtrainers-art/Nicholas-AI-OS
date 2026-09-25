import sys, unittest
sys.path.insert(0,'research/casper-bojan-paperbot/src')
from bot import RiskManager, PaperExecutor, LIVE_TRADING_ENABLED, TradeSignal

class Tests(unittest.TestCase):
    def test_live_disabled(self):
        self.assertFalse(LIVE_TRADING_ENABLED)
        with self.assertRaises(RuntimeError): PaperExecutor().submit_live()
    def test_position_sizing(self):
        rm=RiskManager(); q=rm.position_size(10000,100,99)
        self.assertAlmostEqual(q,25.0)
    def test_daily_loss_guard(self):
        rm=RiskManager(); self.assertFalse(rm.can_trade(10000,-100,0))
    def test_max_trades_guard(self):
        rm=RiskManager(); self.assertFalse(rm.can_trade(10000,0,3))
    def test_paper_order(self):
        sig=TradeSignal('LONG',100,99,102.3,2.3,5,{})
        order=PaperExecutor().submit(sig,2)
        self.assertEqual(order['target'],102.3)
if __name__=='__main__': unittest.main()
