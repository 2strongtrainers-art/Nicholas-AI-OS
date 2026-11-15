import unittest
from types import SimpleNamespace
from trading.openbb_history import fetch_daily_history


class FakeFrame:
    columns = ["open", "high", "low", "close", "volume"]
    def tail(self, n):
        return self
    def iterrows(self):
        yield ("2026-11-12", {"open": 100, "high": 101, "low": 99, "close": 100.5, "volume": 12345})
        yield ("2026-11-13", {"open": 100.5, "high": 102, "low": 100, "close": 101, "volume": 23456})


class FakeOutput:
    provider = "cboe"
    def to_dataframe(self):
        return FakeFrame()


class FakeClient:
    def __init__(self):
        self.called = []
        self.cboe = SimpleNamespace(equity=SimpleNamespace(historical=self.fetch))
    def fetch(self, **kwargs):
        self.called.append(kwargs)
        return FakeOutput()


class OpenBBHistoryTests(unittest.TestCase):
    def test_documented_v5_provider_injected_readonly(self):
        client = FakeClient()
        out = fetch_daily_history("MSFT", client=client, limit=5)
        self.assertEqual(client.called, [{"symbol": "MSFT"}])
        self.assertEqual(len(out["bars"]), 2)
        self.assertEqual(out["provider_reported"], "cboe")
        self.assertFalse(out["trade_authorized"])

    def test_rejects_invalid_symbol_or_provider(self):
        with self.assertRaises(ValueError):
            fetch_daily_history("BAD/EVIL", client=FakeClient())
        with self.assertRaises(ValueError):
            fetch_daily_history("MSFT", provider="paid_vendor", client=FakeClient())
        with self.assertRaises(ValueError):
            fetch_daily_history("MSFT", limit=50000, client=FakeClient())

    def test_missing_v5_namespace_fails_closed(self):
        with self.assertRaisesRegex(RuntimeError, "openbb-cboe"):
            fetch_daily_history("MSFT", client=SimpleNamespace())


if __name__ == "__main__":
    unittest.main()
