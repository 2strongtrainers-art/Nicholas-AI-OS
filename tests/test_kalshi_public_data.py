from __future__ import annotations

import copy
import io
import json
import unittest
import urllib.error
from contextlib import redirect_stdout
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

from trading.kalshi_public_data import (
    BASE_URL, KalshiDataError, PublicKalshiClient, build_hermes_task,
    collect_snapshot, main, normalize_book, validate_snapshot,
)

NOW = datetime(2026, 10, 17, 15, 35, tzinfo=timezone.utc)
TICKER = "KXBTC15M-26OCT171145-45"


def transport(path="/markets/" + TICKER):
    return {
        "url": BASE_URL + path,
        "requested_at": (NOW - timedelta(seconds=2)).isoformat(),
        "received_at": (NOW - timedelta(seconds=1)).isoformat(),
        "server_date": (NOW - timedelta(seconds=1)).isoformat(),
        "cache_age_seconds": 0,
    }


def market():
    return {"ticker": TICKER, "title": "BTC price up in next 15 mins?",
            "market_type": "binary", "status": "active",
            "open_time": "2026-10-17T15:30:00Z", "close_time": "2026-10-17T15:45:00Z",
            "notional_value_dollars": "1.0000", "rules_primary": "Compare the specified CF Benchmarks averages.",
            "floor_strike": Decimal("81392.70000001"), "strike_type": "greater_or_equal",
            "rules_secondary": "Coinbase is not the settlement source."}


def book():
    # Deliberately ascending and includes sub-cent prices/fractional quantities.
    return {"orderbook_fp": {"yes_dollars": [["0.5000", "10.25"], ["0.5125", "3.75"]],
                             "no_dollars": [["0.4700", "8.50"], ["0.4750", "6.25"]]}}


class FakeClient:
    def __init__(self):
        self.details = market()
        self.payload = book()
        self.calls = []

    def discover(self, series):
        self.calls.append("discover")
        return TICKER

    def orderbook(self, ticker, depth):
        self.calls.append("book")
        return {"data": self.payload, "transport": transport("/markets/" + TICKER + "/orderbook")}

    def market(self, ticker):
        self.calls.append("market")
        return {"data": {"market": self.details}, "transport": transport()}


class KalshiBookTests(unittest.TestCase):
    def test_asks_and_available_size_come_from_opposite_bid(self):
        result = normalize_book(book(), 5)
        self.assertEqual(result["yes"]["bid_dollars"], "0.5125")
        self.assertEqual(result["yes"]["ask_dollars"], "0.5250")
        self.assertEqual(result["yes"]["ask_size_fp"], "6.25")
        self.assertEqual(result["no"]["ask_dollars"], "0.4875")
        self.assertEqual(result["no"]["ask_size_fp"], "3.75")
        self.assertEqual(result["yes"]["spread_dollars"], "0.0125")

    def test_empty_side_preserves_unknown_prices(self):
        payload = book()
        payload["orderbook_fp"]["no_dollars"] = []
        result = normalize_book(payload, 5)
        self.assertFalse(result["two_sided"])
        self.assertIsNone(result["yes"]["ask_dollars"])
        self.assertIsNone(result["no"]["bid_dollars"])
        self.assertIsNone(result["yes"]["spread_dollars"])

    def test_bad_decimals_and_quantities_are_rejected(self):
        for price, size in [("NaN", "1"), ("Infinity", "1"), (0.51, "1"),
                            (51, "1"), ("1.01", "1"), ("-0.1", "1"),
                            ("0.50001", "1"), ("5e-1", "1"), ("0.5", "0"),
                            ("0.5", "-1"), ("0.5", "1.001"), ("0.5", 2)]:
            with self.subTest(price=price, size=size):
                payload = book()
                payload["orderbook_fp"]["yes_dollars"] = [[price, size]]
                with self.assertRaises(KalshiDataError):
                    normalize_book(payload, 5)

    def test_crossed_duplicate_missing_and_legacy_books_are_rejected(self):
        bad = [
            {"orderbook_fp": {"yes_dollars": [["0.8", "1"]], "no_dollars": [["0.3", "1"]]}},
            {"orderbook_fp": {"yes_dollars": [["0.5", "1"], ["0.50", "2"]], "no_dollars": []}},
            {"orderbook_fp": {"yes_dollars": []}},
            {"orderbook": {"yes": [[50, 2]], "no": [[49, 2]]}},
        ]
        for payload in bad:
            with self.subTest(payload=payload), self.assertRaises(KalshiDataError):
                normalize_book(payload, 5)


class KalshiSnapshotTests(unittest.TestCase):
    def setUp(self):
        self.clock = patch("trading.kalshi_public_data.utc_now", return_value=NOW)
        self.clock.start()
        self.addCleanup(self.clock.stop)
        self.client = FakeClient()

    def snapshot(self):
        return collect_snapshot(client=self.client)

    def test_snapshot_uses_post_book_lifecycle_and_bounded_hermes_task(self):
        snapshot = self.snapshot()
        self.assertEqual(self.client.calls, ["discover", "book", "market"])
        self.assertFalse(snapshot["live_execution_enabled"])
        self.assertIsNone(snapshot["quality"]["win_probability"])
        self.assertEqual(snapshot["market"]["floor_strike"], "81392.70000001")
        task = build_hermes_task(snapshot)
        self.assertLessEqual(len(task), 12000)
        self.assertIn("untrusted data", task)
        self.assertIn("Do not recommend an entry", task)
        self.assertIn("reference_index_value", task)

    def test_closed_paused_future_and_wrong_contracts_are_rejected(self):
        for change in [{"status": "closed"}, {"status": "inactive"},
                       {"close_time": NOW.isoformat()}, {"open_time": "2026-10-17T15:40:00Z"},
                       {"market_type": "scalar"}, {"notional_value_dollars": "2.0000"},
                       {"ticker": "OTHER"}, {"rules_primary": ""}, {"close_time": "2026-10-17T15:45:00"}]:
            self.client.details = {**market(), **change}
            with self.subTest(change=change), self.assertRaises(KalshiDataError):
                self.snapshot()

    def test_consumer_rejects_stale_cached_and_future_observations(self):
        original = self.snapshot()
        with self.assertRaises(KalshiDataError):
            validate_snapshot(original, NOW + timedelta(seconds=11))
        for change in [{"cache_age_seconds": 11}, {"cache_age_seconds": -1},
                       {"requested_at": (NOW + timedelta(seconds=2)).isoformat()},
                       {"server_date": (NOW - timedelta(seconds=30)).isoformat()},
                       {"received_at": (NOW + timedelta(seconds=4)).isoformat()}]:
            snapshot = copy.deepcopy(original)
            snapshot["sources"]["orderbook"].update(change)
            with self.subTest(change=change), self.assertRaises(KalshiDataError):
                validate_snapshot(snapshot, NOW)

    def test_metadata_updated_time_does_not_determine_book_freshness(self):
        self.client.details["updated_time"] = "2000-01-01T00:00:00Z"
        validate_snapshot(self.snapshot(), NOW)

    def test_missing_provenance_and_enabled_execution_fail_closed(self):
        for change in [{"sources": {}}, {"sources": {"market": transport()}},
                       {"live_execution_enabled": True}, {"ok": False}]:
            snapshot = {**self.snapshot(), **change}
            with self.subTest(change=change), self.assertRaises(KalshiDataError):
                validate_snapshot(snapshot, NOW)

    def test_wrong_source_origin_or_market_is_rejected(self):
        for url in ["https://example.com/markets/OTHER", BASE_URL + "/markets/OTHER/orderbook"]:
            snapshot = self.snapshot()
            snapshot["sources"]["orderbook"]["url"] = url
            with self.subTest(url=url), self.assertRaises(KalshiDataError):
                validate_snapshot(snapshot, NOW)

    def test_explicit_ticker_skips_discovery_and_invalid_depth_uses_no_network(self):
        collect_snapshot(ticker=TICKER, client=self.client)
        self.assertEqual(self.client.calls, ["book", "market"])
        self.client.calls.clear()
        with self.assertRaises(KalshiDataError):
            collect_snapshot(depth=0, client=self.client)
        self.assertEqual(self.client.calls, [])

    def test_cli_failure_has_no_previous_success_payload(self):
        out = io.StringIO()
        with patch("trading.kalshi_public_data.collect_snapshot", side_effect=KalshiDataError("stale")), redirect_stdout(out):
            self.assertEqual(main([]), 1)
        self.assertEqual(json.loads(out.getvalue())["ok"], False)


class KalshiClientTests(unittest.TestCase):
    def response_client(self, body, headers=None):
        client = PublicKalshiClient()
        response = MagicMock()
        response.read.return_value = body
        response.headers = headers if headers is not None else {"Date": "Sat, 17 Oct 2026 15:35:00 GMT"}
        client.opener = MagicMock()
        client.opener.open.return_value.__enter__.return_value = response
        return client

    def test_only_public_gets_with_bounded_timeout_and_no_auth(self):
        client = PublicKalshiClient()
        response = MagicMock()
        response.read.return_value = b'{"market": {}}'
        response.headers = {"Date": "Sat, 17 Oct 2026 15:35:00 GMT"}
        client.opener = MagicMock()
        client.opener.open.return_value.__enter__.return_value = response
        with patch("trading.kalshi_public_data.utc_now", return_value=NOW):
            client.market(TICKER)
        request = client.opener.open.call_args.args[0]
        self.assertEqual(request.get_method(), "GET")
        self.assertIsNone(request.data)
        self.assertNotIn("authorization", {k.lower() for k in request.headers})
        self.assertEqual(client.opener.open.call_args.kwargs["timeout"], 10)
        for path in ["/portfolio/orders", "/markets/../portfolio", "/markets/ABC?x=1"]:
            with self.subTest(path=path), self.assertRaises(KalshiDataError):
                client._get(path)

    def test_input_validation_precedes_network(self):
        client = PublicKalshiClient()
        for ticker in ["../orders", "https://example.com", "ABC/OTHER", "", None]:
            with self.subTest(ticker=ticker), self.assertRaises(KalshiDataError):
                client.market(ticker)
        for depth in [-1, 0, 101, True, 1.5]:
            with self.subTest(depth=depth), self.assertRaises(KalshiDataError):
                client.orderbook(TICKER, depth)

    def test_discovery_paginates_and_selects_nearest_active_close(self):
        client = PublicKalshiClient()
        later = {**market(), "ticker": "KXBTC15M-LATER", "close_time": "2026-10-17T16:00:00Z"}
        client._get = MagicMock(side_effect=[
            {"data": {"markets": [later], "cursor": "page2"}},
            {"data": {"markets": [market()], "cursor": ""}},
        ])
        with patch("trading.kalshi_public_data.utc_now", return_value=NOW):
            self.assertEqual(client.discover("KXBTC15M"), TICKER)
        self.assertEqual(client._get.call_args.args[1]["cursor"], "page2")

    def test_discovery_rejects_repeated_cursor_and_wrong_series(self):
        client = PublicKalshiClient()
        client._get = MagicMock(return_value={"data": {"markets": [], "cursor": "same"}})
        with self.assertRaises(KalshiDataError):
            client.discover("KXBTC15M")
        client._get = MagicMock(return_value={"data": {"markets": [{**market(), "ticker": "OTHER-1"}], "cursor": ""}})
        with self.assertRaises(KalshiDataError):
            client.discover("KXBTC15M")

    def test_transport_rejects_invalid_json_cache_headers_and_oversized_body(self):
        cases = [(b'not json', None), (b'{"x": NaN}', None), (b'[]', None),
                 (b'{}', {}), (b'{}', {"Date": "bad"}),
                 (b'{}', {"Date": "Sat, 17 Oct 2026 15:35:00 GMT", "Age": "-1"}),
                 (b'x' * 2_000_001, None)]
        for body, headers in cases:
            client = self.response_client(body, headers)
            with self.subTest(body=body[:20], headers=headers), self.assertRaises(KalshiDataError):
                client.market(TICKER)

    def test_http_and_timeout_errors_are_sanitized(self):
        client = self.response_client(b'{}')
        for error in [urllib.error.HTTPError(BASE_URL, 429, "private response text", {}, None),
                      urllib.error.URLError("private network detail"), TimeoutError("private detail")]:
            client.opener.open.side_effect = error
            with self.subTest(error=type(error)), self.assertRaises(KalshiDataError) as raised:
                client.market(TICKER)
            self.assertNotIn("private", str(raised.exception))

    def test_no_redirects_or_unbounded_discovery(self):
        from trading.kalshi_public_data import _NoRedirect
        with self.assertRaises(KalshiDataError):
            _NoRedirect().redirect_request(None, None, 302, "", {}, "https://example.com")
        client = PublicKalshiClient()
        client._get = MagicMock(side_effect=[{"data": {"markets": [], "cursor": str(i)}} for i in range(10)])
        with self.assertRaises(KalshiDataError):
            client.discover("KXBTC15M")
        self.assertEqual(client._get.call_count, 10)


if __name__ == "__main__":
    unittest.main()
