#!/usr/bin/env python3
"""Unified Nicholas-AI-OS tool intelligence router.

Combines private Web Surfers discovery intelligence, strict Lucas provenance,
and runtime execution adapters. Selection and execution are deliberately
separate: a listed site can be recommended without being executable.
"""
from __future__ import annotations

import argparse
import base64
import gzip
import json
import re
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
WS_INDEX = ROOT / "hermes" / "tool_registry" / "websurfers-index.json"
WS_DIR = ROOT / "hermes" / "tool_registry" / "websurfers"
LUCAS_REGISTRY = ROOT / "hermes" / "tool_registry" / "lucas_registry.json"

STOPWORDS = {
    "a","an","and","are","as","at","be","by","can","do","for","from","get","give",
    "i","in","is","it","me","my","of","on","or","please","show","that","the","this",
    "to","tool","tools","use","using","want","with","you","your","find","need","make",
}
CONSTRAINTS = {"free","no-cost","browser","online","web-based","api","mcp","cli"}
LEGACY_EXCLUDED_URLS = {
    "https://benditomockup.com",
    "https://sketchdesign.club",
}
ALIASES = {
    "car": {"vehicle","automotive","tuning","mechanic","fuse","manual"},
    "vehicle": {"car","automotive"},
    "course": {"class","lecture","learning","education","study"},
    "learn": {"course","tutorial","education","study"},
    "guitar": {"music","song","instrument"},
    "piano": {"music","song","instrument"},
    "video": {"editing","clip","reel","short","motion"},
    "reel": {"video","short","clip","social"},
    "image": {"photo","graphic","visual","picture"},
    "design": {"graphic","creative","ui","ux"},
    "3d": {"cad","model","modeling","animation"},
    "cad": {"3d","engineering","model"},
    "terrain": {"map","gis","topography","elevation","lidar"},
    "code": {"developer","programming","software"},
    "programming": {"code","developer","software"},
    "research": {"search","source","evidence","paper"},
    "free": {"no-cost"},
    "calendar": {"schedule","planning"},
    "workflow": {"automation","process","productivity"},
    "website": {"site","web","landing","page"},
}


def _tokens(text: str) -> List[str]:
    vals = re.findall(r"[a-z0-9][a-z0-9.+#-]*", (text or "").lower())
    return [v for v in vals if len(v) > 1 and v not in STOPWORDS]


def _expand(tokens: Iterable[str]) -> set[str]:
    out = set(tokens)
    for token in list(out):
        for alias in ALIASES.get(token, set()):
            out.update(_tokens(alias))
    return out


def _domain(url: str) -> str:
    try:
        d = urlparse(url).netloc.lower()
        return d[4:] if d.startswith("www.") else d
    except Exception:
        return ""


def _valid_http_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
        return parsed.scheme in {"http", "https"} and bool(parsed.netloc)
    except Exception:
        return False


def _connector_for_tool(name: str, url: str, domain: str) -> Optional[str]:
    """Return a direct execution adapter, not merely a related platform.

    Examples of intentionally rejected false positives:
    - github.com/owner/project: GitHub can inspect the repo, but cannot thereby
      execute the project's advertised capability.
    - academy.hubspot.com: HubSpot CRM access is not HubSpot Academy execution.
    - wix.com/logo/maker: the Wix connector does not expose Logo Maker actions.
    """
    mapping = {
        "canva.com": "Canva",
        "figma.com": "Figma",
        "notion.so": "Notion",
        "replit.com": "Replit",
        "heygen.com": "HeyGen",
        "chatgpt.com": "ChatGPT native",
    }
    if domain in mapping:
        return mapping[domain]
    if domain == "github.com":
        parsed = urlparse(url)
        if (parsed.path or "/").rstrip("/") == "" and (name or "").strip().lower() == "github":
            return "GitHub"
    return None


def _source_name_for_base_index(i: int) -> str:
    # Historical compact payload retains two invalid Design rows, so its source
    # boundaries remain 270 / 366 / 778 even though those two rows are filtered.
    if i < 270:
        return "AI Tools (19/06/2026)"
    if i < 270 + 366:
        return "Design & Creative Tools - (19/06/2026)"
    return "Education & Learning Tools (03/07/2026)"


def _standard_tool(
    *,
    item_id: str,
    name: str,
    url: str,
    category: str,
    subcategory: str,
    pricing: str,
    keywords: list[str],
    login: str,
    source: str,
    row: Any,
) -> Optional[Dict[str, Any]]:
    name = (name or "").strip()
    url = (url or "").strip()
    normalized_url = url.rstrip("/").lower()
    if normalized_url in LEGACY_EXCLUDED_URLS:
        return None
    domain = _domain(url)
    if not name or not domain or not _valid_http_url(url):
        return None
    return {
        "id": item_id,
        "n": name,
        "u": url,
        "d": domain,
        "c": category or "",
        "s": subcategory or "",
        "p": pricing if pricing in {"free", "freemium", "paid", "unknown"} else "unknown",
        "k": list(keywords or []),
        "l": login,
        "b": "public_web_candidate",
        "x": _connector_for_tool(name, url, domain),
        "src": [source, row],
    }


def load_websurfers(index_path: Path = WS_INDEX, shard_dir: Path = WS_DIR) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    index = json.loads(index_path.read_text(encoding="utf-8"))
    storage = index.get("storage", {})
    tools: List[Dict[str, Any]] = []

    storage_format = str(storage.get("format", ""))
    if storage_format.startswith("gzip+base64-compact-v2"):
        chunks = []
        for rel in storage.get("payload_parts", []):
            p = ROOT / rel
            if not p.exists():
                p = shard_dir / Path(rel).name
            chunks.append(p.read_text(encoding="utf-8").strip())
        compact = json.loads(gzip.decompress(base64.b64decode("".join(chunks))).decode("utf-8"))
        prices = ["free", "freemium", "paid", "unknown"]
        login = compact.get("login", {})
        for i, rec in enumerate(compact.get("tools", [])):
            name, url, cidx, sidx, pidx, keywords, row = rec
            lcode = login.get(str(i))
            lval = "not_required_claimed" if lcode == 0 else "required_claimed" if lcode == 1 else "unknown"
            item = _standard_tool(
                item_id=f"ws-{i+1:04d}-{re.sub(r'[^a-z0-9]+','-',(name or '').lower()).strip('-')[:40]}",
                name=name,
                url=url,
                category=compact["cats"][cidx] or "",
                subcategory=compact["subs"][sidx] or "",
                pricing=prices[pidx],
                keywords=keywords,
                login=lval,
                source=_source_name_for_base_index(i),
                row=row,
            )
            if item:
                tools.append(item)
    elif storage_format == "gzip+base64":
        chunks = []
        for rel in storage.get("payload_parts", []):
            p = ROOT / rel
            if not p.exists():
                p = shard_dir / Path(rel).name
            chunks.append(p.read_text(encoding="utf-8").strip())
        raw = gzip.decompress(base64.b64decode("".join(chunks)))
        for i, rec in enumerate(json.loads(raw.decode("utf-8")).get("tools", [])):
            item = _standard_tool(
                item_id=rec.get("id") or f"ws-base-{i+1:04d}",
                name=rec.get("n") or "",
                url=rec.get("u") or "",
                category=rec.get("c") or "",
                subcategory=rec.get("s") or "",
                pricing=rec.get("p") or "unknown",
                keywords=rec.get("k") or [],
                login=rec.get("l") or "unknown",
                source=(rec.get("src") or ["historical Web Surfers base", None])[0],
                row=(rec.get("src") or [None, None])[1],
            )
            if item:
                tools.append(item)
    else:
        for shard in index.get("shards", []):
            p = ROOT / shard["path"]
            if not p.exists():
                p = shard_dir / Path(shard["path"]).name
            for rec in json.loads(p.read_text(encoding="utf-8")).get("tools", []):
                item = _standard_tool(
                    item_id=rec.get("id") or f"ws-legacy-{len(tools)+1:04d}",
                    name=rec.get("n") or "",
                    url=rec.get("u") or "",
                    category=rec.get("c") or "",
                    subcategory=rec.get("s") or "",
                    pricing=rec.get("p") or "unknown",
                    keywords=rec.get("k") or [],
                    login=rec.get("l") or "unknown",
                    source=(rec.get("src") or ["legacy Web Surfers shard", None])[0],
                    row=(rec.get("src") or [None, None])[1],
                )
                if item:
                    tools.append(item)

    for rel in storage.get("supplements", []):
        p = ROOT / rel
        if not p.exists():
            p = shard_dir / Path(rel).name
        payload = json.loads(p.read_text(encoding="utf-8"))
        source = payload.get("source") or "Web Surfers supplement"
        for rec in payload.get("records", []):
            item = _standard_tool(
                item_id=f"ws-{len(tools)+1:04d}-{re.sub(r'[^a-z0-9]+','-',(rec.get('n') or '').lower()).strip('-')[:40]}",
                name=rec.get("n") or "",
                url=rec.get("u") or "",
                category=rec.get("c") or "",
                subcategory=rec.get("s") or "",
                pricing=rec.get("p") or "unknown",
                keywords=rec.get("k") or [],
                login=rec.get("l") or "unknown",
                source=source,
                row=rec.get("row"),
            )
            if item:
                tools.append(item)

    expected = int(index.get("counts", {}).get("tool_records", 0))
    if expected and len(tools) != expected:
        raise ValueError(f"Web Surfers registry count mismatch: expected {expected}, got {len(tools)}")
    return index, tools


def load_lucas(path: Path = LUCAS_REGISTRY) -> Dict[str, Any]:
    if not path.exists():
        return {"tools": []}
    data = json.loads(path.read_text(encoding="utf-8"))
    creator = data.get("source_range", {}).get("creator")
    if creator and creator != "@lucaswebq":
        raise ValueError("Lucas registry provenance mismatch")
    return data


def build_lucas_domain_index(lucas: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
    out: Dict[str, List[Dict[str, Any]]] = {}
    for tool in lucas.get("tools", []):
        d = _domain(tool.get("canonical_url", ""))
        if d:
            out.setdefault(d, []).append(tool)
    return out


def detect_intent(request: str) -> Dict[str, bool]:
    r = request.lower()
    return {
        "wants_free": bool(re.search(r"\b(free|no cost|without paying)\b", r)),
        "wants_no_login": bool(re.search(r"\b(no login|no account|without (?:an )?account|no signup|no sign-up)\b", r)),
        "wants_browser": bool(re.search(r"\b(browser|web based|web-based|online)\b", r)),
        "wants_api": bool(re.search(r"\bapi\b", r)),
        "wants_mcp": bool(re.search(r"\bmcp\b", r)),
        "wants_cli": bool(re.search(r"\b(cli|command line|terminal)\b", r)),
        "wants_execute": bool(re.search(r"\b(do it|execute|run|create|send|post|publish|build|edit|update|upload|book|schedule)\b", r)),
    }


def score_websurfers(request: str, tool: Dict[str, Any], intent: Dict[str, bool]) -> Tuple[float, List[str]]:
    raw_req = set(_tokens(request))
    semantic_raw = raw_req - CONSTRAINTS
    if not semantic_raw:
        return 0.0, []

    name = tool.get("n") or ""
    raw_name = set(_tokens(name))
    raw_cat = set(_tokens(f"{tool.get('c') or ''} {tool.get('s') or ''}"))
    raw_kw = set(tool.get("k") or []) - CONSTRAINTS
    raw_tool = raw_name | raw_cat | raw_kw
    raw_overlap = semantic_raw & raw_tool
    exact_name = name.lower().strip()
    exact_name_hit = bool(exact_name and re.search(r"(?<![a-z0-9])" + re.escape(exact_name) + r"(?![a-z0-9])", request.lower()))

    named_acronyms = {
        token.lower()
        for token in re.findall(r"\b[A-Z][A-Z0-9]{1,6}\b", request)
        if token.lower() not in {"ai", "api", "mcp", "cli", "ui", "ux"}
    }
    if named_acronyms and not (named_acronyms & raw_tool):
        return 0.0, []

    required_overlap = 3 if len(semantic_raw) >= 5 else 2 if len(semantic_raw) >= 3 else 1
    if len(raw_overlap) < required_overlap and not exact_name_hit:
        return 0.0, []

    score = 0.0
    why: List[str] = []
    if exact_name_hit:
        score += 12.0
        why.append("exact tool-name match")
    acronym_overlap = named_acronyms & raw_tool
    if acronym_overlap:
        score += 6.0 * len(acronym_overlap)
        why.append("named entity match: " + ", ".join(sorted(acronym_overlap)))
    name_overlap = semantic_raw & raw_name
    if name_overlap:
        score += 5.0 * len(name_overlap)
        why.append("name match: " + ", ".join(sorted(name_overlap)[:5]))
    cat_overlap = semantic_raw & raw_cat
    if cat_overlap:
        score += 2.25 * len(cat_overlap)
        why.append("category match: " + ", ".join(sorted(cat_overlap)[:5]))
    kw_overlap = semantic_raw & raw_kw
    if kw_overlap:
        score += 2.0 * len(kw_overlap)
        why.append("capability match: " + ", ".join(sorted(kw_overlap)[:6]))
    alias_overlap = (_expand(semantic_raw) - semantic_raw) & raw_tool
    if alias_overlap:
        score += 0.35 * min(5, len(alias_overlap))
        why.append("related capability: " + ", ".join(sorted(alias_overlap)[:4]))

    pricing = tool.get("p")
    if intent["wants_free"]:
        if pricing == "free":
            score += 4.0
            why.append("free")
        elif pricing == "freemium":
            score += 1.5
            why.append("freemium")
        elif pricing == "paid":
            score -= 6.0
    if intent["wants_no_login"]:
        if tool.get("l") == "not_required_claimed":
            score += 5.0
            why.append("directory explicitly indicates no account")
        elif tool.get("l") == "required_claimed":
            score -= 5.0
    if intent["wants_browser"] and tool.get("b") == "public_web_candidate":
        score += 2.5
        why.append("browser-based")
    connector = tool.get("x")
    if connector:
        score += 0.5
        why.append(f"direct connector available: {connector}")
        if intent["wants_execute"]:
            score += 2.0
    if intent["wants_api"] or intent["wants_mcp"] or intent["wants_cli"]:
        score -= 0.5
    return round(score, 3), why


def _lucas_links(domain: str, domain_index: Dict[str, List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    return [
        {
            "part": item.get("part"),
            "confidence": item.get("match_confidence"),
            "route_enabled": item.get("route_enabled") is True,
            "tool_id": item.get("tool_id"),
        }
        for item in domain_index.get(domain, [])
    ]


def route(request: str, limit: int = 5, include_paid: bool = True, runtime_adapters: Optional[set[str]] = None) -> Dict[str, Any]:
    index, ws_tools = load_websurfers()
    lucas_domains = build_lucas_domain_index(load_lucas())
    intent = detect_intent(request)
    scored = []
    for tool in ws_tools:
        if not include_paid and tool.get("p") == "paid":
            continue
        score, why = score_websurfers(request, tool, intent)
        if score <= 0:
            continue
        links = _lucas_links(tool.get("d") or "", lucas_domains)
        if any(l["confidence"] == "Confirmed" and l["route_enabled"] for l in links):
            score += 4.0
            why.append("independently Confirmed Lucas mapping")
        scored.append((score, tool, why, links))

    scored.sort(
        key=lambda x: (x[0], x[1].get("x") is not None, x[1].get("p") == "free", -len(x[1].get("n") or "")),
        reverse=True,
    )

    results = []
    seen = set()
    for score, tool, why, links in scored:
        key = (tool.get("u") or "").rstrip("/").lower()
        if key in seen:
            continue
        seen.add(key)
        connector = tool.get("x")
        live = bool(connector and runtime_adapters and connector in runtime_adapters)
        mode = "execute_direct" if live and intent["wants_execute"] else "select_direct" if live else "connector_candidate" if connector else "research_or_browser"
        verified_lucas_parts = [l["part"] for l in links if l["confidence"] == "Confirmed" and l["route_enabled"]]
        review_lucas_parts = [l["part"] for l in links if l["confidence"] == "Probable"]
        results.append({
            "score": round(score, 3),
            "mode": mode,
            "can_execute_now": live,
            "tool_id": tool.get("id"),
            "website_name": tool.get("n"),
            "canonical_url": tool.get("u"),
            "domain": tool.get("d"),
            "category": tool.get("c"),
            "subcategory": tool.get("s"),
            "pricing": tool.get("p"),
            "direct_connector": connector,
            "runtime_adapter_live": live,
            "reason": why,
            "lucas_confirmed_parts": verified_lucas_parts,
            "lucas_review_only_parts": review_lucas_parts,
            "source": {
                "type": "Web Surfers paid directory",
                "spreadsheet": (tool.get("src") or [None, None])[0],
                "row": (tool.get("src") or [None, None])[1],
            },
        })
        if len(results) >= max(1, limit):
            break

    if not results:
        return {
            "status": "no_match",
            "request": request,
            "intent": intent,
            "message": "No sufficiently relevant paid-directory tool matched. Use web research or add/enrich a registry entry; do not invent a tool or Lucas Part.",
            "results": [],
        }
    return {
        "status": "matched",
        "request": request,
        "intent": intent,
        "registry_counts": index.get("counts", {}),
        "primary": results[0],
        "fallbacks": results[1:],
        "results": results,
        "execution_note": "Selection is automatic. Execution is automatic only when can_execute_now=true and the runtime/user policy permits the requested action.",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Route a request across Web Surfers + Lucas tool intelligence.")
    parser.add_argument("request", nargs="+")
    parser.add_argument("--limit", type=int, default=5)
    parser.add_argument("--exclude-paid", action="store_true")
    parser.add_argument("--runtime-adapters", default="", help="Comma-separated adapters actually live in this runtime.")
    args = parser.parse_args()
    runtime = {x.strip() for x in args.runtime_adapters.split(",") if x.strip()} or None
    print(json.dumps(route(" ".join(args.request), limit=args.limit, include_paid=not args.exclude_paid, runtime_adapters=runtime), indent=2))


if __name__ == "__main__":
    main()
