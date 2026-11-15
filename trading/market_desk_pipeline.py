#!/usr/bin/env python3
"""Validated research -> optional illustrative PAPER replay, with no order APIs.

The single source of market bars is trading.market_feed. Public repo outputs
contain no private balances, accounts or broker credentials. Vibe-Trading,
Fincept and LEAN are deliberately not auto-invoked.
"""
from __future__ import annotations

import argparse
import copy
import json
import re
from datetime import datetime, time, timezone
from pathlib import Path
from typing import Any

from trading.confluence_report import ConfluenceError, ET, build_report, parse_aware

PROVIDERS = frozenset({"alpaca_iex", "yahoo_chart_fallback", "test_synthetic"})


def _safe_symbol(value: Any) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"[A-Z0-9.\-]{1,12}", value):
        raise ConfluenceError("Symbols must use uppercase ticker characters")
    return value


def _normalize_session(snapshot: dict[str, Any]) -> tuple[dict[str, Any], dict[str, int]]:
    """Drop only exact 16:00 ET bars, never silently alter other evidence."""
    if not isinstance(snapshot, dict):
        raise ConfluenceError("Snapshot must be an object")
    if snapshot.get("paper_only") is not True or snapshot.get("live_execution_enabled") is not False:
        raise ConfluenceError("Paper-only required")
    if snapshot.get("order_execution_enabled") or snapshot.get("broker_order_url"):
        raise ConfluenceError("Order execution prohibited")
    if snapshot.get("provider") not in PROVIDERS:
        raise ConfluenceError("Unapproved market data provider")
    items = snapshot.get("symbols")
    if not isinstance(items, list) or not 1 <= len(items) <= 12:
        raise ConfluenceError("1-12 symbols required")
    result = copy.deepcopy(snapshot)
    seen: set[str] = set()
    dropped: dict[str, int] = {}
    for item in result["symbols"]:
        if not isinstance(item, dict):
            raise ConfluenceError("Each symbol payload must be an object")
        symbol = _safe_symbol(item.get("symbol"))
        if symbol in seen:
            raise ConfluenceError("Duplicate ticker payload")
        seen.add(symbol)
        source_bars = item.get("bars")
        if not isinstance(source_bars, list):
            raise ConfluenceError("Bars must be an array")
        clean = []
        removed = 0
        for bar in source_bars:
            if not isinstance(bar, dict):
                raise ConfluenceError("Invalid bar object")
            utc = parse_aware(bar.get("timestamp"), "bar.timestamp")
            local = utc.astimezone(ET)
            # Alpaca sometimes returns a bar starting at 16:00 (outside RTH).
            if local.time() == time(16, 0) and local.date().isoformat() == result.get("session_id"):
                removed += 1
            else:
                clean.append(bar)
        item["bars"] = clean
        dropped[symbol] = removed
    return result, dropped


def research_pipeline(snapshot: dict[str, Any], *, historical: bool = False,
                      now: datetime | None = None,
                      paper_replay: bool = False) -> dict[str, Any]:
    safe, dropped = _normalize_session(snapshot)
    provider = safe["provider"]
    session_id = str(safe.get("session_id", ""))
    summaries = []
    eligible = []
    for item in safe["symbols"]:
        symbol = item["symbol"]
        try:
            report = build_report({**safe, "symbols": [item]}, historical=historical, now=now)
            row = report["symbols"][0]
            bars = item["bars"]
            first = parse_aware(bars[0]["timestamp"], "start").astimezone(ET)
            last = parse_aware(bars[-1]["timestamp"], "end").astimezone(ET)
            blockers = []
            if first.time() != time(9, 30):
                blockers.append("missing_0930_open")
            if not row["opening_range_15m"]["complete"]:
                blockers.append("opening_range_incomplete")
            if row["missing_minutes"]:
                blockers.append("missing_intraday_minutes")
            if safe.get("session_complete") and (last.time() != time(15, 59) or len(bars) != 390):
                blockers.append("incomplete_full_session")
            if provider != "alpaca_iex":
                blockers.append("not_approved_alpaca_source")
            if item.get("spread_estimated") is not False:
                blockers.append("spread_unverified")
            row.update({"bars_checked": len(bars), "boundary_bars_excluded": dropped[symbol],
                        "quality_gate": "PASS_PAPER_REVIEW" if not blockers else "RESEARCH_ONLY_BLOCKED",
                        "paper_blockers": blockers})
            summaries.append(row)
            if not blockers:
                eligible.append(item)
        except (ConfluenceError, ValueError, KeyError, TypeError) as exc:
            summaries.append({"symbol": symbol, "quality_gate": "REJECTED",
                              "paper_blockers": [str(exc)], "boundary_bars_excluded": dropped[symbol]})
    replay: dict[str, Any] = {"status": "NOT_REQUESTED", "orders_sent": 0}
    if paper_replay:
        replay = _illustrative_replay(safe, eligible)
    return {
        "status": "RESEARCH_ONLY", "paper_only": True,
        "live_execution_enabled": False, "trade_authorized": False,
        "orders_sent": 0, "source": provider, "session_id": session_id,
        "mode": "historical_review" if historical else "current_session_review",
        "session_complete": safe.get("session_complete") is True,
        "symbols": summaries, "upstream_errors": safe.get("errors") or {},
        "replay": replay,
        "notes": ["IEX is not consolidated US equity market data.",
                  "VWAP is bar-typical-price approximation, and POC is a coarse bar-volume proxy.",
                  "Alignment and paper eligibility are not trade signals or profitability evidence.",
                  "Data gaps or estimated spread block even paper review for that symbol."],
    }


def _illustrative_replay(snapshot: dict[str, Any], eligible: list[dict[str, Any]]) -> dict[str, Any]:
    if snapshot.get("session_complete") is not True or not eligible:
        return {"status": "BLOCKED_INCOMPLETE_OR_UNVERIFIED_DATA", "orders_sent": 0,
                "note": "Need at least one 390-bar eligible regular session"}
    from trading.daytrade_engine import load_day_policy, new_state, run_cycle
    from trading.paper_engine import load_policy
    day = load_day_policy()
    risk = load_policy()
    positions = new_state(float(risk["starting_equity"]), str(snapshot["session_id"]))
    events = []
    for end_index in range(30, 391):
        window = []
        for item in eligible:
            window.append({**item, "bars": item["bars"][:end_index]})
        result = run_cycle({"paper_only": True, "session_id": snapshot["session_id"],
                            "session_complete": end_index == 390, "symbols": window},
                           positions, day, risk)
        positions = result["state"]
        events.extend(result["events"])
    if positions["open_positions"]:
        raise ConfluenceError("Replay did not flatten paper positions at close")
    return {
        "status": "ILLUSTRATIVE_PAPER_REPLAY_ONLY", "orders_sent": 0,
        "symbols_tested": [s["symbol"] for s in eligible],
        "entry_events": sum(e.get("type") == "ENTRY" for e in events),
        "exit_events": sum(e.get("type") == "EXIT" for e in events),
        "simulated_realized_pnl": round(float(positions["realized_pnl"]), 2),
        "illustrative_not_lean_grade": True,
        "limitations": ["This simulates bar-close entries and simple fills.",
                        "IEX-only price/volume, not full-market executions.",
                        "Results do not include complete transaction cost/market-impact modeling."],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("snapshot", type=Path, help="local JSON from approved market feed")
    parser.add_argument("--historical", action="store_true")
    parser.add_argument("--paper-replay", action="store_true",
                        help="simulate with existing paper engine; no broker API")
    parser.add_argument("--output", type=Path, help="optional local report, not in public repo")
    args = parser.parse_args()
    payload = json.loads(args.snapshot.read_text(encoding="utf-8"))
    result = research_pipeline(payload, historical=args.historical, paper_replay=args.paper_replay)
    body = json.dumps(result, indent=2, sort_keys=True)
    if args.output:
        args.output.write_text(body, encoding="utf-8")
    print(body)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
