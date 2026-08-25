#!/usr/bin/env python3
"""Deterministic Coinbase US crypto-futures PAPER trader.

This module is deliberately incapable of submitting orders. It consumes Coinbase
public product/candle/ticker-shaped payloads, selects eligible US FUTURE products,
creates inspectable momentum/breakout setups, and sizes simulated contracts with
hard leverage/risk caps.

Live order endpoints, trade-permission credentials, and broker adapters do not
belong in this module.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_POLICY = ROOT / "trading" / "coinbase_crypto_futures_policy.json"


class FuturesPaperRejected(ValueError):
    """Raised when a product/setup violates paper-futures controls."""


@dataclass(frozen=True)
class FuturesPaperDecision:
    product_id: str
    underlying: str
    contract_code: str
    side: str
    entry: float
    stop: float
    target: float
    contracts: int
    contract_size: float
    contract_root_unit: str
    notional_usd: float
    risk_dollars: float
    reward_dollars: float
    reward_to_risk: float
    notional_leverage: float
    funding_rate: float | None
    status: str = "PAPER_ONLY"

    def as_dict(self) -> dict[str, Any]:
        return {
            "product_id": self.product_id,
            "underlying": self.underlying,
            "contract_code": self.contract_code,
            "side": self.side,
            "entry": round(self.entry, 8),
            "stop": round(self.stop, 8),
            "target": round(self.target, 8),
            "contracts": self.contracts,
            "contract_size": self.contract_size,
            "contract_root_unit": self.contract_root_unit,
            "notional_usd": round(self.notional_usd, 2),
            "risk_dollars": round(self.risk_dollars, 2),
            "reward_dollars": round(self.reward_dollars, 2),
            "reward_to_risk": round(self.reward_to_risk, 3),
            "notional_leverage": round(self.notional_leverage, 3),
            "funding_rate": self.funding_rate,
            "status": self.status,
            "live_execution_enabled": False,
            "venue": "coinbase",
            "jurisdiction": "US",
        }


def load_policy(path: Path = DEFAULT_POLICY) -> dict[str, Any]:
    policy = json.loads(path.read_text(encoding="utf-8"))
    if policy.get("mode") != "paper_only":
        raise FuturesPaperRejected("Coinbase crypto-futures policy must remain paper_only")
    if policy.get("live_execution_enabled") is not False:
        raise FuturesPaperRejected("live_execution_enabled must remain false")
    if policy.get("accept_trade_permission_api_keys") is not False:
        raise FuturesPaperRejected("trade-permission API keys are forbidden in paper mode")
    if policy.get("public_market_data_only") is not True:
        raise FuturesPaperRejected("paper v1 must use public market data only")
    if str(policy.get("jurisdiction", "")).upper() != "US":
        raise FuturesPaperRejected("paper v1 is scoped to Coinbase US derivatives")
    if str(policy.get("product_type", "")).upper() != "FUTURE":
        raise FuturesPaperRejected("product_type must be FUTURE")
    return policy


def _float(value: Any, name: str, *, allow_zero: bool = False) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise FuturesPaperRejected(f"{name} must be numeric") from exc
    if not math.isfinite(number) or (number < 0 if allow_zero else number <= 0):
        raise FuturesPaperRejected(f"{name} must be {'non-negative' if allow_zero else 'positive'} and finite")
    return number


def _future_details(product: dict[str, Any]) -> dict[str, Any]:
    details = product.get("future_product_details")
    return details if isinstance(details, dict) else {}


def _perpetual_details(product: dict[str, Any]) -> dict[str, Any]:
    details = _future_details(product).get("perpetual_details")
    return details if isinstance(details, dict) else {}


def product_underlying(product: dict[str, Any]) -> str:
    for key in ("base_display_symbol", "base_currency_id"):
        value = str(product.get(key) or "").strip().upper()
        if value:
            return value
    details = _future_details(product)
    code = str(details.get("contract_code") or product.get("product_id") or "").upper()
    if code.startswith("BIP") or "BTC" in code:
        return "BTC"
    if code.startswith("ETP") or "ETH" in code:
        return "ETH"
    return ""


def is_eligible_product(product: dict[str, Any], policy: dict[str, Any]) -> bool:
    if str(product.get("product_type") or "").upper() != "FUTURE":
        return False
    if product.get("trading_disabled") is True or product.get("is_disabled") is True:
        return False
    if product.get("view_only") is True:
        return False

    details = _future_details(product)
    if details.get("non_crypto") is True:
        return False

    venue = str(product.get("product_venue") or details.get("venue") or "").upper()
    if venue and venue not in {"FCM", "CDE", "COINBASE_DERIVATIVES", "NEPTUNE"}:
        return False

    expiry_type = str(details.get("contract_expiry_type") or "").upper()
    preferred = str(policy.get("preferred_contract_expiry_type") or "").upper()
    if preferred and expiry_type and expiry_type != preferred:
        return False

    underlying = product_underlying(product)
    allowed = {str(x).upper() for x in policy.get("allowed_underlyings", [])}
    if underlying not in allowed:
        return False

    session = product.get("fcm_trading_session_details")
    if isinstance(session, dict):
        state = str(session.get("session_state") or "").upper()
        if any(token in state for token in ("CLOSED", "HALT", "MAINTENANCE")):
            return False

    try:
        return _float(details.get("contract_size"), "contract_size") > 0
    except FuturesPaperRejected:
        return False


def discover_products(products: Iterable[dict[str, Any]], policy: dict[str, Any]) -> list[dict[str, Any]]:
    """Return eligible BTC/ETH US futures, preferring perpetual-style and 24/7 contracts."""
    eligible = [p for p in products if isinstance(p, dict) and is_eligible_product(p, policy)]

    def score(p: dict[str, Any]) -> tuple[int, int, float]:
        d = _future_details(p)
        perp = int(str(d.get("contract_expiry_type") or "").upper() == "PERPETUAL")
        twenty_four = int(d.get("twenty_four_by_seven") is True)
        try:
            volume = float(p.get("approximate_quote_24h_volume") or p.get("volume_24h") or 0)
        except (TypeError, ValueError):
            volume = 0.0
        return (perp, twenty_four, volume)

    return sorted(eligible, key=score, reverse=True)


def normalize_candles(candles: Iterable[dict[str, Any]]) -> list[dict[str, float]]:
    rows: list[dict[str, float]] = []
    for candle in candles:
        try:
            row = {
                "start": float(candle["start"]),
                "open": float(candle["open"]),
                "high": float(candle["high"]),
                "low": float(candle["low"]),
                "close": float(candle["close"]),
                "volume": float(candle.get("volume", 0.0)),
            }
        except (KeyError, TypeError, ValueError):
            continue
        if row["low"] <= 0 or row["high"] < row["low"] or row["close"] <= 0:
            continue
        rows.append(row)
    rows.sort(key=lambda x: x["start"])
    dedup: dict[float, dict[str, float]] = {row["start"]: row for row in rows}
    return [dedup[key] for key in sorted(dedup)]


def _ema(values: list[float], period: int) -> float:
    if not values or period <= 0:
        raise FuturesPaperRejected("EMA requires values and positive period")
    alpha = 2.0 / (period + 1.0)
    value = values[0]
    for item in values[1:]:
        value = alpha * item + (1.0 - alpha) * value
    return value


def _atr(rows: list[dict[str, float]], period: int) -> float:
    if len(rows) < period + 1:
        raise FuturesPaperRejected("Not enough bars for ATR")
    true_ranges: list[float] = []
    for idx in range(1, len(rows)):
        current, prev = rows[idx], rows[idx - 1]
        true_ranges.append(max(
            current["high"] - current["low"],
            abs(current["high"] - prev["close"]),
            abs(current["low"] - prev["close"]),
        ))
    window = true_ranges[-period:]
    return sum(window) / len(window)


def market_signal(
    product: dict[str, Any],
    candles: Iterable[dict[str, Any]],
    policy: dict[str, Any],
) -> dict[str, Any] | None:
    rows = normalize_candles(candles)
    minimum = max(
        int(policy["lookback_bars"]),
        int(policy["ema_slow"]) + 2,
        int(policy["atr_period"]) + 2,
        int(policy["breakout_lookback"]) + 2,
    )
    if len(rows) < minimum:
        return None

    rows = rows[-int(policy["lookback_bars"]):]
    closes = [row["close"] for row in rows]
    fast = _ema(closes, int(policy["ema_fast"]))
    slow = _ema(closes, int(policy["ema_slow"]))
    atr = _atr(rows, int(policy["atr_period"]))
    if atr <= 0:
        return None

    breakout_n = int(policy["breakout_lookback"])
    prior = rows[-(breakout_n + 1):-1]
    current = rows[-1]
    breakout_high = max(row["high"] for row in prior)
    breakout_low = min(row["low"] for row in prior)

    prior_volumes = [row["volume"] for row in prior if row["volume"] >= 0]
    mean_volume = sum(prior_volumes) / len(prior_volumes) if prior_volumes else 0.0
    if mean_volume > 0 and current["volume"] < mean_volume * float(policy["minimum_relative_volume"]):
        return None

    side: str | None = None
    if current["close"] > breakout_high and fast > slow:
        side = "long"
    elif current["close"] < breakout_low and fast < slow:
        side = "short"
    if side is None:
        return None

    bid = product.get("best_bid_price")
    ask = product.get("best_ask_price")
    spread_bps: float | None = None
    try:
        bid_f, ask_f = float(bid), float(ask)
        midpoint = (bid_f + ask_f) / 2.0
        if bid_f > 0 and ask_f >= bid_f and midpoint > 0:
            spread_bps = (ask_f - bid_f) / midpoint * 10_000.0
    except (TypeError, ValueError):
        pass
    if spread_bps is not None and spread_bps > float(policy["max_spread_bps"]):
        return None

    entry = current["close"]
    stop_distance = atr * float(policy["atr_stop_multiple"])
    rr = float(policy["reward_to_risk"])
    if side == "long":
        stop = entry - stop_distance
        target = entry + stop_distance * rr
    else:
        stop = entry + stop_distance
        target = entry - stop_distance * rr
    if stop <= 0 or target <= 0:
        return None

    perp = _perpetual_details(product)
    funding_rate: float | None = None
    for candidate in (perp.get("funding_rate"), _future_details(product).get("funding_rate")):
        try:
            funding_rate = float(candidate)
            break
        except (TypeError, ValueError):
            continue

    return {
        "side": side,
        "entry": entry,
        "stop": stop,
        "target": target,
        "atr": atr,
        "ema_fast": fast,
        "ema_slow": slow,
        "breakout_high": breakout_high,
        "breakout_low": breakout_low,
        "spread_bps": spread_bps,
        "funding_rate": funding_rate,
        "bar_start": current["start"],
    }


def size_paper_trade(
    product: dict[str, Any],
    signal: dict[str, Any],
    account: dict[str, Any],
    policy: dict[str, Any],
) -> FuturesPaperDecision:
    if not is_eligible_product(product, policy):
        raise FuturesPaperRejected("Product is not eligible under Coinbase US crypto-futures policy")

    equity = _float(account.get("equity", policy["starting_equity"]), "equity")
    realized_pnl = float(account.get("realized_pnl", 0.0))
    open_risk_pct = max(0.0, float(account.get("open_risk_pct", 0.0)))
    open_positions = max(0, int(account.get("open_positions", 0)))
    trades_today = max(0, int(account.get("trades_today", 0)))

    if realized_pnl <= -(equity * float(policy["max_daily_loss_pct"]) / 100.0):
        raise FuturesPaperRejected("Daily loss limit reached")
    if open_risk_pct >= float(policy["max_open_risk_pct"]):
        raise FuturesPaperRejected("Maximum open risk reached")
    if open_positions >= int(policy["max_positions"]):
        raise FuturesPaperRejected("Maximum open futures positions reached")
    if trades_today >= int(policy["max_trades_per_utc_day"]):
        raise FuturesPaperRejected("Maximum futures trades reached for UTC day")

    side = str(signal.get("side") or "").lower()
    if side not in {"long", "short"}:
        raise FuturesPaperRejected("Signal side must be long or short")
    entry = _float(signal.get("entry"), "entry")
    stop = _float(signal.get("stop"), "stop")
    target = _float(signal.get("target"), "target")
    if side == "long" and not stop < entry < target:
        raise FuturesPaperRejected("Long futures setup requires stop < entry < target")
    if side == "short" and not target < entry < stop:
        raise FuturesPaperRejected("Short futures setup requires target < entry < stop")

    details = _future_details(product)
    contract_size = _float(details.get("contract_size"), "contract_size")
    root_unit = str(details.get("contract_root_unit") or product_underlying(product) or "UNIT")
    risk_per_contract = abs(entry - stop) * contract_size
    reward_per_contract = abs(target - entry) * contract_size
    if risk_per_contract <= 0:
        raise FuturesPaperRejected("Risk per contract must be positive")

    risk_budget = equity * float(policy["risk_per_trade_pct"]) / 100.0
    by_risk = math.floor(risk_budget / risk_per_contract)
    notional_per_contract = entry * contract_size
    max_notional = equity * float(policy["max_notional_leverage"])
    by_leverage = math.floor(max_notional / notional_per_contract)
    contracts = min(by_risk, by_leverage)
    if contracts < 1:
        raise FuturesPaperRejected("Risk/leverage budget is too small for one futures contract")

    notional = contracts * notional_per_contract
    risk_dollars = contracts * risk_per_contract
    reward_dollars = contracts * reward_per_contract
    leverage = notional / equity
    if leverage > float(policy["max_notional_leverage"]) + 1e-9:
        raise FuturesPaperRejected("Notional leverage cap exceeded")

    product_max_leverage: float | None = None
    try:
        product_max_leverage = float(_perpetual_details(product).get("max_leverage"))
    except (TypeError, ValueError):
        pass
    if product_max_leverage and leverage > product_max_leverage + 1e-9:
        raise FuturesPaperRejected("Product-reported maximum leverage exceeded")

    funding_rate = signal.get("funding_rate")
    if funding_rate is not None:
        try:
            funding_rate = float(funding_rate)
        except (TypeError, ValueError):
            funding_rate = None

    return FuturesPaperDecision(
        product_id=str(product.get("product_id") or ""),
        underlying=product_underlying(product),
        contract_code=str(details.get("contract_code") or product.get("product_id") or ""),
        side=side,
        entry=entry,
        stop=stop,
        target=target,
        contracts=contracts,
        contract_size=contract_size,
        contract_root_unit=root_unit,
        notional_usd=notional,
        risk_dollars=risk_dollars,
        reward_dollars=reward_dollars,
        reward_to_risk=reward_dollars / risk_dollars,
        notional_leverage=leverage,
        funding_rate=funding_rate,
    )
