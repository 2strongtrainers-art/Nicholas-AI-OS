#!/usr/bin/env python3
"""Deterministic paper-trading risk engine.

This module never connects to a broker, never sends orders, and refuses live
execution by design. It sizes hypothetical trades from a repository policy.
"""

from __future__ import annotations

import argparse
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_POLICY = ROOT / "trading" / "risk_policy.json"


class RiskRejected(ValueError):
    """Raised when a proposed paper trade violates deterministic controls."""


@dataclass(frozen=True)
class PaperDecision:
    symbol: str
    asset_class: str
    side: str
    entry: float
    stop: float
    target: float
    quantity: int
    risk_dollars: float
    reward_dollars: float
    reward_to_risk: float
    status: str = "PAPER_ONLY"

    def as_dict(self) -> dict[str, Any]:
        return {
            "symbol": self.symbol,
            "asset_class": self.asset_class,
            "side": self.side,
            "entry": self.entry,
            "stop": self.stop,
            "target": self.target,
            "quantity": self.quantity,
            "risk_dollars": round(self.risk_dollars, 2),
            "reward_dollars": round(self.reward_dollars, 2),
            "reward_to_risk": round(self.reward_to_risk, 2),
            "status": self.status,
            "live_execution_enabled": False,
        }


def load_policy(path: Path = DEFAULT_POLICY) -> dict[str, Any]:
    policy = json.loads(path.read_text(encoding="utf-8"))
    if policy.get("live_execution_enabled") is not False:
        raise RiskRejected("Policy must keep live_execution_enabled=false")
    if policy.get("mode") != "paper_only":
        raise RiskRejected("Policy mode must remain paper_only")
    if policy.get("live_broker_adapters"):
        raise RiskRejected("Paper desk must not configure live broker adapters")
    return policy


def _positive_number(value: Any, name: str) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise RiskRejected(f"{name} must be numeric") from exc
    if not math.isfinite(number) or number <= 0:
        raise RiskRejected(f"{name} must be positive and finite")
    return number


def evaluate_setup(setup: dict[str, Any], account: dict[str, Any], policy: dict[str, Any]) -> PaperDecision:
    if setup.get("execution") not in (None, "paper"):
        raise RiskRejected("Only paper execution is permitted")

    symbol = str(setup.get("symbol", "")).strip().upper()
    if not symbol or len(symbol) > 24:
        raise RiskRejected("Valid symbol is required")

    asset_class = str(setup.get("asset_class", "")).strip().lower()
    if asset_class not in set(policy.get("allowed_asset_classes", [])):
        raise RiskRejected(f"Asset class not allowed: {asset_class}")

    side = str(setup.get("side", "")).strip().lower()
    if side not in {"long", "short"}:
        raise RiskRejected("side must be long or short")

    if setup.get("average_down") is True and not policy.get("allow_averaging_down", False):
        raise RiskRejected("Averaging down is disabled")

    equity = _positive_number(account.get("equity"), "equity")
    realized_pnl = float(account.get("realized_pnl", 0.0))
    open_risk_pct = max(0.0, float(account.get("open_risk_pct", 0.0)))
    open_positions = max(0, int(account.get("open_positions", 0)))
    trades_today = max(0, int(account.get("trades_today", 0)))

    if realized_pnl <= -(equity * float(policy["max_daily_loss_pct"]) / 100.0):
        raise RiskRejected("Daily loss limit reached")
    if open_risk_pct >= float(policy["max_open_risk_pct"]):
        raise RiskRejected("Maximum open risk reached")
    if open_positions >= int(policy["max_positions"]):
        raise RiskRejected("Maximum open positions reached")
    if trades_today >= int(policy["max_trades_per_day"]):
        raise RiskRejected("Maximum trades per day reached")

    entry = _positive_number(setup.get("entry"), "entry")
    stop = _positive_number(setup.get("stop"), "stop")
    target = _positive_number(setup.get("target"), "target")

    if side == "long":
        if not stop < entry < target:
            raise RiskRejected("Long setup requires stop < entry < target")
        risk_per_unit = entry - stop
        reward_per_unit = target - entry
    else:
        if not target < entry < stop:
            raise RiskRejected("Short setup requires target < entry < stop")
        risk_per_unit = stop - entry
        reward_per_unit = entry - target

    max_risk_dollars = equity * float(policy["risk_per_trade_pct"]) / 100.0
    quantity = math.floor(max_risk_dollars / risk_per_unit)
    if quantity < 1:
        raise RiskRejected("Risk budget is too small for one unit")

    risk_dollars = quantity * risk_per_unit
    reward_dollars = quantity * reward_per_unit
    reward_to_risk = reward_per_unit / risk_per_unit

    return PaperDecision(
        symbol=symbol,
        asset_class=asset_class,
        side=side,
        entry=entry,
        stop=stop,
        target=target,
        quantity=quantity,
        risk_dollars=risk_dollars,
        reward_dollars=reward_dollars,
        reward_to_risk=reward_to_risk,
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("setup_json", type=Path)
    parser.add_argument("--policy", type=Path, default=DEFAULT_POLICY)
    args = parser.parse_args()

    payload = json.loads(args.setup_json.read_text(encoding="utf-8"))
    policy = load_policy(args.policy)
    decision = evaluate_setup(payload["setup"], payload["account"], policy)
    print(json.dumps(decision.as_dict(), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
