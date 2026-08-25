#!/usr/bin/env python3
"""Run one deterministic paper-only intraday trading cycle from a JSON snapshot."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from trading.daytrade_engine import load_day_policy, new_state, run_cycle
from trading.paper_engine import load_policy as load_risk_policy

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_STATE = ROOT / "trading" / "paper_daytrade_state.json"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("snapshot", type=Path)
    parser.add_argument("--state", type=Path, default=DEFAULT_STATE)
    parser.add_argument("--report", type=Path, default=None)
    args = parser.parse_args()

    snapshot = load_json(args.snapshot)
    risk_policy = load_risk_policy()
    day_policy = load_day_policy()

    if args.state.exists():
        state = load_json(args.state)
    else:
        state = new_state(float(risk_policy["starting_equity"]), str(snapshot.get("session_id") or ""))

    result = run_cycle(snapshot, state, day_policy, risk_policy)
    args.state.parent.mkdir(parents=True, exist_ok=True)
    args.state.write_text(json.dumps(result["state"], indent=2, sort_keys=True) + "\n", encoding="utf-8")

    report_path = args.report or args.state.with_name("paper_daytrade_last_report.json")
    report_path.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({
        "paper_only": True,
        "live_execution_enabled": False,
        "events": result["events"],
        "open_positions": len(result["state"].get("open_positions", {})),
        "equity": result["state"]["equity"],
        "realized_pnl": result["state"]["realized_pnl"],
        "report": str(report_path),
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
