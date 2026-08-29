#!/usr/bin/env python3
"""Validate the reconciled four-sheet Web Surfers + canonical Tool Intelligence stack."""
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

    assert len(tools) == counts["tool_records"] == 1800
    ids = [t["id"] for t in tools]
    assert len(ids) == len(set(ids)), "duplicate Web Surfers tool ids"
    domains = {t["d"] for t in tools}
    assert len(domains) == counts["unique_domains"] == 1501
    assert counts["categories"] == 33
    assert counts["subcategories"] == 163
    assert sum(counts["pricing"].values()) == 1800
    assert counts["pricing"] == {"free": 1204, "freemium": 530, "paid": 63, "unspecified": 3}

    allowed_prices = {"free", "freemium", "paid", "unknown"}
    direct = 0
    for tool in tools:
        assert tool["n"] and tool["u"] and tool["d"]
        parsed = urlparse(tool["u"])
        assert parsed.scheme in {"http", "https"} and parsed.netloc, f"invalid URL: {tool['u']}"
        assert tool["p"] in allowed_prices
        if tool.get("x"):
            direct += 1
    assert direct == counts["direct_connector_records_current_chatgpt"] == 21
    assert counts["connector_candidate_records_current_chatgpt"] == 64

    source_counts = {}
    for tool in tools:
        source = (tool.get("src") or [None, None])[0]
        source_counts[source] = source_counts.get(source, 0) + 1
    assert source_counts == {
        "AI Tools (19/06/2026)": 270,
        "Design & Creative Tools - (19/06/2026)": 364,
        "Education & Learning Tools (03/07/2026)": 778,
        "Gaming Tools (19/06/2026)": 388,
    }

    # The two historical URL-only Design rows must never become routable tools.
    assert all(tool["n"] for tool in tools)
    assert not any(tool["u"].rstrip("/") == "https://benditomockup.com" for tool in tools)
    assert not any(tool["u"].rstrip("/") == "https://sketchdesign.club" for tool in tools)

    # Gaming supplement and provenance check.
    grabcraft = [tool for tool in tools if tool["d"] == "grabcraft.com"]
    assert grabcraft
    assert any((tool.get("src") or [None, None]) == ["Gaming Tools (19/06/2026)", 76] for tool in grabcraft)

    # GitHub-hosted projects are selectable but are not direct execution adapters.
    mineflayer = next(tool for tool in tools if tool["n"] == "Mineflayer")
    assert mineflayer["d"] == "github.com" and mineflayer.get("x") is None

    canonical = _read("canonical-tools.json")
    probable = _read("probable-review.json")
    pending = _read("pending-evidence.json")
    assert all(row.get("match_confidence") == "Confirmed" for row in canonical)
    assert all(row.get("match_confidence") == "Probable" for row in probable)
    assert all(row.get("match_confidence") == "Pending" for row in pending)

    all_parts = [row["part"] for row in canonical + probable + pending]
    assert len(all_parts) == len(set(all_parts)), "Lucas Part appears in more than one confidence registry"
    assert all(351 <= int(part) <= 749 for part in all_parts)
    for row in pending:
        assert not row.get("website_name")
        assert not row.get("canonical_url")

    by_domain = {tool["d"] for tool in tools}
    assert "ocw.mit.edu" in by_domain
    assert "startmycar.com" in by_domain
    assert "planner5d.com" in by_domain

    print(
        "TOOL_INTELLIGENCE_VALIDATION_OK "
        f"websurfers_records={len(tools)} domains={len(domains)} "
        f"direct_connector_records={direct} lucas_confirmed={len(canonical)} "
        f"lucas_probable={len(probable)} lucas_pending={len(pending)}"
    )


if __name__ == "__main__":
    main()
