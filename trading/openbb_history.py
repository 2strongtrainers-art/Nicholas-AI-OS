#!/usr/bin/env python3
"""Manual, optional read-only OpenBB daily bars adapter.

OpenBB is not installed or contacted when this module is imported. No broker
or order routing is included. Provider usage may require separate data rights.
"""
from __future__ import annotations

import argparse
import json
import math
import re
from datetime import datetime, timezone
from typing import Any


def fetch_daily_history(symbol: str, *, provider: str | None = None,
                        limit: int = 90, client: Any = None) -> dict[str, Any]:
    if not re.fullmatch(r'[A-Z0-9.\-]{1,12}', symbol):
        raise ValueError('symbol must be uppercase alphanumerics, dot or hyphen')
    if not 1 <= limit <= 1000:
        raise ValueError('limit must be 1..1000')
    if client is None:
        from openbb import obb  # optional dependency; manual call only
        client = obb
    params = {'provider': provider} if provider else {}
    df = client.equity.price.historical(symbol, **params).to_dataframe()
    if not {'open', 'high', 'low', 'close', 'volume'}.issubset(df.columns):
        raise ValueError('OpenBB provider did not return required OHLCV fields')
    rows: list[dict[str, Any]] = []
    for stamp, entry in df.tail(limit).iterrows():
        values = {k: float(entry[k]) for k in ('open', 'high', 'low', 'close', 'volume')}
        if any(not math.isfinite(v) for v in values.values()) or any(values[k] <= 0 for k in ('open', 'high', 'low', 'close')) or values['volume'] < 0:
            raise ValueError('OpenBB history has non-finite or invalid OHLCV')
        if values['high'] < max(values['open'], values['low'], values['close']) or values['low'] > min(values['open'], values['high'], values['close']):
            raise ValueError('OpenBB history has inconsistent OHLC')
        rows.append({'date': str(stamp)[:10], **values})
    if not rows:
        raise ValueError('OpenBB returned no bars')
    dates = [r['date'] for r in rows]
    if dates != sorted(set(dates)):
        raise ValueError('OpenBB history must have strictly increasing unique dates')
    return {'status': 'HISTORICAL_RESEARCH', 'paper_only': True, 'trade_authorized': False,
            'symbol': symbol, 'source': 'openbb', 'provider_requested': provider,
            'retrieved_at': datetime.now(timezone.utc).isoformat(), 'bars': rows}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--symbol', required=True)
    parser.add_argument('--provider')
    parser.add_argument('--limit', type=int, default=90)
    args = parser.parse_args()
    print(json.dumps(fetch_daily_history(args.symbol, provider=args.provider, limit=args.limit), indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
