#!/usr/bin/env python3
"""Opt-in OpenBB V5 / Cboe DAILY historical data, read-only.

Uses the documented V5 obb.cboe.equity.historical namespace. Installs nothing,
requests no paid providers and never accesses broker trading endpoints. Import
of OpenBB occurs only on a manually invoked call.
"""
from __future__ import annotations

import argparse
import json
import math
import re
from datetime import datetime, timezone
from typing import Any


def fetch_daily_history(symbol: str, *, provider: str = "cboe",
                        limit: int = 90, client: Any = None) -> dict[str, Any]:
    if not isinstance(symbol, str) or not re.fullmatch(r"[A-Z0-9.\-]{1,12}", symbol):
        raise ValueError("Symbol must be uppercase alphanumerics, dot or hyphen")
    if provider != "cboe":
        raise ValueError("Only documented read-only OpenBB V5 cboe provider is supported")
    if not 1 <= limit <= 1000:
        raise ValueError("limit must be 1..1000")
    if client is None:
        from openbb import obb  # installed in separate environment if used
        client = obb
    try:
        endpoint = client.cboe.equity.historical
    except AttributeError as exc:
        raise RuntimeError("OpenBB V5 cboe namespace missing; install openbb-cboe and run openbb-build") from exc
    output = endpoint(symbol=symbol)
    if not hasattr(output, "to_dataframe"):
        raise ValueError("OpenBB V5 output must expose to_dataframe()")
    df = output.to_dataframe()
    if not {"open", "high", "low", "close", "volume"}.issubset(df.columns):
        raise ValueError("OpenBB Cboe did not return required daily OHLCV fields")
    rows: list[dict[str, Any]] = []
    for stamp, entry in df.tail(limit).iterrows():
        values = {k: float(entry[k]) for k in ("open", "high", "low", "close", "volume")}
        if any(not math.isfinite(v) for v in values.values()) or any(values[k] <= 0 for k in ("open", "high", "low", "close")) or values["volume"] < 0:
            raise ValueError("OpenBB data contains invalid OHLCV")
        if values["high"] < max(values["open"], values["low"], values["close"]) or values["low"] > min(values["open"], values["high"], values["close"]):
            raise ValueError("OpenBB data contains inconsistent OHLC")
        rows.append({"date": str(stamp)[:10], **values})
    if not rows:
        raise ValueError("OpenBB returned no daily bars")
    dates = [r["date"] for r in rows]
    if dates != sorted(set(dates)):
        raise ValueError("OpenBB bars must have distinct ascending dates")
    return {
        "status": "HISTORICAL_RESEARCH", "paper_only": True,
        "trade_authorized": False, "symbol": symbol, "source": "openbb_v5",
        "provider": "cboe", "provider_reported": getattr(output, "provider", None),
        "retrieved_at": datetime.now(timezone.utc).isoformat(), "bars": rows
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--symbol", required=True)
    parser.add_argument("--limit", type=int, default=90)
    args = parser.parse_args()
    print(json.dumps(fetch_daily_history(args.symbol, limit=args.limit), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
