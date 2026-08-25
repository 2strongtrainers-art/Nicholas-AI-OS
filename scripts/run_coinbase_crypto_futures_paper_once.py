#!/usr/bin/env python3
"""Run one Coinbase US crypto-futures multi-timeframe PAPER cycle with Hermes.

All market data is fetched from Coinbase public Advanced Trade endpoints.
No Coinbase API key is read and no authenticated order endpoint is available.
Hermes is a fail-closed supervisory gate: it may accept, reduce, or reject an
already deterministic paper setup, but cannot create or enlarge one.
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
    _future_details,
    _perpetual_details,
    discover_products,
    load_policy,
    size_paper_trade,
)
from trading.coinbase_mtf import (  # noqa: E402
    ALL_COINBASE_TIMEFRAMES,
    TIMEFRAME_SECONDS,
    apply_hermes_gate,
    build_mtf_view,
    candidate_fingerprint,
    multi_timeframe_signal,
    validate_mtf_policy,
)
from trading.hermes_coinbase_supervisor import run_hermes_review  # noqa: E402

API_ROOT = "https://api.coinbase.com/api/v3/brokerage/market"
RUNTIME = Path(
    os.environ.get(
        "COINBASE_FUTURES_PAPER_RUNTIME",
        Path.home() / ".nicholas-ai-os" / "coinbase-futures-paper",
    )
)
STATE_PATH = RUNTIME / "state.json"
STATUS_PATH = RUNTIME / "status.json"
REPORT_PATH = RUNTIME / "last_report.json"
CACHE_PATH = RUNTIME / "market_cache.json"
HERMES_INPUT_PATH = RUNTIME / "hermes_last_input.json"
HERMES_REVIEW_PATH = RUNTIME / "hermes_last_review.json"


def _get_json(url: str, timeout: int = 12) -> dict[str, Any]:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or parsed.hostname != "api.coinbase.com":
        raise RuntimeError("Market-data URL escaped the allowlisted Coinbase host")
    if not parsed.path.startswith("/api/v3/brokerage/market/"):
        raise RuntimeError("Only Coinbase public market-data paths are allowed")

    req = urllib.request.Request(
        url,
        method="GET",
        headers={
            "Accept": "application/json",
            "Cache-Control": "no-cache",
            "User-Agent": "Nicholas-AI-OS-Coinbase-Futures-MTF-Hermes/2.0",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:  # nosec B310 - host/path allowlisted above
        if response.status != 200:
            raise RuntimeError(f"Coinbase public market-data HTTP {response.status}")
        payload = json.loads(response.read().decode("utf-8"))
    if not isinstance(payload, dict):
        raise RuntimeError("Coinbase market-data response was not an object")
    return payload


def _public_products() -> list[dict[str, Any]]:
    query = urllib.parse.urlencode(
        {
            "product_type": "FUTURE",
            "contract_expiry_type": "PERPETUAL",
            "futures_underlying_type": "FUTURES_UNDERLYING_TYPE_SPOT",
            "user_country_code": "US",
            "limit": "100",
        }
    )
    payload = _get_json(f"{API_ROOT}/products?{query}")
    products = payload.get("products") or []
    return [item for item in products if isinstance(item, dict)]


def _candles(product_id: str, granularity: str, lookback_bars: int) -> list[dict[str, Any]]:
    seconds_per_bar = TIMEFRAME_SECONDS.get(granularity)
    if not seconds_per_bar:
        raise RuntimeError(f"Unsupported granularity: {granularity}")
    limit = min(350, max(int(lookback_bars) + 8, 80))
    end = int(time.time())
    start = end - seconds_per_bar * limit
    query = urllib.parse.urlencode(
        {
            "start": str(start),
            "end": str(end),
            "granularity": granularity,
            "limit": str(limit),
        }
    )
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
        "last_candidate_bar": {},
        "hermes_reviews": {},
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
    state.setdefault("last_candidate_bar", {})
    state.setdefault("hermes_reviews", {})
    return state


def _load_cache() -> dict[str, Any]:
    if not CACHE_PATH.exists():
        return {"items": {}}
    try:
        cache = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {"items": {}}
    if not isinstance(cache, dict) or not isinstance(cache.get("items"), dict):
        return {"items": {}}
    return cache


def _save_cache(cache: dict[str, Any]) -> None:
    CACHE_PATH.write_text(json.dumps(cache, separators=(",", ":"), sort_keys=True), encoding="utf-8")


def _refresh_seconds(granularity: str) -> int:
    seconds = TIMEFRAME_SECONDS[granularity]
    return max(55, min(7200, seconds // 5))


def _cached_candles(
    product_id: str,
    granularity: str,
    lookback_bars: int,
    cache: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    now = time.time()
    key = f"{product_id}|{granularity}"
    item = cache["items"].get(key)
    age = None
    if isinstance(item, dict):
        try:
            age = max(0.0, now - float(item["fetched_at"]))
        except (KeyError, TypeError, ValueError):
            item = None
            age = None

    ttl = _refresh_seconds(granularity)
    if item and age is not None and age < ttl and isinstance(item.get("candles"), list):
        return item["candles"], {
            "source": "cache",
            "age_seconds": round(age, 1),
            "refresh_seconds": ttl,
        }

    try:
        candles = _candles(product_id, granularity, lookback_bars)
        cache["items"][key] = {
            "fetched_at": now,
            "candles": candles,
        }
        return candles, {
            "source": "fresh",
            "age_seconds": 0.0,
            "refresh_seconds": ttl,
        }
    except Exception:
        max_stale = max(ttl * 3, TIMEFRAME_SECONDS[granularity] * 2)
        if item and age is not None and age <= max_stale and isinstance(item.get("candles"), list):
            return item["candles"], {
                "source": "stale_cache",
                "age_seconds": round(age, 1),
                "refresh_seconds": ttl,
            }
        raise


def _collect_timeframes(
    product_id: str,
    policy: dict[str, Any],
    cache: dict[str, Any],
) -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any]]:
    candles_by_tf: dict[str, list[dict[str, Any]]] = {}
    metadata: dict[str, Any] = {}
    for timeframe in ALL_COINBASE_TIMEFRAMES:
        config = policy["timeframes"][timeframe]
        candles, meta = _cached_candles(
            product_id,
            timeframe,
            int(config["lookback_bars"]),
            cache,
        )
        candles_by_tf[timeframe] = candles
        metadata[timeframe] = meta
    return candles_by_tf, metadata


def _open_risk_pct(state: dict[str, Any]) -> float:
    equity = max(float(state.get("equity", 0.0)), 1e-9)
    risk = sum(
        float(position.get("risk_dollars", 0.0))
        for position in state.get("open_positions", {}).values()
    )
    return risk / equity * 100.0


def _exit_position(
    state: dict[str, Any],
    product_id: str,
    exit_price: float,
    reason: str,
    bar_start: float,
) -> dict[str, Any]:
    position = state["open_positions"].pop(product_id)
    entry = float(position["entry"])
    contract_size = float(position["contract_size"])
    contracts = int(position["contracts"])
    side = position["side"]
    pnl = (
        (exit_price - entry) * contract_size * contracts
        if side == "long"
        else (entry - exit_price) * contract_size * contracts
    )
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


def _manage_position(
    state: dict[str, Any],
    product_id: str,
    candles: list[dict[str, Any]],
) -> dict[str, Any] | None:
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


def _funding_rate(product: dict[str, Any]) -> float | None:
    for candidate in (
        _perpetual_details(product).get("funding_rate"),
        _future_details(product).get("funding_rate"),
    ):
        try:
            return float(candidate)
        except (TypeError, ValueError):
            continue
    return None


def _max_product_leverage(product: dict[str, Any]) -> float | None:
    try:
        value = _perpetual_details(product).get("max_leverage")
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _hermes_snapshot(
    *,
    product: dict[str, Any],
    underlying: str,
    signal: dict[str, Any],
    decision: dict[str, Any],
    account: dict[str, Any],
    state: dict[str, Any],
    fingerprint: str,
    timeframe_meta: dict[str, Any],
) -> dict[str, Any]:
    product_id = str(product.get("product_id") or "")
    return {
        "paper_only": True,
        "live_execution_enabled": False,
        "candidate_fingerprint": fingerprint,
        "venue": "coinbase",
        "jurisdiction": "US",
        "product_type": "FUTURE",
        "product_id": product_id,
        "underlying": underlying,
        "side": signal["side"],
        "entry": signal["entry"],
        "stop": signal["stop"],
        "target": signal["target"],
        "spread_bps": signal.get("spread_bps"),
        "funding_rate": _funding_rate(product),
        "product_max_leverage": _max_product_leverage(product),
        "deterministic_decision": {
            "contracts": decision["contracts"],
            "contract_size": decision["contract_size"],
            "notional_usd": decision["notional_usd"],
            "risk_dollars": decision["risk_dollars"],
            "reward_to_risk": decision["reward_to_risk"],
            "notional_leverage": decision["notional_leverage"],
        },
        "multi_timeframe": signal["multi_timeframe"],
        "timeframe_data_freshness": timeframe_meta,
        "account": account,
        "paper_performance": {
            "day_realized_pnl": state.get("day_realized_pnl", 0.0),
            "lifetime_realized_pnl": state.get("lifetime_realized_pnl", 0.0),
            "trades_today": state.get("trades_today", 0),
            "recent_closed_trades": state.get("closed_trades", [])[-5:],
        },
    }


def _hermes_review(
    snapshot: dict[str, Any],
    policy: dict[str, Any],
    state: dict[str, Any],
    product_id: str,
) -> tuple[dict[str, Any], bool]:
    fingerprint = str(snapshot["candidate_fingerprint"])
    cached = state["hermes_reviews"].get(product_id)
    cache_seconds = int(policy["hermes_supervisor"]["review_cache_seconds"])
    now = time.time()
    if isinstance(cached, dict) and cached.get("candidate_fingerprint") == fingerprint:
        try:
            reviewed_at_epoch = float(cached["reviewed_at_epoch"])
        except (KeyError, TypeError, ValueError):
            reviewed_at_epoch = 0.0
        if now - reviewed_at_epoch <= cache_seconds and isinstance(cached.get("review"), dict):
            return cached["review"], True

    HERMES_INPUT_PATH.write_text(
        json.dumps(snapshot, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    review = run_hermes_review(snapshot, policy)
    state["hermes_reviews"][product_id] = {
        "candidate_fingerprint": fingerprint,
        "reviewed_at_epoch": now,
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
        "review": review,
    }
    HERMES_REVIEW_PATH.write_text(
        json.dumps(
            {
                "product_id": product_id,
                "reviewed_at": state["hermes_reviews"][product_id]["reviewed_at"],
                **review,
            },
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )
    return review, False


def run_once() -> dict[str, Any]:
    policy = load_policy()
    validate_mtf_policy(policy)
    RUNTIME.mkdir(parents=True, exist_ok=True)
    state = _load_state(float(policy["starting_equity"]))
    cache = _load_cache()
    events: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []
    market_views: dict[str, Any] = {}
    timeframe_sources: dict[str, Any] = {}

    products = discover_products(_public_products(), policy)
    selected: dict[str, dict[str, Any]] = {}
    for product in products:
        underlying = str(
            product.get("base_display_symbol")
            or product.get("base_currency_id")
            or ""
        ).upper()
        if underlying and underlying not in selected:
            selected[underlying] = product

    for underlying, product in selected.items():
        product_id = str(product.get("product_id") or "")
        if not product_id:
            continue
        try:
            candles_by_tf, tf_meta = _collect_timeframes(product_id, policy, cache)
            timeframe_sources[underlying] = tf_meta
            tick = _ticker(product_id)
            product["best_bid_price"] = tick.get("best_bid") or product.get("best_bid_price")
            product["best_ask_price"] = tick.get("best_ask") or product.get("best_ask_price")

            view = build_mtf_view(candles_by_tf, policy)
            market_views[underlying] = view

            management_tf = str(policy["position_management_granularity"]).upper()
            exited = _manage_position(state, product_id, candles_by_tf[management_tf])
            if exited:
                events.append(
                    {"type": "paper_exit", "product_id": product_id, "detail": exited}
                )

            if product_id in state["open_positions"]:
                continue

            execution_tf = str(policy["execution_granularity"]).upper()
            if tf_meta["ONE_MINUTE"]["source"] == "stale_cache":
                continue
            if tf_meta[execution_tf]["source"] == "stale_cache":
                continue

            signal = multi_timeframe_signal(product, candles_by_tf, policy)
            if not signal:
                continue
            bar_start = str(signal["bar_start"])
            if str(state["last_entry_bar"].get(product_id, "")) == bar_start:
                continue
            if str(state["last_candidate_bar"].get(product_id, "")) == bar_start:
                continue
            state["last_candidate_bar"][product_id] = bar_start

            account = {
                "equity": state["equity"],
                "realized_pnl": state["day_realized_pnl"],
                "open_risk_pct": _open_risk_pct(state),
                "open_positions": len(state["open_positions"]),
                "trades_today": state["trades_today"],
            }
            deterministic = size_paper_trade(product, signal, account, policy).as_dict()
            fingerprint = candidate_fingerprint(product_id, signal)
            supervisor_input = _hermes_snapshot(
                product=product,
                underlying=underlying,
                signal=signal,
                decision=deterministic,
                account=account,
                state=state,
                fingerprint=fingerprint,
                timeframe_meta=tf_meta,
            )
            review, from_cache = _hermes_review(
                supervisor_input,
                policy,
                state,
                product_id,
            )
            gated = apply_hermes_gate(
                deterministic,
                review,
                policy,
                fingerprint,
            )
            if gated is None:
                events.append(
                    {
                        "type": "paper_candidate_rejected_by_hermes",
                        "product_id": product_id,
                        "candidate_fingerprint": fingerprint,
                        "hermes_review": review,
                        "hermes_review_cached": from_cache,
                    }
                )
                continue

            gated["opened_at"] = datetime.now(timezone.utc).isoformat()
            gated["entry_bar_start"] = signal["bar_start"]
            gated["strategy"] = "coinbase_crypto_futures_mtf_hermes_v2"
            gated["signal"] = {
                "ema_fast": signal["ema_fast"],
                "ema_slow": signal["ema_slow"],
                "atr": signal["atr"],
                "spread_bps": signal["spread_bps"],
                "multi_timeframe": signal["multi_timeframe"],
            }
            gated["hermes_review_cached"] = from_cache
            state["open_positions"][product_id] = gated
            state["last_entry_bar"][product_id] = bar_start
            state["trades_today"] = int(state["trades_today"]) + 1
            events.append(
                {"type": "paper_entry", "product_id": product_id, "detail": gated}
            )
        except (FuturesPaperRejected, RuntimeError, OSError, ValueError) as exc:
            errors.append({"product_id": product_id, "error": str(exc)})

    _save_cache(cache)
    state["paper_only"] = True
    state["live_execution_enabled"] = False
    state["last_cycle_at"] = datetime.now(timezone.utc).isoformat()
    STATE_PATH.write_text(
        json.dumps(state, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    report = {
        "paper_only": True,
        "live_execution_enabled": False,
        "venue": "coinbase",
        "jurisdiction": "US",
        "product_type": "FUTURE",
        "strategy": "coinbase_crypto_futures_mtf_hermes_v2",
        "checked_at": state["last_cycle_at"],
        "timeframes_checked": list(ALL_COINBASE_TIMEFRAMES),
        "hermes_supervisor_enabled": True,
        "selected_products": {
            key: value.get("product_id") for key, value in selected.items()
        },
        "market_views": market_views,
        "timeframe_sources": timeframe_sources,
        "events": events,
        "errors": errors,
        "equity": round(float(state["equity"]), 2),
        "day_realized_pnl": round(float(state["day_realized_pnl"]), 2),
        "lifetime_realized_pnl": round(float(state["lifetime_realized_pnl"]), 2),
        "open_positions": len(state["open_positions"]),
        "trades_today": state["trades_today"],
    }
    REPORT_PATH.write_text(
        json.dumps(report, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    last_review = None
    if state["hermes_reviews"]:
        reviews = [
            value
            for value in state["hermes_reviews"].values()
            if isinstance(value, dict) and value.get("reviewed_at")
        ]
        if reviews:
            last_review = max(reviews, key=lambda item: str(item["reviewed_at"]))

    STATUS_PATH.write_text(
        json.dumps(
            {
                "component": "Coinbase Crypto Futures MTF + Hermes Paper Feed",
                "state": (
                    "healthy"
                    if selected and not errors
                    else ("degraded" if selected else "no_eligible_products")
                ),
                "strategy": "coinbase_crypto_futures_mtf_hermes_v2",
                "checked_at": state["last_cycle_at"],
                "paper_only": True,
                "live_execution_enabled": False,
                "public_market_data_only": True,
                "hermes_supervisor_enabled": True,
                "hermes_fail_closed": True,
                "timeframes_checked": list(ALL_COINBASE_TIMEFRAMES),
                "selected_products": report["selected_products"],
                "open_positions": report["open_positions"],
                "equity": report["equity"],
                "day_realized_pnl": report["day_realized_pnl"],
                "hermes_last_review": last_review,
            },
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )
    return report


def main() -> int:
    try:
        report = run_once()
        print(json.dumps(report, indent=2, sort_keys=True))
        return 0 if report["selected_products"] else 2
    except Exception as exc:
        RUNTIME.mkdir(parents=True, exist_ok=True)
        STATUS_PATH.write_text(
            json.dumps(
                {
                    "component": "Coinbase Crypto Futures MTF + Hermes Paper Feed",
                    "state": "failed",
                    "strategy": "coinbase_crypto_futures_mtf_hermes_v2",
                    "checked_at": datetime.now(timezone.utc).isoformat(),
                    "paper_only": True,
                    "live_execution_enabled": False,
                    "hermes_supervisor_enabled": True,
                    "hermes_fail_closed": True,
                    "error": str(exc),
                },
                indent=2,
                sort_keys=True,
            )
            + "\n",
            encoding="utf-8",
        )
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
