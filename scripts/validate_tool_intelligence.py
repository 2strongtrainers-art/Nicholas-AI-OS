#!/usr/bin/env python3
"""Validate Web Surfers + Lucas tool-intelligence invariants."""
from __future__ import annotations
import importlib.util, json
from pathlib import Path
from urllib.parse import urlparse

ROOT=Path(__file__).resolve().parents[1]
ROUTER=ROOT/"scripts"/"tool_intelligence_router.py"
LUCAS=ROOT/"hermes"/"tool_registry"/"lucas_registry.json"

def main():
    spec=importlib.util.spec_from_file_location("tool_intelligence_router",ROUTER)
    router=importlib.util.module_from_spec(spec); assert spec.loader
    spec.loader.exec_module(router)
    idx,tools=router.load_websurfers()
    counts=idx["counts"]
    assert len(tools)==counts["tool_records"]==1414
    ids=[t["id"] for t in tools]
    assert len(ids)==len(set(ids)), "duplicate tool ids"
    domains={t["d"] for t in tools}
    assert len(domains)==counts["unique_domains"]==1173
    assert sum(counts["pricing"].values())==1414
    assert counts["pricing"]=={"free":856,"freemium":496,"paid":58,"unspecified":4}
    allowed_prices={"free","freemium","paid","unknown"}
    direct=0
    for t in tools:
        assert t["n"] and t["u"] and t["d"]
        assert urlparse(t["u"]).scheme=="https", f"non-https URL: {t['u']}"
        assert t["p"] in allowed_prices
        if t.get("x"): direct+=1
    assert direct==counts["direct_connector_records_current_chatgpt"]==40
    if LUCAS.exists():
        lucas=json.loads(LUCAS.read_text(encoding="utf-8"))
        assert lucas.get("source_range",{}).get("creator")=="@lucaswebq"
        for t in lucas.get("tools",[]):
            if t.get("match_confidence")!="Confirmed":
                assert t.get("route_enabled") is not True, f"unsafe Lucas route: {t.get('part')}"
    print(f"TOOL_INTELLIGENCE_VALIDATION_OK records={len(tools)} domains={len(domains)} free=856 freemium=496 paid=58 direct_connector_records={direct}")

if __name__=="__main__":
    main()
