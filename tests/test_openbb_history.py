import unittest
from types import SimpleNamespace
from trading.openbb_history import fetch_daily_history


class FakeFrame:
    columns = ['open', 'high', 'low', 'close', 'volume']
    def tail(self, n):
        return self
    def iterrows(self):
        yield ('2026-11-12', {'open': 100, 'high': 101, 'low': 99, 'close': 100.5, 'volume': 12345})
        yield ('2026-11-13', {'open': 100.5, 'high': 102, 'low': 100, 'close': 101, 'volume': 23456})


class FakeOutput:
    def to_dataframe(self):
        return FakeFrame()


class FakeClient:
    def __init__(self):
        self.called = []
        self.equity = SimpleNamespace(price=SimpleNamespace(historical=self.fetch))
    def fetch(self, symbol, **kwargs):
        self.called.append((symbol, kwargs))
        return FakeOutput()


class OpenBBHistoryTests(unittest.TestCase):
    def test_fetch_is_read_only_and_explicit(self):
        client = FakeClient()
        result = fetch_daily_history('MSFT', client=client, provider='example', limit=5)
        self.assertEqual(client.called, [('MSFT', {'provider': 'example'})])
        self.assertEqual(len(result['bars']), 2)
        self.assertFalse(result['trade_authorized'])

    def test_rejects_invalid_inputs(self):
        with self.assertRaises(ValueError):
            fetch_daily_history('BAD/EVIL', client=FakeClient())
        with self.assertRaises(ValueError):
            fetch_daily_history('MSFT', limit=50000, client=FakeClient())


if __name__ == '__main__':
    unittest.main()
