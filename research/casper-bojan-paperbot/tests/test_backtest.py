import importlib.util
import unittest
from pathlib import Path
import pandas as pd

MOD_PATH = Path(__file__).resolve().parents[1] / 'backtest.py'
spec = importlib.util.spec_from_file_location('cb_backtest', MOD_PATH)
cb = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cb)


class CasperBojanBacktestTests(unittest.TestCase):
    def test_live_execution_hard_disabled(self):
        self.assertIs(cb.LIVE_EXECUTION_ENABLED, False)

    def test_resample_only_available_after_higher_timeframe_close(self):
        idx = pd.date_range('2026-01-01T00:00:00Z', periods=12, freq='5min')
        df = pd.DataFrame({
            'open': range(100, 112), 'high': range(101, 113),
            'low': range(99, 111), 'close': range(100, 112),
            'volume': [1.0] * 12,
        }, index=idx)
        h1 = cb.complete_resample(df, '1h', 60)
        self.assertEqual(len(h1), 1)
        self.assertEqual(h1.index[0], pd.Timestamp('2026-01-01T01:00:00Z'))

    def test_v2_allows_sweep_then_structure_confirmation(self):
        idx = pd.date_range('2026-01-01T00:00:00Z', periods=70, freq='5min')
        f = pd.DataFrame(index=idx)
        f['close'] = 100.0; f['t15'] = 1; f['t1h'] = 1
        f['sfp'] = 0; f['mss'] = 0; f['vwap'] = 99.0; f['rvol'] = 2.0
        f['rsi'] = 60.0; f['macdh'] = 1.0; f['near_lower'] = False; f['near_upper'] = False
        f['stop_long'] = 98.0; f['stop_short'] = 102.0; f['regime'] = 'bull'
        f.iloc[60, f.columns.get_loc('sfp')] = 1
        f.iloc[62, f.columns.get_loc('mss')] = 1
        v1 = cb.candidates(f, 'v1')
        v2 = cb.candidates(f, 'v2')
        self.assertEqual(v1, [])
        self.assertEqual(len(v2), 1)
        self.assertEqual(v2[0]['i'], 62)

    def test_metrics_are_chronological_not_input_order(self):
        late = {'entry_ts': '2026-01-01T01:00:00+00:00', 'net_r': -1.0, 'pnl_pct': -5.0}
        early = {'entry_ts': '2026-01-01T00:00:00+00:00', 'net_r': 2.0, 'pnl_pct': 10.0}
        m = cb.metrics([late, early])
        self.assertAlmostEqual(m['max_drawdown_pct'], 5.0, places=8)
        self.assertAlmostEqual(m['expectancy_r'], 0.5, places=8)

    def test_regime_metrics_separate_trade_sets(self):
        trades = [
            {'entry_ts':'2026-01-01T00:00:00+00:00','net_r':1.0,'pnl_pct':1.0,'regime':'bull'},
            {'entry_ts':'2026-01-01T01:00:00+00:00','net_r':-1.0,'pnl_pct':-1.0,'regime':'bear'},
        ]
        r = cb.regime_metrics(trades)
        self.assertEqual(r['bull']['trades'], 1)
        self.assertEqual(r['bear']['trades'], 1)
        self.assertEqual(r['range']['trades'], 0)


if __name__ == '__main__':
    unittest.main(verbosity=2)
