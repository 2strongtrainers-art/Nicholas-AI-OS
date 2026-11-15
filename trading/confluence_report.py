#!/usr/bin/env python3
"""Read-only intraday confluence evidence from market_feed.build_snapshot JSON.

No brokerage imports, order actions, LLM calls, or network access. This is
context for human research and does not alter paper_engine or daytrade_engine.
"""
from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

ET = ZoneInfo('America/New_York')


class ConfluenceError(ValueError):
    """Raised when evidence quality or safety requirements fail closed."""


def parse_aware(value: Any, field: str) -> datetime:
    if not isinstance(value, str) or not value.strip():
        raise ConfluenceError(f'{field} requires an ISO8601 timezone-aware timestamp')
    try:
        dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError as exc:
        raise ConfluenceError(f'{field} invalid timestamp') from exc
    if dt.tzinfo is None or dt.utcoffset() is None:
        raise ConfluenceError(f'{field} must have timezone')
    return dt.astimezone(timezone.utc)


def finite(value: Any, label: str, *, allow_zero: bool = False) -> float:
    try:
        n = float(value)
    except (ValueError, TypeError) as exc:
        raise ConfluenceError(f'{label} must be numeric') from exc
    if not math.isfinite(n) or (n < 0 if allow_zero else n <= 0):
        raise ConfluenceError(f'{label} out of range')
    return n


def ema(prices: list[float], period: int) -> float:
    if len(prices) < period:
        raise ConfluenceError(f'EMA{period} needs {period} observations')
    val = sum(prices[:period]) / period
    multiplier = 2.0 / (period + 1)
    for price in prices[period:]:
        val = price * multiplier + val * (1 - multiplier)
    return val


def rsi(prices: list[float], period: int = 14) -> float:
    if len(prices) < period + 1:
        raise ConfluenceError(f'RSI{period} requires {period + 1} observations')
    changes = [b - a for a, b in zip(prices, prices[1:])]
    gain = sum(max(0.0, x) for x in changes[:period]) / period
    loss = sum(max(0.0, -x) for x in changes[:period]) / period
    for diff in changes[period:]:
        gain = (gain * (period - 1) + max(0.0, diff)) / period
        loss = (loss * (period - 1) + max(0.0, -diff)) / period
    if gain == 0 and loss == 0:
        return 50.0
    if loss == 0:
        return 100.0
    return 100.0 - (100.0 / (1.0 + gain / loss))


def validate_bars(item: dict[str, Any], session_id: str) -> list[dict[str, Any]]:
    bars = item.get('bars')
    if not isinstance(bars, list) or not 30 <= len(bars) <= 1000:
        raise ConfluenceError('Requires 30-1000 intraday bars')
    clean: list[dict[str, Any]] = []
    previous: datetime | None = None
    for idx, raw in enumerate(bars):
        if not isinstance(raw, dict):
            raise ConfluenceError('Bar must be an object')
        stamp = parse_aware(raw.get('timestamp'), f'bar[{idx}].timestamp')
        local = stamp.astimezone(ET)
        if local.date().isoformat() != session_id or local.weekday() >= 5:
            raise ConfluenceError('Bars must belong to the one declared US equity session')
        if not ((9, 30) <= (local.hour, local.minute) <= (16, 0)):
            raise ConfluenceError('Out-of-session bar rejected')
        if previous is not None and stamp <= previous:
            raise ConfluenceError('Bars must be strictly time-ordered and unique')
        if previous is not None and (stamp - previous).total_seconds() < 30:
            raise ConfluenceError('Expected minute bars, not sub-minute or duplicated feed')
        previous = stamp
        nums = {field: finite(raw.get(field), f'bar[{idx}].{field}', allow_zero=(field == 'volume'))
                for field in ('open', 'high', 'low', 'close', 'volume')}
        if nums['high'] < max(nums['open'], nums['close'], nums['low']) or nums['low'] > min(nums['open'], nums['close'], nums['high']):
            raise ConfluenceError('Invalid OHLC')
        clean.append({'timestamp': stamp, **nums})
    return clean


def poc_proxy(bars: list[dict[str, Any]], bins: int = 20) -> float:
    """Rough bar-typical-price volume proxy; NOT tick-level volume profile/POC."""
    lows = min(b['low'] for b in bars)
    highs = max(b['high'] for b in bars)
    if highs == lows:
        return lows
    step = (highs - lows) / bins
    weighted = [0.0] * bins
    for b in bars:
        typical = (b['high'] + b['low'] + b['close']) / 3.0
        index = min(bins - 1, int((typical - lows) / step))
        weighted[index] += b['volume']
    best = max(range(bins), key=lambda i: weighted[i])
    return lows + (best + 0.5) * step


def analyze_symbol(item: dict[str, Any], session_id: str) -> dict[str, Any]:
    symbol = item.get('symbol')
    if not isinstance(symbol, str) or not symbol.strip() or len(symbol) > 24:
        raise ConfluenceError('Invalid symbol')
    bars = validate_bars(item, session_id)
    closes = [b['close'] for b in bars]
    latest = bars[-1]
    volume = sum(b['volume'] for b in bars)
    if volume == 0:
        raise ConfluenceError('Cannot calculate VWAP with zero total volume')
    vwap = sum(((b['high'] + b['low'] + b['close']) / 3.0) * b['volume'] for b in bars) / volume
    fast, slow = ema(closes, 9), ema(closes, 21)
    strength = rsi(closes)
    recent = bars[-11:-1]
    prev_avg = sum(b['volume'] for b in recent) / len(recent)
    rel_volume = (latest['volume'] / prev_avg) if prev_avg > 0 else None
    first_local = bars[0]['timestamp'].astimezone(ET)
    opening_complete = (first_local.hour, first_local.minute) == (9, 30) and len(bars) >= 16
    first_15 = bars[:15]
    or_high = max(b['high'] for b in first_15) if opening_complete else None
    or_low = min(b['low'] for b in first_15) if opening_complete else None
    bullish = {'above_vwap': latest['close'] > vwap,
               'ema9_above_ema21': fast > slow,
               'above_opening_range': opening_complete and latest['close'] > or_high,
               'volume_expansion': rel_volume is not None and rel_volume >= 1.25}
    bearish = {'below_vwap': latest['close'] < vwap,
               'ema9_below_ema21': fast < slow,
               'below_opening_range': opening_complete and latest['close'] < or_low,
               'volume_expansion': bullish['volume_expansion']}
    if sum(bullish.values()) >= 3 and strength >= 50:
        alignment = 'bullish_context'
    elif sum(bearish.values()) >= 3 and strength <= 50:
        alignment = 'bearish_context'
    else:
        alignment = 'mixed_or_insufficient'
    gaps = sum((b['timestamp'] - a['timestamp']).total_seconds() > 90 for a,b in zip(bars,bars[1:]))
    return {
        'symbol': symbol.strip().upper(),
        'last_bar_utc': latest['timestamp'].isoformat(),
        'price': round(latest['close'], 6),
        'vwap': round(vwap, 6),
        'ema9': round(fast, 6),
        'ema21': round(slow, 6),
        'rsi14': round(strength, 3),
        'relative_volume_last_bar_vs_prior_10': round(rel_volume, 3) if rel_volume is not None else None,
        'opening_range_15m': {'complete': opening_complete,
                              'high': round(or_high, 6) if or_high is not None else None,
                              'low': round(or_low, 6) if or_low is not None else None},
        'volume_point_of_control_proxy': round(poc_proxy(bars), 6),
        'poc_method': 'bar_typical_price_bin_proxy; NOT true traded-volume POC',
        'alignment': alignment,
        'bullish_factors': bullish,
        'bearish_factors': bearish,
        'missing_minute_bar_gaps': gaps,
        'spread_bps': finite(item['spread_bps'], 'spread_bps', allow_zero=True) if 'spread_bps' in item else None,
        'spread_estimated': item.get('spread_estimated'),
    }


def build_report(snapshot: dict[str, Any], *, now: datetime | None = None,
                 max_age_minutes: int = 10, historical: bool = False) -> dict[str, Any]:
    if snapshot.get('paper_only') is not True or snapshot.get('live_execution_enabled') is not False:
        raise ConfluenceError('Only explicit paper_only=true and live_execution_enabled=false supported')
    if snapshot.get('order_execution_enabled') or snapshot.get('broker_order_url'):
        raise ConfluenceError('Order execution fields prohibited')
    session_id = snapshot.get('session_id')
    if not isinstance(session_id, str) or not session_id:
        raise ConfluenceError('session_id required')
    provider = snapshot.get('provider')
    if not isinstance(provider, str) or not provider.strip():
        raise ConfluenceError('Named source provider required')
    fetched = parse_aware(snapshot.get('fetched_at'), 'fetched_at')
    now_utc = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    if not historical:
        age = (now_utc - fetched).total_seconds()
        if age < -120 or age > max_age_minutes * 60:
            raise ConfluenceError('Snapshot is future-dated or stale; use --historical for archival review')
    items = snapshot.get('symbols')
    if not isinstance(items, list) or not items:
        raise ConfluenceError('Nonempty symbols array required')
    reports = [analyze_symbol(item, session_id) for item in items]
    for row in reports:
        gap = (fetched - parse_aware(row['last_bar_utc'], 'last_bar_utc')).total_seconds()
        if gap < -120:
            raise ConfluenceError('Market bar timestamp later than fetch timestamp')
        if gap > 600 and not historical:
            raise ConfluenceError('Market bar lags fetch timestamp >10 minutes')
    return {
        'status': 'RESEARCH_ONLY', 'paper_only': True, 'live_execution_enabled': False,
        'orders_submitted': 0, 'trade_authorized': False, 'source_provider': provider,
        'session_id': session_id, 'session_complete': bool(snapshot.get('session_complete')),
        'fetched_at': fetched.isoformat(), 'mode': 'historical' if historical else 'fresh_snapshot',
        'notes': ['Not a live consolidated quote or a broker signal.',
                  'IEX/third-party feed coverage and delayed timestamps must be checked before interpretation.',
                  'POC is a bar-volume proxy, not tick-by-price volume profile.'],
        'symbols': reports, 'upstream_errors': snapshot.get('errors', {}),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('snapshot', type=Path, help='JSON from trading.market_feed.build_snapshot')
    parser.add_argument('--historical', action='store_true', help='Allow archived data without calling it live')
    parser.add_argument('--max-age-minutes', type=int, default=10)
    args = parser.parse_args()
    if args.max_age_minutes <= 0 or args.max_age_minutes > 60:
        parser.error('max-age-minutes must be 1..60')
    snapshot = json.loads(args.snapshot.read_text(encoding='utf-8'))
    print(json.dumps(build_report(snapshot, max_age_minutes=args.max_age_minutes,
                                  historical=args.historical), indent=2, sort_keys=True))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
