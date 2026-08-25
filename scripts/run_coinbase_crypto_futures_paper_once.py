#!/usr/bin/env python3
"""Run one autonomous Coinbase US crypto-futures PAPER cycle.

Market data is fetched only from Coinbase public Advanced Trade endpoints.
No API key is read. No authenticated endpoint is called. No order can be sent.
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from trading.coinbase_crypto_futures_paper import (  # noqa: E402
    FuturesPaperRejected,
    discover_products,
    load_policy,
    market_signal,
    size_paper_trade,
)

API_ROOT = "https://api.coinbase.com/api/v3/brokerage/market"
RUNTIME = Path(os.environ.get("COINBASE_FUTURES_PAPER_RUNTIME", Path.home() / ".nicholas-ai-os" / "coinbase-futures-paper"))
STATE_PATH = RUNTIME / "state.json"
STATUS_PATH = RUNTIME / "status.json"
REPORT_PATH = RUNTIME / "last_report.json"


def _get_json(url: str, timeout: int = 12) -> dict[str, Any]:
    req = urllib.request.Request(
        url,
        method="GET",
        headers={
            "Accept": "application/json",
            "Cache-Control": "no-cache",
            "User-Agent": "Nicholas-AI-OS-Coinbase-Futures-Paper/1.0",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:  # nosec B310 - fixed HTTPS Coinbase host only
        if response.status != 200:
            raise RuntimeError(f"Coinbase public market-data HTTP {response.status}")
        payload = json.loads(response.read().decode("utf-8"))
    if not isinstance(payload, dict):
        raise RuntimeError("Coinbase market-data response was not an object")
    return payload


def _public_products() -> list[dict[str, Any]]:
    query = urllib.parse.urlencode({
        "product_type": "FUTURE",
        "contract_expiry_type": "PERPETUAL",
        "futures_underlying_type": "FUTURES_UNDERLYING_TYPE_SPOT",
        "user_country_code": "US",
        "limit": "100",
    })
    payload = _get_json(f"{API_ROOT}/products?{query}")
    products = payload.get("products") or []
    return [item for item in products if isinstance(item, dict)]


def _candles(product_id: str, granularity: str, lookback_bars: int) -> list[dict[str, Any]]:
    seconds_per_bar = {
        "ONE_MINUTE": 60,
        "FIVE_MINUTE": 300,
        "FIFTEEN_MINUTE": 900,
        "THIRTY_MINUTE": 1800,
        "ONE_HOUR": 3600,
    }.get(granularity)
    if not seconds_per_bar:
        raise RuntimeError(f"Unsupported granularity: {granularity}")
    end = int(time.time())
    start = end - seconds_per_bar * max(lookback_bars + 8, 80)
    query = urllib.parse.urlencode({
        "start": str(start),
        "end": str(end),
        "granularity": granularity,
        "limit": str(min(350, max(lookback_bars + 8, 80))),
    })
    encoded = urllib.parse.quote(product_id, safe="")
    payload = _get_json(f"{API_ROOT}/products/{encoded}/candles?{query}")
    candles = payload.get("candles") or []
    return [item for item in candles if isinstance(item, dict)]


def _ticker(product_id: str) -> dict[str, Any]:
    encoded = urllib.parse.quote(product_id, safe="")
    query = urllib.parse.urlencode({"limit": "20"})
    return _get_json(f"{API_ROOT}/products/{encoded}/ticker?{query}")


def _new_state(starting_equity: float) -> dict[str, Any]:
    return {
        "paper_only": True,
        "live_execution_enabled": False,
        "equity": float(starting_equity),
        "day_realized_pnl": 0.0,
        "lifetime_realized_pnl": 0.0,
        "utc_day": datetime.now(timezone.utc).date().isoformat(),
        "trades_today": 0,
        "open_positions": {},
        "closed_trades": [],
        "last_entry_bar": {},
    }


def _load_state(starting_equity: float) -> dict[str, Any]:
    if not STATE_PATH.exists():
        return _new_state(starting_equity)
    try:
        state = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except Exception:
        state = _new_state(starting_equity)
    if state.get("paper_only") is not True or state.get("live_execution_enabled") is not False:
        raise RuntimeError("Stored futures state failed paper-only safety check")
    today = datetime.now(timezone.utc).date().isoformat()
    if state.get("utc_day") != today:
        state["utc_day"] = today
        state["day_realized_pnl"] = 0.0
        state["trades_today"] = 0
    state.setdefault("open_positions", {})
    state.setdefault("closed_trades", [])
    state.setdefault("last_entry_bar", {})
    return state


def _open_risk_pct(state: dict[str, Any]) -> float:
    equity = max(float(state.get("equity", 0.0)), 1e-9)
    risk = sum(float(position.get("risk_dollars", 0.0)) for position in state.get("open_positions", {}).values())
    return risk / equity * 100.0


def _exit_position(state: dict[str, Any], product_id: str, exit_price: float, reason: str, bar_start: float) -> dict[str, Any]:
    position = state["open_positions"].pop(product_id)
    entry = float(position["entry"])
    contract_size = float(position["contract_size"])
    contracts = int(position["contracts"])
    side = position["side"]
    if side == "long":
        pnl = (exit_price - entry) * contract_size * contracts
    else:
        pnl = (entry - exit_price) * contract_size * contracts
    state["equity"] = float(state["equity"]) + pnl
    state["day_realized_pnl"] = float(state.get("day_realized_pnl", 0.0)) + pnl
    state["lifetime_realized_pnl"] = float(state.get("lifetime_realized_pnl", 0.0)) + pnl
    record = {
        **position,
        "exit_price": exit_price,
        "exit_reason": reason,
        "exit_bar_start": bar_start,
        "realized_pnl": round(pnl, 2),
        "closed_at": datetime.now(timezone.utc).isoformat(),
    }
    state["closed_trades"].append(record)
    state["closed_trades"] = state["closed_trades"][-500:]
    return record


def _manage_position(state: dict[str, Any], product_id: str, candles: list[dict[str, Any]]) -> dict[str, Any] | None:
    position = state.get("open_positions", {}).get(product_id)
    if not position or not candles:
        return None
    rows = []
    for item in candles:
        try:
            rows.append((float(item["start"]), float(item["high"]), float(item["low"])))
        except (KeyError, TypeError, ValueError):
            continue
    if not rows:
        return None
    bar_start, high, low = max(rows, key=lambda row: row[0])
    stop = float(position["stop"])
    target = float(position["target"])
    side = position["side"]
    # Conservative: if a five-minute candle touches both, record the stop first.
    if side == "long":
        if low <= stop:
            return _exit_position(state, product_id, stop, "stop", bar_start)
        if high >= target:
            return _exit_position(state, product_id, target, "target", bar_start)
    else:
        if high >= stop:
            return _exit_position(state, product_id, stop, "stop", bar_start)
        if low <= target:
            return _exit_position(state, product_id, target, "target", bar_start)
    return None


def run_once() -> dict[str, Any]:
    policy = load_policy()
    RUNTIME.mkdir(parents=True, exist_ok=True)
    state = _load_state(float(policy["starting_equity"]))
    events: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []

    products = discover_products(_public_products(), policy)
    # Keep one preferred contract per underlying so the paper bot cannot stack
    # multiple BTC or ETH futures variants accidentally.
    selected: dict[str, dict[str, Any]] = {}
    for product in products:
        underlying = str(product.get("base_display_symbol") or product.get("base_currency_id") or "").upper()
        if underlying and underlying not in selected:
            selected[underlying] = product

    for underlying, product in selected.items():
        product_id = str(product.get("product_id") or "")
        if not product_id:
            continue
        try:
            bars = _candles(product_id, str(policy["granularity"]), int(policy["lookback_bars"]))
            tick = _ticker(product_id)
            product["best_bid_price"] = tick.get("best_bid") or product.get("best_bid_price")
            product["best_ask_price"] = tick.get("best_ask") or product.get("best_ask_price")

            exited = _manage_position(state, product_id, bars)
            if exited:
                events.append({"type": "paper_exit", "product_id": product_id, "detail": exited})

            if product_id in state["open_positions"]:
                continue

            signal = market_signal(product, bars, policy)
            if not signal:
                continue
            bar_start = str(signal["bar_start"])
            if str(state["last_entry_bar"].get(product_id, "")) == bar_start:
                continue

            account = {
                "equity": state["equity"],
                "realized_pnl": state["day_realized_pnl"],
                "open_risk_pct": _open_risk_pct(state),
                "open_positions": len(state["open_positions"]),
                "trades_today": state["trades_today"],
            }
            decision = size_paper_trade(product, signal, account, policy).as_dict()
            decision["opened_at"] = datetime.now(timezone.utc).isoformat()
            decision["entry_bar_start"] = signal["bar_start"]
            decision["signal"] = {
                "ema_fast": signal["ema_fast"],
                "ema_slow": signal["ema_slow"],
                "atr": signal["atr"],
                "spread_bps": signal["spread_bps"],
            }
            state["open_positions"][product_id] = decision
            state["last_entry_bar"][product_id] = bar_start
            state["trades_today"] = int(state["trades_today"]) + 1
            events.append({"type": "paper_entry", "product_id": product_id, "detail": decision})
        except (FuturesPaperRejected, RuntimeError, OSError, ValueError) as exc:
            errors.append({"product_id": product_id, "error": str(exc)})

    state["paper_only"] = True
    state["live_execution_enabled"] = False
    state["last_cycle_at"] = datetime.now(timezone.utc).isoformat()
    STATE_PATH.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    report = {
        "paper_only": True,
        "live_execution_enabled": False,
        "venue": "coinbase",
        "jurisdiction": "US",
        "product_type": "FUTURE",
        "strategy": "crypto_perpetual_breakout_ema_atr_v1",
        "checked_at": state["last_cycle_at"],
        "selected_products": {key: value.get("product_id") for key, value in selected.items()},
        "events": events,
        "errors": errors,
        "equity": round(float(state["equity"]), 2),
        "day_realized_pnl": round(float(state["day_realized_pnl"]), 2),
        "lifetime_realized_pnl": round(float(state["lifetime_realized_pnl"]), 2),
        "open_positions": len(state["open_positions"]),
        "trades_today": state["trades_today"],
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    STATUS_PATH.write_text(json.dumps({
        "component": "Coinbase Crypto Futures Paper Feed",
        "state": "healthy" if selected and not errors else ("degraded" if selected else "no_eligible_products"),
        "checked_at": state["last_cycle_at"],
        "paper_only": True,
        "live_execution_enabled": False,
        "public_market_data_only": True,
        "selected_products": report["selected_products"],
        "open_positions": report["open_positions"],
        "equity": report["equity"],
        "day_realized_pnl": report["day_realized_pnl"],
    }, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return report


def main() -> int:
    try:
        report = run_once()
        print(json.dumps(report, indent=2, sort_keys=True))
        return 0 if report["selected_products"] else 2
    except Exception as exc:
        RUNTIME.mkdir(parents=True, exist_ok=True)
        STATUS_PATH.write_text(json.dumps({
            "component": "Coinbase Crypto Futures Paper Feed",
            "state": "failed",
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "paper_only": True,
            "live_execution_enabled": False,
            "error": str(exc),
        }, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
