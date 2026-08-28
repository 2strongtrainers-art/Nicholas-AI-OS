"""Deterministic ingestion and read-only routing for Tool Intelligence data."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlparse

CONFIDENCE_RANK = {"Pending": 0, "Probable": 1, "Confirmed": 2}
REQUIRED_FIELDS = {"part", "lucas_source_url", "video_id", "match_confidence", "api_available", "mcp_available", "cli_available", "evidence_sources"}
STRUCTURED_CAPABILITIES = ("api_available", "mcp_available", "cli_available")


@dataclass(frozen=True)
class ImportSummary:
    parsed: int
    confirmed: int
    probable: int
    pending: int
    canonical_total: int
    review_total: int
    evidence_total: int


def _read_json(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError(f"Registry must contain a JSON array: {path}")
    return data


def _write_json(path: Path, records: Iterable[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    ordered = sorted(records, key=lambda item: (int(item.get("part", 0)), item.get("canonical_url", "")))
    path.write_text(json.dumps(ordered, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _valid_http_url(value: str, *, allow_empty: bool = False) -> bool:
    if not value:
        return allow_empty
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def normalize_domain(url: str) -> str:
    hostname = (urlparse(url).hostname or "").lower() if url else ""
    return hostname.removeprefix("www.")


def _validate_record(record: dict[str, Any]) -> None:
    missing = REQUIRED_FIELDS - record.keys()
    if missing:
        raise ValueError(f"Part {record.get('part', '?')} missing fields: {sorted(missing)}")
    if not isinstance(record["part"], int) or record["part"] <= 0:
        raise ValueError("Part must be a positive integer")
    confidence = record["match_confidence"]
    if confidence not in CONFIDENCE_RANK:
        raise ValueError(f"Part {record['part']} has invalid confidence: {confidence}")
    if not _valid_http_url(record["lucas_source_url"]):
        raise ValueError(f"Part {record['part']} has invalid Lucas source URL")
    canonical = record.get("canonical_url", "")
    if confidence != "Pending" and not _valid_http_url(canonical):
        raise ValueError(f"Part {record['part']} requires a canonical URL")
    if confidence == "Pending" and (record.get("website_name") or canonical):
        raise ValueError(f"Pending Part {record['part']} must not speculate about a website")
    if not isinstance(record["evidence_sources"], list) or not record["evidence_sources"]:
        raise ValueError(f"Part {record['part']} requires evidence sources")
    if any(not _valid_http_url(source) for source in record["evidence_sources"]):
        raise ValueError(f"Part {record['part']} has invalid evidence URL")
    for field in STRUCTURED_CAPABILITIES:
        if record[field] not in {"Yes", "No", "Unknown"}:
            raise ValueError(f"Part {record['part']} has invalid {field}: {record[field]}")


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    seen_parts: set[int] = set()
    seen_provenance: set[tuple[str, str]] = set()
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            record = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSONL line {line_number}: {exc}") from exc
        _validate_record(record)
        provenance = (record["lucas_source_url"], str(record["video_id"]))
        if record["part"] in seen_parts:
            raise ValueError(f"Duplicate Part in source: {record['part']}")
        if provenance in seen_provenance:
            raise ValueError(f"Duplicate source/video provenance in source: {provenance}")
        seen_parts.add(record["part"])
        seen_provenance.add(provenance)
        enriched = dict(record)
        enriched["normalized_domain"] = normalize_domain(record.get("canonical_url", ""))
        enriched["provenance"] = {"source": "hermes", "lucas_source_url": record["lucas_source_url"], "video_id": str(record["video_id"])}
        records.append(enriched)
    return records


def _same_tool(left: dict[str, Any], right: dict[str, Any]) -> bool:
    pairs = (
        (left.get("part"), right.get("part")),
        (str(left.get("video_id", "")), str(right.get("video_id", ""))),
        (left.get("lucas_source_url"), right.get("lucas_source_url")),
        (left.get("canonical_url"), right.get("canonical_url")),
        (left.get("normalized_domain"), right.get("normalized_domain")),
        ((left.get("website_name") or "").casefold(), (right.get("website_name") or "").casefold()),
    )
    return any(a not in (None, "") and a == b for a, b in pairs)


def _merge_preserving_stronger(existing: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
    existing_rank = CONFIDENCE_RANK.get(existing.get("match_confidence", "Pending"), -1)
    incoming_rank = CONFIDENCE_RANK[incoming["match_confidence"]]
    if existing_rank > incoming_rank:
        merged = {**incoming, **existing}
    else:
        merged = dict(existing)
        merged.update({key: value for key, value in incoming.items() if value not in (None, "", [])})
    sources = list(dict.fromkeys([*existing.get("evidence_sources", []), *incoming.get("evidence_sources", [])]))
    if sources:
        merged["evidence_sources"] = sources
    return merged


def _upsert(records: list[dict[str, Any]], incoming: dict[str, Any]) -> None:
    matches = [index for index, record in enumerate(records) if _same_tool(record, incoming)]
    if not matches:
        records.append(incoming)
        return
    first = matches[0]
    records[first] = _merge_preserving_stronger(records[first], incoming)
    for index in reversed(matches[1:]):
        records[first] = _merge_preserving_stronger(records[first], records[index])
        del records[index]


def _take_matches(records: list[dict[str, Any]], incoming: dict[str, Any]) -> list[dict[str, Any]]:
    matches = [record for record in records if _same_tool(record, incoming)]
    records[:] = [record for record in records if not _same_tool(record, incoming)]
    return matches


def import_hermes_evidence(source: Path, registry_dir: Path) -> ImportSummary:
    incoming = load_jsonl(source)
    paths = {
        "Confirmed": registry_dir / "canonical-tools.json",
        "Probable": registry_dir / "probable-review.json",
        "Pending": registry_dir / "pending-evidence.json",
    }
    registries = {confidence: _read_json(path) for confidence, path in paths.items()}
    for record in incoming:
        # A lower-confidence import must enrich, not duplicate or downgrade, an
        # already-canonical service.
        if any(_same_tool(existing, record) for existing in registries["Confirmed"]):
            _upsert(registries["Confirmed"], record)
            continue

        confidence = record["match_confidence"]
        promoted = record
        if confidence == "Confirmed":
            lower_matches = [
                *_take_matches(registries["Probable"], record),
                *_take_matches(registries["Pending"], record),
            ]
            for lower in lower_matches:
                promoted = _merge_preserving_stronger(lower, promoted)
        elif confidence == "Probable":
            for lower in _take_matches(registries["Pending"], record):
                promoted = _merge_preserving_stronger(lower, promoted)
        _upsert(registries[confidence], promoted)
    for confidence, path in paths.items():
        _write_json(path, registries[confidence])
    counts = {key: sum(row["match_confidence"] == key for row in incoming) for key in CONFIDENCE_RANK}
    return ImportSummary(len(incoming), counts["Confirmed"], counts["Probable"], counts["Pending"], len(registries["Confirmed"]), len(registries["Probable"]), len(registries["Pending"]))


def search_tools(registry_dir: Path, query: str) -> list[dict[str, Any]]:
    """Search confirmed tools only; structured interfaces remain evidence-backed."""
    tokens = set(re.findall(r"[a-z0-9]+", query.casefold()))
    matches: list[tuple[int, dict[str, Any]]] = []
    for record in _read_json(registry_dir / "canonical-tools.json"):
        haystack = " ".join(str(record.get(field, "")) for field in ("website_name", "current_function", "access_type", "agent_accessible")).casefold()
        score = sum(token in haystack for token in tokens)
        if score:
            routed = dict(record)
            public = any(word in record.get("access_type", "").casefold() for word in ("free", "public"))
            routed["route"] = {
                "mode": "public_web" if public else "website",
                "structured_interfaces": {"api": record.get("api_available", "Unknown"), "mcp": record.get("mcp_available", "Unknown"), "cli": record.get("cli_available", "Unknown")},
            }
            matches.append((score, routed))
    return [record for _, record in sorted(matches, key=lambda item: (-item[0], item[1]["website_name"]))]
