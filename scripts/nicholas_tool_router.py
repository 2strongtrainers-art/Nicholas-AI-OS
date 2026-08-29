#!/usr/bin/env python3
"""Canonical Nicholas-AI-OS tool router.

This module reconciles the paid Web Surfers discovery catalog with the Tool
Intelligence subsystem already merged to main.

Source-of-truth policy:
- Web Surfers: candidate tool identity/capability discovery.
- data/tool-intelligence/canonical-tools.json: Confirmed Lucas mappings.
- data/tool-intelligence/probable-review.json: review-only Lucas mappings.
- data/tool-intelligence/pending-evidence.json: unresolved evidence only.

The paid directory never upgrades a Probable/Pending Lucas mapping to
Confirmed and never makes an interface executable by itself.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
from typing import Any, Dict, Optional

ROOT = Path(__file__).resolve().parents[1]
BASE_ROUTER = ROOT / "scripts" / "tool_intelligence_router.py"
REGISTRY_DIR = ROOT / "data" / "tool-intelligence"


def _load_base_router():
    spec = importlib.util.spec_from_file_location("websurfers_base_router", BASE_ROUTER)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(module)
    return module


def _read_array(name: str) -> list[dict[str, Any]]:
    path = REGISTRY_DIR / name
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError(f"Expected JSON array: {path}")
    return data


def load_canonical_lucas() -> Dict[str, Any]:
    """Adapt main's Tool Intelligence registries to the Web Surfers router.

    Confirmed records are routable as provenance claims. Probable records are
    visible only as review links. Pending records have no canonical domain and
    therefore are intentionally not injected into domain routing.
    """
    tools: list[dict[str, Any]] = []

    for record in _read_array("canonical-tools.json"):
        item = dict(record)
        item["route_enabled"] = True
        item["tool_id"] = f"lucas-{record.get('part')}-confirmed"
        tools.append(item)

    for record in _read_array("probable-review.json"):
        item = dict(record)
        item["route_enabled"] = False
        item["tool_id"] = f"lucas-{record.get('part')}-probable"
        tools.append(item)

    return {
        "source": "data/tool-intelligence",
        "creator": "@lucaswebq",
        "tools": tools,
        "pending_count": len(_read_array("pending-evidence.json")),
    }


def route(
    request: str,
    limit: int = 5,
    include_paid: bool = True,
    runtime_adapters: Optional[set[str]] = None,
) -> Dict[str, Any]:
    base = _load_base_router()
    # The base router calls load_lucas dynamically, so replace only that adapter.
    # This keeps the paid-catalog ranking engine independent from Lucas storage.
    base.load_lucas = load_canonical_lucas
    result = base.route(
        request,
        limit=limit,
        include_paid=include_paid,
        runtime_adapters=runtime_adapters,
    )
    result["provenance_policy"] = {
        "websurfers": "candidate discovery",
        "lucas_confirmed": "data/tool-intelligence/canonical-tools.json",
        "lucas_probable": "review only",
        "lucas_pending": "evidence only",
        "execution": "requires a live runtime adapter plus normal action policy",
    }
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Route a task across the Nicholas-AI-OS tool intelligence stack.")
    parser.add_argument("request", nargs="+")
    parser.add_argument("--limit", type=int, default=5)
    parser.add_argument("--exclude-paid", action="store_true")
    parser.add_argument(
        "--runtime-adapters",
        default="",
        help="Comma-separated adapters actually live in the current runtime, e.g. Canva,GitHub,Notion.",
    )
    args = parser.parse_args()
    runtime = {x.strip() for x in args.runtime_adapters.split(",") if x.strip()} or None
    print(
        json.dumps(
            route(
                " ".join(args.request),
                limit=args.limit,
                include_paid=not args.exclude_paid,
                runtime_adapters=runtime,
            ),
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
