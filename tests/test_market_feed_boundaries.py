import unittest
from datetime import datetime

from trading.market_feed import _in_regular_session


class MarketFeedBoundaryTests(unittest.TestCase):
    def test_rth_minute_start_and_close_boundary(self):
        def ts(value):
            return int(datetime.fromisoformat(value).timestamp())
        self.assertTrue(_in_regular_session(ts("2026-11-13T09:30:00-05:00")))
        self.assertTrue(_in_regular_session(ts("2026-11-13T15:59:00-05:00")))
        self.assertFalse(_in_regular_session(ts("2026-11-13T16:00:00-05:00")))
        self.assertFalse(_in_regular_session(ts("2026-11-13T09:29:00-05:00")))
        self.assertFalse(_in_regular_session(ts("2026-11-14T10:00:00-05:00")))


if __name__ == "__main__":
    unittest.main()
