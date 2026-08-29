#!/usr/bin/env python3
"""Validate the reconciled Web Surfers + canonical Tool Intelligence stack."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
BASE_ROUTER = ROOT / "scripts" / "tool_intelligence_router.py"
REGISTRY_DIR = ROOT / "data" / "tool-intelligence"


def _load_router():
    spec = importlib.util.spec_from_file_location("tool_intelligence_router", BASE_ROUTER)
    router = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(router)
    return router


def _read(name: str) -> list[dict]:
    path = REGISTRY_DIR / name
    data = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(data, list), f"Expected JSON array: {path}"
    return data


def main() -> None:
    router = _load_router()
    idx, tools = router.load_websurfers()
    counts = idx["counts"]

    assert len(tools) == counts["tool_records"] == 1414
    ids = [t["id"] for t in tools]
    assert len(ids) == len(set(ids)), "duplicate Web Surfers tool ids"
    domains = {t["d"] for t in tools}
    assert len(domains) == counts["unique_domains"] == 1173
    assert sum(counts["pricing"].values()) == 1414
    assert counts["pricing"] == {"free": 856, "freemium": 496, "paid": 58, "unspecified": 4}

    allowed_prices = {"free", "freemium", "paid", "unknown"}
    direct = 0
    for tool in tools:
        assert tool["n"] and tool["u"] and tool["d"]
        parsed = urlparse(tool["u"])
        assert parsed.scheme == "https" and parsed.netloc, f"invalid URL: {tool['u']}"
        assert tool["p"] in allowed_prices
        if tool.get("x"):
            direct += 1
    assert direct == counts["direct_connector_records_current_chatgpt"] == 40

    canonical = _read("canonical-tools.json")
    probable = _read("probable-review.json")
    pending = _read("pending-evidence.json")
    assert all(row.get("match_confidence") == "Confirmed" for row in canonical)
    assert all(row.get("match_confidence") == "Probable" for row in probable)
    assert all(row.get("match_confidence") == "Pending" for row in pending)

    all_parts = [row["part"] for row in canonical + probable + pending]
    assert len(all_parts) == len(set(all_parts)), "Lucas Part appears in more than one confidence registry"
    assert all(351 <= int(part) <= 749 for part in all_parts)

    # Pending evidence must never acquire a speculative website identity merely
    # because a paid-directory candidate looks similar.
    for row in pending:
        assert not row.get("website_name")
        assert not row.get("canonical_url")

    # Known paid-directory cross-checks. Not every canonical Lucas tool is in the
    # three currently available paid category sheets, so only require proven overlaps.
    by_domain = {tool["d"] for tool in tools}
    assert "ocw.mit.edu" in by_domain
    assert "startmycar.com" in by_domain

    print(
        "TOOL_INTELLIGENCE_VALIDATION_OK "
        f"websurfers_records={len(tools)} domains={len(domains)} "
        f"direct_connector_records={direct} lucas_confirmed={len(canonical)} "
        f"lucas_probable={len(probable)} lucas_pending={len(pending)}"
    )


if __name__ == "__main__":
    main()
