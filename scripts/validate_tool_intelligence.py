#!/usr/bin/env python3
"""Validate the reconciled Web Surfers + Lucas Tool Intelligence stack."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
BASE_ROUTER = ROOT / "scripts" / "tool_intelligence_router.py"
REGISTRY_DIR = ROOT / "data" / "tool-intelligence"
DESIGN_SOURCE = "Design & Creative Tools - (19/06/2026)"


def _load_router():
    spec = importlib.util.spec_from_file_location("tool_intelligence_router", BASE_ROUTER)
    router = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(router)
    return router


def _read_list(name: str) -> list[dict]:
    path = REGISTRY_DIR / name
    data = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(data, list), f"Expected JSON array: {path}"
    return data


def _read_obj(name: str) -> dict:
    path = REGISTRY_DIR / name
    data = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(data, dict), f"Expected JSON object: {path}"
    return data


def _load_source_recovery(coverage: dict) -> list[dict]:
    rows = []
    for rel in coverage["source_recovery_files"]:
        path = ROOT / rel
        payload = json.loads(path.read_text(encoding="utf-8"))
        assert payload.get("creator") == "@lucaswebq"
        rows.extend(payload.get("records", []))
    return rows


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
        DESIGN_SOURCE: 364,
        "Education & Learning Tools (03/07/2026)": 778,
        "Gaming Tools (19/06/2026)": 388,
    }

    invalid_source_rows = {(DESIGN_SOURCE, 40), (DESIGN_SOURCE, 171)}
    assert not any(tuple((tool.get("src") or [None, None])[:2]) in invalid_source_rows for tool in tools)
    assert any(tool["n"] == "Bendito Mockup" and tool["u"].rstrip("/") == "https://benditomockup.com" for tool in tools)
    assert any(tool["n"] == "Sketch Tools" and tool["u"].rstrip("/") == "https://sketchdesign.club" for tool in tools)

    grabcraft = [tool for tool in tools if tool["d"] == "grabcraft.com"]
    assert grabcraft
    assert any((tool.get("src") or [None, None]) == ["Gaming Tools (19/06/2026)", 76] for tool in grabcraft)
    mineflayer = next(tool for tool in tools if tool["n"] == "Mineflayer")
    assert mineflayer["d"] == "github.com" and mineflayer.get("x") is None

    canonical = _read_list("canonical-tools.json")
    probable = _read_list("probable-review.json")
    pending = _read_list("pending-evidence.json")
    coverage = _read_obj("lucas-coverage-351-749.json")
    recovered = _load_source_recovery(coverage)

    assert all(row.get("match_confidence") == "Confirmed" for row in canonical)
    assert all(row.get("match_confidence") == "Probable" for row in probable)
    assert all(row.get("match_confidence") == "Pending" for row in pending)
    for row in pending:
        assert not row.get("website_name")
        assert not row.get("canonical_url")

    confirmed_parts = {int(row["part"]) for row in canonical}
    probable_parts = {int(row["part"]) for row in probable}
    pending_parts = {int(row["part"]) for row in pending}
    recovered_parts = {int(row["part"]) for row in recovered}
    unresolved_parts = recovered_parts - confirmed_parts - probable_parts
    unrecovered_parts = set(map(int, coverage["source_not_recovered_parts"]))

    assert len(recovered_parts) == len(recovered), "duplicate Part in source recovery"
    video_ids = [str(row.get("video_id") or "") for row in recovered]
    assert all(video_id.isdigit() for video_id in video_ids)
    assert len(video_ids) == len(set(video_ids)), "duplicate Lucas video id"
    for row in recovered:
        video_id = str(row["video_id"])
        assert row.get("lucas_source_url") == f"https://www.tiktok.com/@lucaswebq/video/{video_id}"
        assert row.get("caption_hint")

    assert confirmed_parts == set(coverage["confirmed_parts"])
    assert probable_parts == set(coverage["probable_parts"])
    assert unresolved_parts == set(coverage["source_recovered_unresolved_parts"])
    assert pending_parts.issubset(unresolved_parts)

    buckets = [confirmed_parts, probable_parts, unresolved_parts, unrecovered_parts]
    for i, left in enumerate(buckets):
        for right in buckets[i + 1:]:
            assert left.isdisjoint(right), "Lucas coverage buckets overlap"
    assert set().union(*buckets) == set(range(351, 750))

    coverage_counts = coverage["counts"]
    assert coverage_counts == {
        "confirmed": len(confirmed_parts),
        "probable": len(probable_parts),
        "source_recovered_unresolved": len(unresolved_parts),
        "source_recovered_total": len(recovered_parts),
        "source_not_recovered": len(unrecovered_parts),
        "accounted_total": 399,
    }

    by_domain = {tool["d"] for tool in tools}
    assert "ocw.mit.edu" in by_domain
    assert "startmycar.com" in by_domain
    assert "planner5d.com" in by_domain

    print(
        "TOOL_INTELLIGENCE_VALIDATION_OK "
        f"websurfers_records={len(tools)} domains={len(domains)} "
        f"direct_connector_records={direct} lucas_confirmed={len(canonical)} "
        f"lucas_probable={len(probable)} lucas_deep_pending={len(pending)} "
        f"lucas_source_recovered={len(recovered_parts)} lucas_accounted=399"
    )


if __name__ == "__main__":
    main()
