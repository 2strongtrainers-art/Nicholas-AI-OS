#!/usr/bin/env python3
"""Multi-timeframe analysis and Hermes safety gate for Coinbase futures PAPER trading.

The deterministic engine owns signal construction and risk. Hermes may only accept,
reduce, or reject an already-valid paper setup. It can never create a trade, change
side, loosen a stop, or increase risk.
"""

from __future__ import annotations

import hashlib
import json
import math
from typing import Any, Iterable

from trading.coinbase_crypto_futures_paper import (
    FuturesPaperRejected,
    _atr,
    _ema,
    market_signal,
    normalize_candles,
)

TIMEFRAME_SECONDS: dict[str, int] = {
    "ONE_MINUTE": 60,
    "FIVE_MINUTE": 300,
    "FIFTEEN_MINUTE": 900,
    "THIRTY_MINUTE": 1800,
    "ONE_HOUR": 3600,
    "TWO_HOUR": 7200,
    "FOUR_HOUR": 14400,
    "SIX_HOUR": 21600,
    "ONE_DAY": 86400,
}

ALL_COINBASE_TIMEFRAMES = tuple(TIMEFRAME_SECONDS)


def _clip(value: float, low: float = -1.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def validate_mtf_policy(policy: dict[str, Any]) -> None:
    timeframes = policy.get("timeframes")
    if not isinstance(timeframes, dict):
        raise FuturesPaperRejected("timeframes policy must be an object")
    missing = [tf for tf in ALL_COINBASE_TIMEFRAMES if tf not in timeframes]
    if missing:
        raise FuturesPaperRejected(f"Multi-timeframe policy missing Coinbase intervals: {missing}")
    unknown = [tf for tf in timeframes if tf not in TIMEFRAME_SECONDS]
    if unknown:
        raise FuturesPaperRejected(f"Unsupported Coinbase intervals configured: {unknown}")

    total_weight = 0.0
    for timeframe, config in timeframes.items():
        if not isinstance(config, dict):
            raise FuturesPaperRejected(f"{timeframe} config must be an object")
        weight = float(config.get("weight", 0.0))
        lookback = int(config.get("lookback_bars", 0))
        if not math.isfinite(weight) or weight <= 0:
            raise FuturesPaperRejected(f"{timeframe} weight must be positive")
        if lookback < max(int(policy["ema_slow"]) + 2, int(policy["atr_period"]) + 2):
            raise FuturesPaperRejected(f"{timeframe} lookback is too short")
        total_weight += weight
    if abs(total_weight - 1.0) > 1e-6:
        raise FuturesPaperRejected(f"timeframe weights must sum to 1.0, got {total_weight}")

    execution = str(policy.get("execution_granularity") or "").upper()
    management = str(policy.get("position_management_granularity") or "").upper()
    if execution not in timeframes:
        raise FuturesPaperRejected("execution_granularity must be in timeframes")
    if management not in timeframes:
        raise FuturesPaperRejected("position_management_granularity must be in timeframes")

    supervisor = policy.get("hermes_supervisor")
    if not isinstance(supervisor, dict) or supervisor.get("enabled") is not True:
        raise FuturesPaperRejected("Hermes supervisor must remain enabled for MTF v2")
    if supervisor.get("fail_closed") is not True:
        raise FuturesPaperRejected("Hermes supervisor must fail closed")
    if supervisor.get("can_increase_risk") is not False:
        raise FuturesPaperRejected("Hermes cannot increase risk")
    if supervisor.get("can_create_trade") is not False:
        raise FuturesPaperRejected("Hermes cannot create trades")
    if float(supervisor.get("max_size_multiplier", 99)) > 1.0:
        raise FuturesPaperRejected("Hermes max size multiplier cannot exceed 1.0")


def analyze_timeframe(
    candles: Iterable[dict[str, Any]],
    granularity: str,
    policy: dict[str, Any],
) -> dict[str, Any] | None:
    granularity = granularity.upper()
    config = policy["timeframes"].get(granularity)
    if not isinstance(config, dict):
        return None

    rows = normalize_candles(candles)
    minimum = max(
        int(policy["ema_slow"]) + 2,
        int(policy["atr_period"]) + 2,
        int(policy["breakout_lookback"]) + 2,
    )
    if len(rows) < minimum:
        return None

    rows = rows[-int(config["lookback_bars"]):]
    if len(rows) < minimum:
        return None
    closes = [row["close"] for row in rows]
    fast = _ema(closes, int(policy["ema_fast"]))
    slow = _ema(closes, int(policy["ema_slow"]))
    prev_fast = _ema(closes[:-1], int(policy["ema_fast"]))
    atr = _atr(rows, int(policy["atr_period"]))
    if atr <= 0:
        return None

    current = rows[-1]
    breakout_n = int(policy["breakout_lookback"])
    prior = rows[-(breakout_n + 1):-1]
    breakout_high = max(row["high"] for row in prior)
    breakout_low = min(row["low"] for row in prior)
    breakout_component = 1.0 if current["close"] > breakout_high else (-1.0 if current["close"] < breakout_low else 0.0)

    trend_component = _clip((fast - slow) / atr)
    position_component = _clip((current["close"] - slow) / atr)
    slope_component = _clip((fast - prev_fast) / max(atr * 0.20, 1e-12))
    score = _clip(
        0.35 * trend_component
        + 0.25 * position_component
        + 0.15 * slope_component
        + 0.25 * breakout_component
    )

    direction = "bullish" if score >= 0.20 else ("bearish" if score <= -0.20 else "neutral")
    prior_volumes = [row["volume"] for row in prior if row["volume"] >= 0]
    average_volume = sum(prior_volumes) / len(prior_volumes) if prior_volumes else 0.0
    relative_volume = current["volume"] / average_volume if average_volume > 0 else None

    return {
        "granularity": granularity,
        "role": str(config.get("role") or ""),
        "weight": float(config["weight"]),
        "bar_start": current["start"],
        "close": current["close"],
        "ema_fast": fast,
        "ema_slow": slow,
        "atr": atr,
        "relative_volume": relative_volume,
        "breakout_high": breakout_high,
        "breakout_low": breakout_low,
        "trend_component": round(trend_component, 6),
        "position_component": round(position_component, 6),
        "slope_component": round(slope_component, 6),
        "breakout_component": breakout_component,
        "score": round(score, 6),
        "direction": direction,
        "strength": round(abs(score), 6),
    }


def build_mtf_view(
    candles_by_timeframe: dict[str, Iterable[dict[str, Any]]],
    policy: dict[str, Any],
) -> dict[str, Any]:
    validate_mtf_policy(policy)
    analyses: dict[str, dict[str, Any]] = {}
    for timeframe in ALL_COINBASE_TIMEFRAMES:
        analysis = analyze_timeframe(candles_by_timeframe.get(timeframe, []), timeframe, policy)
        if analysis:
            analyses[timeframe] = analysis

    available_weight = sum(item["weight"] for item in analyses.values())
    weighted_score = (
        sum(item["weight"] * item["score"] for item in analyses.values()) / available_weight
        if available_weight > 0 else 0.0
    )
    bullish_weight = sum(item["weight"] for item in analyses.values() if item["score"] >= 0.20)
    bearish_weight = sum(item["weight"] for item in analyses.values() if item["score"] <= -0.20)
    neutral_weight = max(0.0, available_weight - bullish_weight - bearish_weight)

    higher = {str(tf).upper() for tf in policy.get("higher_timeframes", [])}
    higher_items = [item for tf, item in analyses.items() if tf in higher]
    higher_weight = sum(item["weight"] for item in higher_items)
    higher_score = (
        sum(item["weight"] * item["score"] for item in higher_items) / higher_weight
        if higher_weight > 0 else 0.0
    )

    if weighted_score >= 0.18:
        regime = "bullish"
    elif weighted_score <= -0.18:
        regime = "bearish"
    elif max(bullish_weight, bearish_weight) >= 0.35:
        regime = "mixed"
    else:
        regime = "neutral"

    return {
        "timeframes": analyses,
        "available_timeframes": len(analyses),
        "required_timeframes": len(ALL_COINBASE_TIMEFRAMES),
        "available_weight": round(available_weight, 6),
        "weighted_score": round(weighted_score, 6),
        "higher_timeframe_score": round(higher_score, 6),
        "bullish_weight": round(bullish_weight, 6),
        "bearish_weight": round(bearish_weight, 6),
        "neutral_weight": round(neutral_weight, 6),
        "regime": regime,
    }


def _side_adjusted(score: float, side: str) -> float:
    return score if side == "long" else -score


def multi_timeframe_signal(
    product: dict[str, Any],
    candles_by_timeframe: dict[str, Iterable[dict[str, Any]]],
    policy: dict[str, Any],
) -> dict[str, Any] | None:
    """Return an execution signal only when primary breakout and MTF gates agree."""
    view = build_mtf_view(candles_by_timeframe, policy)
    if view["available_timeframes"] < int(policy["minimum_timeframes_available"]):
        return None

    execution = str(policy["execution_granularity"]).upper()
    primary = market_signal(product, candles_by_timeframe.get(execution, []), policy)
    if not primary:
        return None
    side = str(primary["side"])

    items = view["timeframes"]
    available_weight = max(float(view["available_weight"]), 1e-12)
    signed = {
        tf: _side_adjusted(float(item["score"]), side)
        for tf, item in items.items()
    }
    alignment = sum(items[tf]["weight"] * score for tf, score in signed.items()) / available_weight
    support_weight = sum(items[tf]["weight"] for tf, score in signed.items() if score >= 0.20) / available_weight
    opposition_weight = sum(items[tf]["weight"] for tf, score in signed.items() if score <= -0.20) / available_weight

    higher = {str(tf).upper() for tf in policy.get("higher_timeframes", [])}
    higher_pairs = [(tf, score) for tf, score in signed.items() if tf in higher]
    higher_weight = sum(items[tf]["weight"] for tf, _ in higher_pairs)
    higher_alignment = (
        sum(items[tf]["weight"] * score for tf, score in higher_pairs) / higher_weight
        if higher_weight > 0 else 0.0
    )

    timing = signed.get("ONE_MINUTE", 0.0)
    critical = [str(tf).upper() for tf in policy.get("critical_trend_timeframes", [])]
    critical_opposed = sum(1 for tf in critical if signed.get(tf, 0.0) <= -0.35)

    if alignment < float(policy["minimum_alignment_score"]):
        return None
    if support_weight < float(policy["minimum_support_weight"]):
        return None
    if opposition_weight > float(policy["maximum_opposition_weight"]):
        return None
    if higher_alignment < float(policy["minimum_higher_timeframe_alignment"]):
        return None
    if timing < float(policy["maximum_entry_timing_opposition"]):
        return None
    if critical and critical_opposed == len(critical):
        return None

    deterministic_confidence = 100.0 * (
        0.45 * support_weight
        + 0.35 * max(0.0, alignment)
        + 0.20 * max(0.0, higher_alignment)
    )
    if deterministic_confidence < float(policy["minimum_deterministic_confidence"]):
        return None

    result = dict(primary)
    result["multi_timeframe"] = {
        **view,
        "side": side,
        "alignment_score": round(alignment, 6),
        "support_weight": round(support_weight, 6),
        "opposition_weight": round(opposition_weight, 6),
        "higher_timeframe_alignment": round(higher_alignment, 6),
        "entry_timing_score": round(timing, 6),
        "critical_opposed_count": critical_opposed,
        "deterministic_confidence": round(deterministic_confidence, 2),
    }
    return result


def candidate_fingerprint(product_id: str, signal: dict[str, Any]) -> str:
    mtf = signal.get("multi_timeframe") or {}
    payload = {
        "product_id": product_id,
        "side": signal.get("side"),
        "bar_start": signal.get("bar_start"),
        "entry": round(float(signal.get("entry", 0.0)), 6),
        "stop": round(float(signal.get("stop", 0.0)), 6),
        "target": round(float(signal.get("target", 0.0)), 6),
        "alignment": round(float(mtf.get("alignment_score", 0.0)), 4),
        "higher_alignment": round(float(mtf.get("higher_timeframe_alignment", 0.0)), 4),
    }
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:20]


def validate_hermes_review(
    review: dict[str, Any],
    policy: dict[str, Any],
    expected_fingerprint: str,
) -> dict[str, Any]:
    supervisor = policy["hermes_supervisor"]
    if not isinstance(review, dict):
        raise FuturesPaperRejected("Hermes review must be an object")
    if review.get("live_execution_enabled") is not False:
        raise FuturesPaperRejected("Hermes review must keep live execution disabled")
    if str(review.get("candidate_fingerprint") or "") != expected_fingerprint:
        raise FuturesPaperRejected("Hermes review fingerprint mismatch")

    action = str(review.get("action") or "").upper()
    allowed_actions = {str(x).upper() for x in supervisor.get("allowed_actions", [])}
    if action not in allowed_actions:
        raise FuturesPaperRejected(f"Invalid Hermes action: {action}")
    multiplier = float(review.get("size_multiplier", -1))
    allowed_multipliers = [float(x) for x in supervisor.get("allowed_size_multipliers", [])]
    if not any(abs(multiplier - allowed) < 1e-9 for allowed in allowed_multipliers):
        raise FuturesPaperRejected(f"Invalid Hermes size multiplier: {multiplier}")
    if multiplier > float(supervisor.get("max_size_multiplier", 1.0)):
        raise FuturesPaperRejected("Hermes attempted to increase size")
    if action == "ACCEPT" and abs(multiplier - 1.0) > 1e-9:
        raise FuturesPaperRejected("ACCEPT must use size_multiplier=1.0")
    if action == "REDUCE" and not (0.0 < multiplier < 1.0):
        raise FuturesPaperRejected("REDUCE must use a multiplier between 0 and 1")
    if action == "REJECT" and abs(multiplier) > 1e-9:
        raise FuturesPaperRejected("REJECT must use size_multiplier=0.0")

    normalized = dict(review)
    normalized["action"] = action
    normalized["size_multiplier"] = multiplier
    normalized["live_execution_enabled"] = False
    return normalized


def apply_hermes_gate(
    decision: dict[str, Any],
    review: dict[str, Any],
    policy: dict[str, Any],
    expected_fingerprint: str,
) -> dict[str, Any] | None:
    review = validate_hermes_review(review, policy, expected_fingerprint)
    if review["action"] == "REJECT":
        return None

    original_contracts = int(decision["contracts"])
    multiplier = float(review["size_multiplier"])
    contracts = math.floor(original_contracts * multiplier)
    if contracts < 1:
        return None

    scale = contracts / original_contracts
    gated = dict(decision)
    gated["contracts"] = contracts
    gated["notional_usd"] = round(float(decision["notional_usd"]) * scale, 2)
    gated["risk_dollars"] = round(float(decision["risk_dollars"]) * scale, 2)
    gated["reward_dollars"] = round(float(decision["reward_dollars"]) * scale, 2)
    gated["notional_leverage"] = round(float(decision["notional_leverage"]) * scale, 3)
    gated["hermes_original_contracts"] = original_contracts
    gated["hermes_supervisor"] = review
    gated["candidate_fingerprint"] = expected_fingerprint
    gated["live_execution_enabled"] = False
    return gated
