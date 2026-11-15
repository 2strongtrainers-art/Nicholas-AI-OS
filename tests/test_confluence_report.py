import unittest
from datetime import datetime, timedelta, timezone

from trading.confluence_report import (ConfluenceError, build_report, ema,
                                       rsi)


def make_snapshot(*, stamp='2026-11-13T10:05:00-05:00'):
    start = datetime.fromisoformat('2026-11-13T09:30:00-05:00')
    bars = []
    for i in range(35):
        px = 100 + i * .02
        bars.append({'timestamp': (start+timedelta(minutes=i)).isoformat(),
                     'open': px, 'high': px+.1, 'low': px-.1,
                     'close': px+.025, 'volume': 1000+i*10})
    return {'paper_only': True, 'live_execution_enabled': False,
            'session_id': '2026-11-13', 'session_complete': False,
            'provider': 'test_synthetic', 'fetched_at': stamp,
            'symbols': [{'symbol': 'TEST', 'bars': bars,
                         'spread_bps': 5, 'spread_estimated': True}]}


class ConfluenceReportTests(unittest.TestCase):
    def test_report_is_research_only_and_has_indicators(self):
        snap = make_snapshot()
        now = datetime.fromisoformat('2026-11-13T10:05:10-05:00')
        rep = build_report(snap, now=now)
        self.assertEqual(rep['orders_submitted'], 0)
        self.assertFalse(rep['trade_authorized'])
        s = rep['symbols'][0]
        self.assertGreater(s['ema9'], s['ema21'])
        self.assertGreater(s['price'], s['vwap'])
        self.assertTrue(s['opening_range_15m']['complete'])
        self.assertIn('NOT true', s['poc_method'])

    def test_stale_data_rejected_by_default(self):
        with self.assertRaisesRegex(ConfluenceError, 'stale'):
            build_report(make_snapshot(), now=datetime.fromisoformat('2026-11-13T11:00:00-05:00'))
        rep = build_report(make_snapshot(), historical=True)
        self.assertEqual(rep['mode'], 'historical')

    def test_live_execution_never_allowed(self):
        snap = make_snapshot()
        snap['live_execution_enabled'] = True
        with self.assertRaises(ConfluenceError):
            build_report(snap, historical=True)

    def test_future_and_out_of_order_bars_rejected(self):
        snap = make_snapshot()
        snap['symbols'][0]['bars'][1]['timestamp'] = snap['symbols'][0]['bars'][0]['timestamp']
        with self.assertRaisesRegex(ConfluenceError, 'time-ordered'):
            build_report(snap, historical=True)

    def test_wrong_session_rejected(self):
        snap = make_snapshot()
        snap['session_id'] = '2026-11-14'
        with self.assertRaisesRegex(ConfluenceError, 'declared'):
            build_report(snap, historical=True)

    def test_rsi_flat_prices_and_ema(self):
        self.assertEqual(rsi([100.0]*30), 50.0)
        self.assertEqual(ema([100.0]*30, 21), 100.0)

    def test_unverified_source_rejected(self):
        snap = make_snapshot()
        snap.pop('provider')
        with self.assertRaisesRegex(ConfluenceError, 'provider'):
            build_report(snap, historical=True)

    def test_bar_timestamp_freshness(self):
        snap = make_snapshot(stamp='2026-11-13T10:30:00-05:00')
        with self.assertRaisesRegex(ConfluenceError, 'lags'):
            build_report(snap, now=datetime.fromisoformat('2026-11-13T10:30:10-05:00'))


if __name__ == '__main__':
    unittest.main()
