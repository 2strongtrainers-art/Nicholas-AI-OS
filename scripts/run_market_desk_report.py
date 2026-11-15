#!/usr/bin/env python3
"""GitHub-hosted, data-only research check. No trade endpoints or raw bar uploads.

Uses the existing trading.market_feed adapter, requires independently provisioned
Alpaca DATA credentials in GitHub Secrets, never invokes its Yahoo fallback.
Intended after market close. All public output is coverage metadata, not prices.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo

from trading.market_feed import MarketDataError, build_snapshot
from trading.market_desk_pipeline import research_pipeline

ET = ZoneInfo("America/New_York")
SYMBOLS = ("SPY", "QQQ", "MSFT")


def run_report(session: date | None = None) -> dict:
    if not all(os.environ.get(name, "").strip() for name in ("APCA_API_KEY_ID", "APCA_API_SECRET_KEY")):
        return {"status": "SKIPPED_NO_ALPACA_DATA_CREDENTIALS", "orders_sent": 0}
    now = datetime.now(timezone.utc)
    local = now.astimezone(ET)
    end = now
    if session is not None:
        end = datetime.combine(session, time(16, 15), ET)
        if session.weekday() >= 5 or end > now:
            return {"status": "INVALID_COMPLETED_SESSION", "orders_sent": 0}
    elif local.weekday() >= 5 or local.time() < time(16, 15):
        return {"status": "SKIPPED_NOT_AFTER_MARKET_CLOSE", "orders_sent": 0}
    try:
        snapshot = build_snapshot(list(SYMBOLS), now=end, include_current_quotes=session is None)
        if snapshot.get("provider") != "alpaca_iex":
            raise MarketDataError("No authorized Alpaca feed")
        snapshot["fetched_at"] = now.isoformat()
        report = research_pipeline(snapshot, historical=True, paper_replay=False)
    except (MarketDataError, ValueError, KeyError) as exc:
        return {"status": "DATA_UNAVAILABLE_OR_REJECTED", "orders_sent": 0,
                "reason": type(exc).__name__}
    if session is not None and not any(row.get("bars_checked") for row in report["symbols"]):
        return {"status": "DATA_UNAVAILABLE_OR_REJECTED", "orders_sent": 0}
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
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--session", type=date.fromisoformat, metavar="YYYY-MM-DD",
                        help="verify a completed session and fail the run if no Alpaca bars are validated")
    args = parser.parse_args()
    result = run_report(args.session)
    summary = json.dumps(result, separators=(",", ":"), sort_keys=True)
    print(summary)
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as handle:
            handle.write("### Nicholas Market Desk — read-only data check\n\n")
            handle.write("No orders or real-money signals are emitted.\n\n")
            handle.write("~~~json\n" + summary + "\n~~~\n")
    if args.session is not None:
        return 0 if result.get("status") == "RESEARCH_ONLY" else 1
    return 0 if result.get("status") in {
        "RESEARCH_ONLY", "SKIPPED_NO_ALPACA_DATA_CREDENTIALS",
        "SKIPPED_NOT_AFTER_MARKET_CLOSE", "DATA_UNAVAILABLE_OR_REJECTED"
    } else 1


if __name__ == "__main__":
    sys.exit(main())
