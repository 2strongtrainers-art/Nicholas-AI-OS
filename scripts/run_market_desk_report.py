#!/usr/bin/env python3
"""GitHub-hosted, data-only research check. No trade endpoints or raw bar uploads.

Uses the existing trading.market_feed adapter, requires independently provisioned
Alpaca DATA credentials in GitHub Secrets, never invokes its Yahoo fallback.
Intended after market close. All public output is coverage metadata, not prices.
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo

from trading.market_feed import MarketDataError, build_snapshot
from trading.market_desk_pipeline import research_pipeline

ET = ZoneInfo("America/New_York")
SYMBOLS = ("SPY", "QQQ", "MSFT")


def run_report() -> dict:
    if not (os.environ.get("APCA_API_KEY_ID") and os.environ.get("APCA_API_SECRET_KEY")):
        return {"status": "SKIPPED_NO_ALPACA_DATA_CREDENTIALS", "orders_sent": 0}
    now = datetime.now(timezone.utc)
    local = now.astimezone(ET)
    if local.weekday() >= 5 or local.time() < time(16, 15):
        return {"status": "SKIPPED_NOT_AFTER_MARKET_CLOSE", "orders_sent": 0}
    try:
        snapshot = build_snapshot(list(SYMBOLS), now=now)
        if snapshot.get("provider") != "alpaca_iex":
            raise MarketDataError("No authorized Alpaca feed")
        report = research_pipeline(snapshot, historical=True, paper_replay=False)
    except (MarketDataError, ValueError, KeyError) as exc:
        return {"status": "DATA_UNAVAILABLE_OR_REJECTED", "orders_sent": 0,
                "reason": type(exc).__name__}
    return {
        "status": "RESEARCH_ONLY",
        "source": "alpaca_iex",
        "session": report["session_id"],
        "orders_sent": 0,
        "trade_authorized": False,
        "symbol_quality": [
            {"symbol": row["symbol"],
             "quality_gate": row["quality_gate"],
             "bars": row.get("bars_checked"),
             "missing_minutes": row.get("missing_minutes"),
             "boundary_bars_excluded": row.get("boundary_bars_excluded")}
            for row in report["symbols"]
        ]
    }


def main() -> int:
    result = run_report()
    summary = json.dumps(result, separators=(",", ":"), sort_keys=True)
    print(summary)
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as handle:
            handle.write("### Nicholas Market Desk — read-only data check\n\n")
            handle.write("No orders or real-money signals are emitted.\n\n")
            handle.write("~~~json\n" + summary + "\n~~~\n")
    return 0 if result.get("status") in {
        "RESEARCH_ONLY", "SKIPPED_NO_ALPACA_DATA_CREDENTIALS",
        "SKIPPED_NOT_AFTER_MARKET_CLOSE", "DATA_UNAVAILABLE_OR_REJECTED"
    } else 1


if __name__ == "__main__":
    sys.exit(main())
