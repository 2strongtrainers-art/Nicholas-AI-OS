#!/usr/bin/env python3
"""Market-data collection for the paper-only day trader.

This module is data-only by design. It can read Alpaca IEX market data when
APCA_API_KEY_ID/APCA_API_SECRET_KEY are available, otherwise it falls back to
Yahoo's public chart endpoint. It contains no brokerage/trading endpoints and
never submits orders.
"""

from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
from datetime import datetime, time, timezone
from typing import Any
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")
DEFAULT_SYMBOLS = ("SPY", "QQQ", "NVDA", "AAPL", "MSFT", "AMD")
USER_AGENT = "Nicholas-AI-OS-PaperTrader/1.0"


class MarketDataError(RuntimeError):
    pass


def _request_json(url: str, headers: dict[str, str] | None = None, timeout: int = 12) -> dict[str, Any]:
    merged = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    if headers:
        merged.update(headers)
    request = urllib.request.Request(url, headers=merged, method="GET")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def _in_regular_session(ts: int) -> bool:
    dt = datetime.fromtimestamp(ts, tz=timezone.utc).astimezone(ET)
    return dt.weekday() < 5 and time(9, 30) <= dt.time() <= time(16, 0)


def _yahoo_symbol(symbol: str) -> dict[str, Any]:
    quoted = urllib.parse.quote(symbol, safe="")
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{quoted}"
        "?interval=1m&range=1d&includePrePost=false&events=div%2Csplits"
    )
    payload = _request_json(url)
    result = ((payload.get("chart") or {}).get("result") or [None])[0]
    if not result:
        raise MarketDataError(f"Yahoo returned no chart data for {symbol}")
    timestamps = result.get("timestamp") or []
    quotes = (((result.get("indicators") or {}).get("quote") or [{}])[0])
    fields = {key: quotes.get(key) or [] for key in ("open", "high", "low", "close", "volume")}
    bars: list[dict[str, Any]] = []
    for idx, ts in enumerate(timestamps):
        if not _in_regular_session(int(ts)):
            continue
        values = {key: fields[key][idx] if idx < len(fields[key]) else None for key in fields}
        if any(values[key] is None for key in values):
            continue
        if float(values["volume"]) <= 0:
            continue
        bars.append({
            "timestamp": datetime.fromtimestamp(int(ts), tz=timezone.utc).isoformat(),
            "open": float(values["open"]),
            "high": float(values["high"]),
            "low": float(values["low"]),
            "close": float(values["close"]),
            "volume": float(values["volume"]),
        })
    if not bars:
        raise MarketDataError(f"Yahoo returned no usable regular-session bars for {symbol}")
    # Yahoo chart data does not expose a reliable NBBO. Use a deliberately
    # conservative 5 bps estimate for this highly-liquid paper universe.
    return {"symbol": symbol, "bars": bars, "spread_bps": 5.0, "spread_estimated": True}


def _alpaca_symbol(symbol: str, now_utc: datetime, api_key: str, api_secret: str) -> dict[str, Any]:
    now_et = now_utc.astimezone(ET)
    open_et = datetime.combine(now_et.date(), time(9, 30), ET)
    params = urllib.parse.urlencode({
        "timeframe": "1Min",
        "start": open_et.astimezone(timezone.utc).isoformat(),
        "end": now_utc.isoformat(),
        "limit": 1000,
        "feed": "iex",
        "adjustment": "raw",
    })
    headers = {"APCA-API-KEY-ID": api_key, "APCA-API-SECRET-KEY": api_secret}
    bars_raw = _request_json(
        f"https://data.alpaca.markets/v2/stocks/{urllib.parse.quote(symbol)}/bars?{params}", headers
    ).get("bars") or []
    bars = [
        {
            "timestamp": str(row["t"]),
            "open": float(row["o"]),
            "high": float(row["h"]),
            "low": float(row["l"]),
            "close": float(row["c"]),
            "volume": float(row["v"]),
        }
        for row in bars_raw
        if float(row.get("v", 0)) > 0
    ]
    if not bars:
        raise MarketDataError(f"Alpaca returned no bars for {symbol}")
    quote = _request_json(
        f"https://data.alpaca.markets/v2/stocks/{urllib.parse.quote(symbol)}/quotes/latest?feed=iex", headers
    ).get("quote") or {}
    bid, ask = float(quote.get("bp") or 0), float(quote.get("ap") or 0)
    if bid > 0 and ask >= bid:
        mid = (bid + ask) / 2.0
        spread_bps = ((ask - bid) / mid) * 10000.0 if mid > 0 else 20.0
        estimated = False
    else:
        spread_bps, estimated = 5.0, True
    return {"symbol": symbol, "bars": bars, "spread_bps": spread_bps, "spread_estimated": estimated}


def build_snapshot(symbols: list[str] | tuple[str, ...] | None = None, now: datetime | None = None) -> dict[str, Any]:
    now_utc = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    now_et = now_utc.astimezone(ET)
    if now_et.weekday() >= 5:
        raise MarketDataError("US equity market is closed for the weekend")
    selected = [str(s).strip().upper() for s in (symbols or DEFAULT_SYMBOLS) if str(s).strip()]
    if not selected:
        raise MarketDataError("At least one symbol is required")

    key = os.environ.get("APCA_API_KEY_ID", "").strip()
    secret = os.environ.get("APCA_API_SECRET_KEY", "").strip()
    provider = "alpaca_iex" if key and secret else "yahoo_chart_fallback"
    payloads: list[dict[str, Any]] = []
    errors: dict[str, str] = {}
    for symbol in selected:
        try:
            item = _alpaca_symbol(symbol, now_utc, key, secret) if provider == "alpaca_iex" else _yahoo_symbol(symbol)
            payloads.append(item)
        except Exception as exc:
            errors[symbol] = str(exc)

    if not payloads:
        raise MarketDataError(f"No usable market data: {errors}")
    session_complete = now_et.time() >= time(16, 0)
    return {
        "paper_only": True,
        "live_execution_enabled": False,
        "session_id": now_et.date().isoformat(),
        "session_complete": session_complete,
        "provider": provider,
        "fetched_at": now_utc.isoformat(),
        "symbols": payloads,
        "errors": errors,
    }
