#!/usr/bin/env python3
"""Deterministic, paper-only intraday trading engine.

The engine consumes repository-controlled minute bars, manages simulated
positions, and can open new simulated positions only after the existing
paper_engine risk gate approves them. It has no broker imports or network code.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from trading.paper_engine import RiskRejected, evaluate_setup

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DAY_POLICY = ROOT / "trading" / "daytrade_policy.json"


class DayTradeRejected(ValueError):
    """Raised when an intraday snapshot or policy violates paper-only controls."""


@dataclass(frozen=True)
class Candidate:
    symbol: str
    side: str
    timestamp: str
    entry: float
    stop: float
    target: float
    relative_volume: float
    vwap: float
    opening_range_high: float
    opening_range_low: float
    score: float

    def setup(self) -> dict[str, Any]:
        return {
            "symbol": self.symbol,
            "asset_class": "stock",
            "side": self.side,
            "entry": self.entry,
            "stop": self.stop,
            "target": self.target,
            "execution": "paper",
            "average_down": False,
        }

    def as_dict(self) -> dict[str, Any]:
        return {
            **self.setup(),
            "timestamp": self.timestamp,
            "relative_volume": round(self.relative_volume, 3),
            "vwap": round(self.vwap, 4),
            "opening_range_high": round(self.opening_range_high, 4),
            "opening_range_low": round(self.opening_range_low, 4),
            "score": round(self.score, 2),
        }


def load_day_policy(path: Path = DEFAULT_DAY_POLICY) -> dict[str, Any]:
    policy = json.loads(path.read_text(encoding="utf-8"))
    if policy.get("mode") != "paper_only":
        raise DayTradeRejected("Day-trade policy must remain paper_only")
    if policy.get("live_execution_enabled") is not False:
        raise DayTradeRejected("live_execution_enabled must remain false")
    if policy.get("live_broker_adapters"):
        raise DayTradeRejected("Paper day trader must not configure broker adapters")
    if policy.get("asset_class") != "stock":
        raise DayTradeRejected("Phase 1 day trader is stock-only")
    return policy


def _finite(value: Any, name: str, *, positive: bool = False) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise DayTradeRejected(f"{name} must be numeric") from exc
    if not math.isfinite(number):
        raise DayTradeRejected(f"{name} must be finite")
    if positive and number <= 0:
        raise DayTradeRejected(f"{name} must be positive")
    return number


def _validate_bar(raw: dict[str, Any]) -> dict[str, Any]:
    ts = str(raw.get("timestamp") or "").strip()
    if not ts:
        raise DayTradeRejected("Every bar requires timestamp")
    bar = {
        "timestamp": ts,
        "open": _finite(raw.get("open"), "open", positive=True),
        "high": _finite(raw.get("high"), "high", positive=True),
        "low": _finite(raw.get("low"), "low", positive=True),
        "close": _finite(raw.get("close"), "close", positive=True),
        "volume": _finite(raw.get("volume"), "volume", positive=True),
    }
    if bar["high"] < max(bar["open"], bar["close"], bar["low"]):
        raise DayTradeRejected(f"Invalid OHLC high at {ts}")
    if bar["low"] > min(bar["open"], bar["close"], bar["high"]):
        raise DayTradeRejected(f"Invalid OHLC low at {ts}")
    return bar


def validate_symbol_payload(payload: dict[str, Any]) -> tuple[str, list[dict[str, Any]], float]:
    symbol = str(payload.get("symbol") or "").strip().upper()
    if not symbol or len(symbol) > 12:
        raise DayTradeRejected("Valid stock symbol required")
    raw_bars = payload.get("bars")
    if not isinstance(raw_bars, list) or not raw_bars:
        raise DayTradeRejected(f"{symbol}: bars must be a non-empty list")
    bars = [_validate_bar(bar) for bar in raw_bars]
    if len({bar["timestamp"] for bar in bars}) != len(bars):
        raise DayTradeRejected(f"{symbol}: duplicate bar timestamp")
    spread_bps = _finite(payload.get("spread_bps", 0.0), "spread_bps")
    if spread_bps < 0:
        raise DayTradeRejected("spread_bps cannot be negative")
    return symbol, bars, spread_bps


def _vwap(bars: list[dict[str, Any]]) -> float:
    dollar_volume = 0.0
    volume = 0.0
    for bar in bars:
        typical = (bar["high"] + bar["low"] + bar["close"]) / 3.0
        dollar_volume += typical * bar["volume"]
        volume += bar["volume"]
    if volume <= 0:
        raise DayTradeRejected("VWAP volume must be positive")
    return dollar_volume / volume


def generate_candidate(payload: dict[str, Any], policy: dict[str, Any]) -> Candidate | None:
    symbol, bars, spread_bps = validate_symbol_payload(payload)
    minimum_bars = int(policy["minimum_bars"])
    opening_n = int(policy["opening_range_minutes"])
    if len(bars) < max(minimum_bars, opening_n + 1):
        return None
    if len(bars) - 1 > int(policy["entry_cutoff_minutes_after_open"]):
        return None
    if spread_bps > float(policy["max_spread_bps"]):
        return None

    latest = bars[-1]
    price = latest["close"]
    if not float(policy["min_price"]) <= price <= float(policy["max_price"]):
        return None

    opening = bars[:opening_n]
    or_high = max(bar["high"] for bar in opening)
    or_low = min(bar["low"] for bar in opening)
    or_mid = (or_high + or_low) / 2.0
    or_pct = (or_high - or_low) / or_mid * 100.0
    if not float(policy["min_opening_range_pct"]) <= or_pct <= float(policy["max_opening_range_pct"]):
        return None

    prior = bars[max(opening_n, len(bars) - 11):-1]
    if not prior:
        return None
    average_volume = sum(bar["volume"] for bar in prior) / len(prior)
    relative_volume = latest["volume"] / average_volume
    if relative_volume < float(policy["min_relative_volume"]):
        return None

    vwap = _vwap(bars)
    buffer = float(policy["min_breakout_buffer_bps"]) / 10000.0
    slippage = float(policy["slippage_bps"]) / 10000.0
    rr = float(policy["min_reward_to_risk"])
    opening_range = or_high - or_low

    if latest["close"] > or_high * (1.0 + buffer) and latest["close"] > vwap:
        side = "long"
        entry = latest["close"] * (1.0 + slippage)
        stop = or_high - opening_range * 0.25
        if not stop < entry:
            return None
        target = entry + (entry - stop) * rr
        breakout_bps = (latest["close"] / or_high - 1.0) * 10000.0
    elif latest["close"] < or_low * (1.0 - buffer) and latest["close"] < vwap:
        side = "short"
        entry = latest["close"] * (1.0 - slippage)
        stop = or_low + opening_range * 0.25
        if not entry < stop:
            return None
        target = entry - (stop - entry) * rr
        if target <= 0:
            return None
        breakout_bps = (1.0 - latest["close"] / or_low) * 10000.0
    else:
        return None

    vwap_distance_bps = abs(latest["close"] / vwap - 1.0) * 10000.0
    score = (
        50.0
        + min(25.0, max(0.0, relative_volume - 1.0) * 20.0)
        + min(15.0, vwap_distance_bps / 10.0)
        + min(10.0, max(0.0, breakout_bps) / 5.0)
    )
    return Candidate(
        symbol=symbol,
        side=side,
        timestamp=latest["timestamp"],
        entry=entry,
        stop=stop,
        target=target,
        relative_volume=relative_volume,
        vwap=vwap,
        opening_range_high=or_high,
        opening_range_low=or_low,
        score=score,
    )


def _account_from_state(state: dict[str, Any]) -> dict[str, Any]:
    equity = _finite(state.get("equity"), "state.equity", positive=True)
    positions = state.get("open_positions") or {}
    if not isinstance(positions, dict):
        raise DayTradeRejected("open_positions must be an object")
    open_risk = sum(float(pos.get("risk_dollars", 0.0)) for pos in positions.values())
    return {
        "equity": equity,
        "realized_pnl": float(state.get("realized_pnl", 0.0)),
        "open_risk_pct": (open_risk / equity) * 100.0,
        "open_positions": len(positions),
        "trades_today": int(state.get("trades_today", 0)),
    }


def new_state(starting_equity: float, session_id: str) -> dict[str, Any]:
    equity = _finite(starting_equity, "starting_equity", positive=True)
    return {
        "mode": "paper_only",
        "live_execution_enabled": False,
        "session_id": str(session_id),
        "starting_equity": equity,
        "equity": equity,
        "realized_pnl": 0.0,
        "trades_today": 0,
        "open_positions": {},
        "last_processed_ts": {},
        "events": [],
    }


def _exit_position(
    state: dict[str, Any],
    symbol: str,
    position: dict[str, Any],
    exit_price: float,
    timestamp: str,
    reason: str,
) -> dict[str, Any]:
    qty = int(position["quantity"])
    entry = float(position["entry"])
    if position["side"] == "long":
        pnl = (exit_price - entry) * qty
    else:
        pnl = (entry - exit_price) * qty
    state["realized_pnl"] = round(float(state.get("realized_pnl", 0.0)) + pnl, 6)
    state["equity"] = round(float(state["starting_equity"]) + state["realized_pnl"], 6)
    state["open_positions"].pop(symbol, None)
    event = {
        "type": "EXIT",
        "symbol": symbol,
        "side": position["side"],
        "quantity": qty,
        "entry": entry,
        "exit": round(exit_price, 6),
        "pnl": round(pnl, 2),
        "timestamp": timestamp,
        "reason": reason,
        "paper_only": True,
    }
    state["events"].append(event)
    return event


def manage_position(
    state: dict[str, Any],
    symbol_payload: dict[str, Any],
    policy: dict[str, Any],
    *,
    session_complete: bool = False,
) -> dict[str, Any] | None:
    symbol, bars, _ = validate_symbol_payload(symbol_payload)
    position = (state.get("open_positions") or {}).get(symbol)
    if not position:
        return None
    latest = bars[-1]
    low, high = latest["low"], latest["high"]
    stop, target = float(position["stop"]), float(position["target"])
    side = position["side"]

    if side == "long":
        stop_hit = low <= stop
        target_hit = high >= target
    else:
        stop_hit = high >= stop
        target_hit = low <= target

    if stop_hit and target_hit:
        if policy.get("conservative_same_bar_exit", True):
            return _exit_position(state, symbol, position, stop, latest["timestamp"], "STOP_SAME_BAR")
        return _exit_position(state, symbol, position, target, latest["timestamp"], "TARGET_SAME_BAR")
    if stop_hit:
        return _exit_position(state, symbol, position, stop, latest["timestamp"], "STOP")
    if target_hit:
        return _exit_position(state, symbol, position, target, latest["timestamp"], "TARGET")
    if session_complete and policy.get("require_flat_by_session_end", True):
        return _exit_position(
            state, symbol, position, latest["close"], latest["timestamp"], "SESSION_END"
        )
    return None


def run_cycle(
    snapshot: dict[str, Any],
    state: dict[str, Any],
    day_policy: dict[str, Any],
    risk_policy: dict[str, Any],
) -> dict[str, Any]:
    if snapshot.get("paper_only") is not True:
        raise DayTradeRejected("Snapshot must explicitly set paper_only=true")
    if state.get("mode") != "paper_only" or state.get("live_execution_enabled") is not False:
        raise DayTradeRejected("State must remain paper-only")
    session_id = str(snapshot.get("session_id") or "").strip()
    if not session_id:
        raise DayTradeRejected("snapshot.session_id is required")
    if str(state.get("session_id")) != session_id:
        if state.get("open_positions"):
            raise DayTradeRejected("Cannot roll session while paper positions are still open")
        state = new_state(float(state.get("equity", risk_policy["starting_equity"])), session_id)

    symbols = snapshot.get("symbols")
    if not isinstance(symbols, list) or not symbols:
        raise DayTradeRejected("snapshot.symbols must be a non-empty list")
    session_complete = bool(snapshot.get("session_complete", False))
    state["events"] = []

    for payload in symbols:
        symbol, _, _ = validate_symbol_payload(payload)
        if symbol in state.get("open_positions", {}):
            manage_position(state, payload, day_policy, session_complete=session_complete)

    if session_complete:
        return {"state": state, "candidates": [], "decisions": [], "events": state["events"]}

    candidates: list[Candidate] = []
    for payload in symbols:
        symbol, bars, _ = validate_symbol_payload(payload)
        latest_ts = bars[-1]["timestamp"]
        if state.get("last_processed_ts", {}).get(symbol) == latest_ts:
            continue
        state.setdefault("last_processed_ts", {})[symbol] = latest_ts
        if symbol in state.get("open_positions", {}):
            continue
        candidate = generate_candidate(payload, day_policy)
        if candidate:
            candidates.append(candidate)

    candidates.sort(key=lambda item: item.score, reverse=True)
    candidates = candidates[: int(day_policy["max_candidates_per_cycle"])]
    decisions: list[dict[str, Any]] = []

    for candidate in candidates:
        account = _account_from_state(state)
        try:
            decision = evaluate_setup(candidate.setup(), account, risk_policy)
        except RiskRejected as exc:
            decisions.append({
                "candidate": candidate.as_dict(),
                "status": "RISK_REJECTED",
                "reason": str(exc),
            })
            continue

        position = {
            "symbol": candidate.symbol,
            "side": candidate.side,
            "quantity": decision.quantity,
            "entry": decision.entry,
            "stop": decision.stop,
            "target": decision.target,
            "risk_dollars": decision.risk_dollars,
            "opened_at": candidate.timestamp,
            "score": round(candidate.score, 2),
            "paper_only": True,
        }
        state["open_positions"][candidate.symbol] = position
        state["trades_today"] = int(state.get("trades_today", 0)) + 1
        event = {
            "type": "ENTRY",
            **position,
            "timestamp": candidate.timestamp,
            "paper_only": True,
        }
        state["events"].append(event)
        decisions.append({
            "candidate": candidate.as_dict(),
            "status": "PAPER_FILLED",
            "decision": decision.as_dict(),
        })

        if len(state["open_positions"]) >= int(risk_policy["max_positions"]):
            break

    return {
        "state": state,
        "candidates": [candidate.as_dict() for candidate in candidates],
        "decisions": decisions,
        "events": state["events"],
        "live_execution_enabled": False,
    }
