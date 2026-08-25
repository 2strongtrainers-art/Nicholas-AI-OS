#!/usr/bin/env python3
"""Fetch one live-data snapshot and run one paper-only day-trading cycle."""

from __future__ import annotations

import base64
import json
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from trading.daytrade_engine import load_day_policy, new_state, run_cycle
from trading.market_feed import DEFAULT_SYMBOLS, MarketDataError, build_snapshot
from trading.paper_engine import load_policy as load_risk_policy

RUNTIME = Path.home() / ".nicholas-ai-os" / "paper-daytrader"
STATE_PATH = RUNTIME / "state.json"
SNAPSHOT_PATH = RUNTIME / "latest_snapshot.json"
REPORT_PATH = RUNTIME / "last_report.json"
STATUS_PATH = RUNTIME / "status.json"
LAST_REMOTE_PUSH = RUNTIME / "last_remote_push.txt"
REMOTE_STATUS_PATH = "status/paper-daytrader.json"
REPO = os.environ.get("NICHOLAS_AI_OS_REPO", "2strongtrainers-art/Nicholas-AI-OS")


def _load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _write(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _symbols() -> list[str]:
    raw = os.environ.get("PAPER_DAYTRADER_SYMBOLS", "").strip()
    return [item.strip().upper() for item in raw.split(",") if item.strip()] if raw else list(DEFAULT_SYMBOLS)


def _should_push(events: list[dict]) -> bool:
    if events:
        return True
    try:
        previous = float(LAST_REMOTE_PUSH.read_text(encoding="utf-8").strip())
    except Exception:
        return True
    return time.time() - previous >= 1800


def _push_remote_status(status: dict) -> bool:
    gh = shutil.which("gh")
    if not gh:
        return False
    content = base64.b64encode((json.dumps(status, indent=2, sort_keys=True) + "\n").encode()).decode()
    sha = None
    get = subprocess.run(
        [gh, "api", f"repos/{REPO}/contents/{REMOTE_STATUS_PATH}?ref=main"],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=30,
    )
    if get.returncode == 0:
        try:
            sha = json.loads(get.stdout).get("sha")
        except Exception:
            sha = None
    args = [
        gh, "api", "-X", "PUT", f"repos/{REPO}/contents/{REMOTE_STATUS_PATH}",
        "-f", "message=Paper day trader status checkpoint",
        "-f", f"content={content}",
        "-f", "branch=main",
    ]
    if sha:
        args += ["-f", f"sha={sha}"]
    put = subprocess.run(args, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
    if put.returncode == 0:
        LAST_REMOTE_PUSH.write_text(str(time.time()), encoding="utf-8")
        return True
    return False


def main() -> int:
    RUNTIME.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)
    status: dict = {
        "component": "Paper Day Trader Feed",
        "checked_at": now.isoformat(),
        "paper_only": True,
        "live_execution_enabled": False,
        "broker_order_capability": False,
        "symbols_requested": _symbols(),
    }
    try:
        snapshot = build_snapshot(_symbols(), now=now)
        _write(SNAPSHOT_PATH, snapshot)
        risk_policy = load_risk_policy()
        day_policy = load_day_policy()
        if STATE_PATH.exists():
            state = _load(STATE_PATH)
        else:
            state = new_state(float(risk_policy["starting_equity"]), snapshot["session_id"])
        result = run_cycle(snapshot, state, day_policy, risk_policy)
        _write(STATE_PATH, result["state"])
        _write(REPORT_PATH, result)
        events = result.get("events") or []
        status.update({
            "state": "running",
            "provider": snapshot.get("provider"),
            "session_id": snapshot.get("session_id"),
            "session_complete": bool(snapshot.get("session_complete")),
            "symbols_received": [item.get("symbol") for item in snapshot.get("symbols", [])],
            "market_data_errors": snapshot.get("errors", {}),
            "latest_data_at": max(
                (item["bars"][-1]["timestamp"] for item in snapshot.get("symbols", []) if item.get("bars")),
                default=None,
            ),
            "equity": result["state"].get("equity"),
            "realized_pnl": result["state"].get("realized_pnl"),
            "trades_today": result["state"].get("trades_today"),
            "open_positions": len(result["state"].get("open_positions", {})),
            "events": events[-10:],
            "candidates": result.get("candidates", [])[:3],
        })
        _write(STATUS_PATH, status)
        remote = _push_remote_status(status) if _should_push(events) else False
        print(json.dumps({
            "PAPER_FEED_CYCLE_OK": 1,
            "paper_only": True,
            "provider": status.get("provider"),
            "open_positions": status.get("open_positions"),
            "trades_today": status.get("trades_today"),
            "realized_pnl": status.get("realized_pnl"),
            "remote_status_pushed": remote,
        }, indent=2))
        return 0
    except MarketDataError as exc:
        status.update({"state": "market_data_unavailable", "error": str(exc)})
        _write(STATUS_PATH, status)
        # A closed market or transient feed problem is not permission to change
        # strategy/risk controls or fall through to any execution capability.
        print(json.dumps(status, indent=2))
        return 0
    except Exception as exc:
        status.update({"state": "degraded", "error": str(exc)})
        _write(STATUS_PATH, status)
        print(json.dumps(status, indent=2), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
