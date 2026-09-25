#!/usr/bin/env python3
"""Persistent, deterministic Casper-Bojan paper-trading daemon.

Public market data only. This file has no authenticated exchange client and no
live order path. Signals use the same V2 sweep-then-structure logic as the
historical backtest, while JSON state makes repeated runs idempotent.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import math
import os
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parent
DEFAULT_CONFIG = ROOT / "config.json"
DEFAULT_STATE = ROOT / "state" / "paper-state.json"
DEFAULT_EVENTS = ROOT / "state" / "events.jsonl"
LIVE_EXECUTION_ENABLED = False
INTERVAL_MS = 300_000


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso(value) -> str:
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat()
    return str(value)


def load_json(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text())


def save_json_atomic(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")
    temp.replace(path)


def new_state(starting_equity: float = 10_000.0) -> dict:
    return {
        "schema_version": 1,
        "equity": float(starting_equity),
        "day": None,
        "day_start_equity": float(starting_equity),
        "realized_pnl_today": 0.0,
        "trades_today": 0,
        "open_positions": {},
        "last_signal_ts": {},
        "updated_at": None,
    }


def roll_utc_day(state: dict, now: datetime) -> None:
    day = now.astimezone(timezone.utc).date().isoformat()
    if state.get("day") != day:
        state["day"] = day
        state["day_start_equity"] = float(state["equity"])
        state["realized_pnl_today"] = 0.0
        state["trades_today"] = 0


def can_open(state: dict, cfg: dict) -> bool:
    if state["trades_today"] >= int(cfg["max_trades_per_day"]):
        return False
    start = float(state["day_start_equity"])
    loss_pct = max(0.0, -float(state["realized_pnl_today"]) / start * 100.0)
    if loss_pct >= float(cfg["max_daily_loss_pct"]):
        return False
    open_risk = sum(float(p["risk_dollars"]) for p in state["open_positions"].values())
    cap = float(state["equity"]) * float(cfg.get("max_total_open_risk_pct", 0.5)) / 100.0
    return open_risk < cap - 1e-9


def open_paper_position(symbol: str, candidate: dict, current_open: float, state: dict, cfg: dict) -> dict:
    side = int(candidate["side"])
    slip = float(cfg.get("slippage_bps", 3.0)) / 10_000.0
    entry = float(current_open) * (1.0 + slip if side == 1 else 1.0 - slip)
    stop = float(candidate["stop"])
    distance = entry - stop if side == 1 else stop - entry
    if not math.isfinite(distance) or distance <= 0:
        raise ValueError("invalid stop distance")
    risk_dollars = float(state["equity"]) * float(cfg["risk_per_trade_pct"]) / 100.0
    target = entry + side * float(cfg["min_reward_risk"]) * distance
    return {
        "symbol": symbol,
        "side": side,
        "side_name": "LONG" if side == 1 else "SHORT",
        "entry": entry,
        "stop": stop,
        "target": target,
        "qty": risk_dollars / distance,
        "risk_dollars": risk_dollars,
        "score": int(candidate["score"]),
        "signal_ts": candidate["signal_ts"],
        "entry_bar_ts": candidate["entry_bar_ts"],
        "last_exit_check_ts": candidate["entry_bar_ts"],
    }


def settle_position(position: dict, bars: pd.DataFrame, fee_bps: float, slippage_bps: float):
    """Return (closed-event, last-checked-ts); stop wins same-bar collisions."""
    side = int(position["side"])
    stop, target = float(position["stop"]), float(position["target"])
    last_checked = position["last_exit_check_ts"]
    for ts, bar in bars.iterrows():
        if iso(ts) <= last_checked:
            continue
        last_checked = iso(ts)
        stop_hit = float(bar.low) <= stop if side == 1 else float(bar.high) >= stop
        target_hit = float(bar.high) >= target if side == 1 else float(bar.low) <= target
        if not (stop_hit or target_hit):
            continue
        reason = "stop" if stop_hit else "target"
        raw_exit = stop if stop_hit else target
        slip = slippage_bps / 10_000.0
        exit_price = raw_exit * (1.0 - slip if side == 1 else 1.0 + slip)
        qty = float(position["qty"])
        gross = (exit_price - float(position["entry"])) * qty * side
        fees = fee_bps / 10_000.0 * qty * (float(position["entry"]) + exit_price)
        pnl = gross - fees
        return ({
            "type": "paper_exit",
            "symbol": position["symbol"],
            "side": position["side_name"],
            "entry": position["entry"],
            "exit": exit_price,
            "stop": stop,
            "target": target,
            "qty": qty,
            "reason": reason,
            "pnl": pnl,
            "net_r": pnl / float(position["risk_dollars"]),
            "signal_ts": position["signal_ts"],
            "exit_bar_ts": iso(ts),
        }, last_checked)
    return None, last_checked


def emit(event: dict, event_path: Path, webhook_url: str | None = None) -> None:
    enriched = {"emitted_at": iso(utc_now()), **event}
    event_path.parent.mkdir(parents=True, exist_ok=True)
    with event_path.open("a") as handle:
        handle.write(json.dumps(enriched, sort_keys=True) + "\n")
    print(json.dumps(enriched, sort_keys=True), flush=True)
    if webhook_url:
        body = json.dumps(enriched).encode()
        request = urllib.request.Request(
            webhook_url, data=body, method="POST", headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(request, timeout=15) as response:
            if response.status >= 300:
                raise RuntimeError(f"webhook returned HTTP {response.status}")


def fetch_recent(symbol: str, url: str, limit: int = 1000) -> pd.DataFrame:
    query = urllib.parse.urlencode({"symbol": symbol, "interval": "5m", "limit": limit})
    request = urllib.request.Request(
        f"{url}?{query}", headers={"User-Agent": "Nicholas-AI-OS-paper-daemon/1.0"}
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        payload = json.loads(response.read().decode())
    if not isinstance(payload, list) or len(payload) < 100:
        raise RuntimeError(f"invalid kline response for {symbol}")
    rows = [
        (pd.to_datetime(int(r[0]), unit="ms", utc=True), *map(float, r[1:6]))
        for r in payload
    ]
    frame = pd.DataFrame(
        rows, columns=["timestamp", "open", "high", "low", "close", "volume"]
    ).set_index("timestamp")
    if frame.index.has_duplicates or not frame.index.is_monotonic_increasing:
        raise RuntimeError(f"unordered or duplicate bars for {symbol}")
    return frame


def load_backtest_module():
    path = ROOT / "backtest.py"
    spec = importlib.util.spec_from_file_location("casper_bojan_backtest", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def latest_v2_candidate(backtest, closed: pd.DataFrame):
    featured = backtest.features(closed)
    if len(featured) < 70:
        return None
    sentinel = featured.tail(1).copy()
    sentinel.index = sentinel.index + pd.Timedelta(minutes=5)
    probe = pd.concat([featured, sentinel])
    wanted = len(featured) - 1
    matches = [signal for signal in backtest.candidates(probe, "v2") if signal["i"] == wanted]
    if not matches:
        return None
    signal = dict(matches[-1])
    signal["signal_ts"] = iso(featured.index[-1])
    return signal


def run_cycle(cfg: dict, state_path: Path, event_path: Path, now: datetime | None = None) -> dict:
    if cfg.get("live_trading_enabled") is not False or LIVE_EXECUTION_ENABLED:
        raise RuntimeError("paper-only safety boundary violated")
    now = now or utc_now()
    state = load_json(state_path, new_state(float(cfg.get("starting_equity", 10_000.0))))
    roll_utc_day(state, now)
    backtest = load_backtest_module()
    webhook = os.environ.get("PAPER_ALERT_WEBHOOK_URL")

    for symbol in cfg["symbols"]:
        frame = fetch_recent(symbol, cfg["market_data_url"])
        close_cutoff = pd.Timestamp(now).floor("5min")
        closed = frame[frame.index < close_cutoff]
        current = frame[frame.index >= close_cutoff]
        if closed.empty:
            continue

        position = state["open_positions"].get(symbol)
        if position:
            event, checked = settle_position(
                position,
                closed,
                float(cfg.get("fee_bps", 10.0)),
                float(cfg.get("slippage_bps", 3.0)),
            )
            position["last_exit_check_ts"] = checked
            if event:
                state["equity"] += event["pnl"]
                state["realized_pnl_today"] += event["pnl"]
                del state["open_positions"][symbol]
                emit({**event, "equity": state["equity"]}, event_path, webhook)

        if symbol in state["open_positions"] or not can_open(state, cfg):
            continue
        signal = latest_v2_candidate(backtest, closed)
        if not signal or state["last_signal_ts"].get(symbol) == signal["signal_ts"]:
            continue
        if current.empty:
            continue  # preserve next-bar entry; never substitute a stale close
        signal["entry_bar_ts"] = iso(current.index[0])
        position = open_paper_position(symbol, signal, float(current.iloc[0].open), state, cfg)
        state["open_positions"][symbol] = position
        state["last_signal_ts"][symbol] = signal["signal_ts"]
        state["trades_today"] += 1
        emit({"type": "paper_entry", **position, "equity": state["equity"]}, event_path, webhook)

    state["updated_at"] = iso(now)
    save_json_atomic(state_path, state)
    return state


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--state", type=Path, default=DEFAULT_STATE)
    parser.add_argument("--events", type=Path, default=DEFAULT_EVENTS)
    parser.add_argument("--loop-seconds", type=int, default=0)
    args = parser.parse_args()
    cfg = load_json(args.config, {})
    while True:
        try:
            run_cycle(cfg, args.state, args.events)
        except Exception as exc:
            emit({"type": "daemon_error", "error": str(exc)}, args.events)
            if not args.loop_seconds:
                raise
        if not args.loop_seconds:
            break
        time.sleep(max(30, args.loop_seconds))


if __name__ == "__main__":
    main()
