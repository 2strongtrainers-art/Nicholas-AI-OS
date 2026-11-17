"""Evidence-first ARGUS event graph validator/exporter (public code; private data stays local).

This is a quality gate, not a fact-checker. Event-event links are NOT inferred
from proximity, shared sources, headlines, or graph algorithms.
"""
from __future__ import annotations
import argparse
import json
from datetime import date, datetime
from pathlib import Path
from urllib.parse import urlsplit

SCHEMA = "argus.event-graph.v1"
TYPES = {"Shared subject", "Temporal sequence", "Documented interaction", "Hypothesis"}
REVIEWS = {"candidate", "reviewed", "rejected"}
CONFIDENCE = {"unassessed", "low", "moderate", "high"}


class GraphIntegrityError(ValueError):
    def __init__(self, errors):
        self.errors = errors
        super().__init__("\n".join(errors))


def _iso_date(value):
    try:
        return date.fromisoformat(value)
    except (ValueError, TypeError):
        return None


def _valid_url(value):
    try:
        parsed = urlsplit(value)
        return parsed.scheme == "https" and bool(parsed.netloc) and not parsed.username
    except (TypeError, ValueError):
        return False


def validate_graph(doc):
    """Fail closed on malformed references, chronology and unsupported link promotion."""
    problems = []
    if not isinstance(doc, dict):
        raise GraphIntegrityError(["root: expected a JSON object"])
    if doc.get("schema") != SCHEMA:
        problems.append("schema: expected " + SCHEMA)
    try:
        cutoff = datetime.fromisoformat(str(doc["cutoff"]).replace("Z", "+00:00"))
        if cutoff.utcoffset() is None:
            raise ValueError("naive cutoff")
        cutoff_day = cutoff.date()
    except (KeyError, TypeError, ValueError):
        problems.append("cutoff: timezone-aware ISO 8601 timestamp required")
        cutoff_day = None

    sources, events, links = doc.get("sources"), doc.get("events"), doc.get("relationships")
    for name, value in (("sources", sources), ("events", events), ("relationships", links)):
        if not isinstance(value, list):
            problems.append(name + ": expected array")
    if problems:
        raise GraphIntegrityError(problems)
    if len(sources) > 10000 or len(events) > 10000 or len(links) > 50000:
        raise GraphIntegrityError(["limit: graph exceeds bounded input sizes"])
    source_by_id, event_by_id = {}, {}

    for i, s in enumerate(sources):
        key = "sources[" + str(i) + "]"
        if not isinstance(s, dict):
            problems.append(key + ": expected object")
            continue
        sid = s.get("id")
        if not isinstance(sid, str) or not sid.strip() or sid in source_by_id:
            problems.append(key + ": empty or duplicate source id")
        else:
            source_by_id[sid] = s
        if not _valid_url(s.get("url")):
            problems.append(key + ": source URL must be absolute HTTPS")
        if not isinstance(s.get("publisher_family"), str) or not s["publisher_family"].strip():
            problems.append(key + ": publisher_family required for independence checks")
        if not isinstance(s.get("title"), str) or not s["title"].strip():
            problems.append(key + ": title required")

    for i, ev in enumerate(events):
        key = "events[" + str(i) + "]"
        if not isinstance(ev, dict):
            problems.append(key + ": expected object")
            continue
        eid = ev.get("id")
        if not isinstance(eid, str) or not eid.strip() or eid in event_by_id:
            problems.append(key + ": empty or duplicate event id")
        else:
            event_by_id[eid] = ev
        start = _iso_date(ev.get("occurred_on"))
        finish = _iso_date(ev.get("occurred_to", ev.get("occurred_on")))
        if not start or not finish or start > finish:
            problems.append(key + ": invalid event date/range")
        elif cutoff_day and start > cutoff_day:
            problems.append(key + ": event occurs after cutoff")
        if ev.get("precision") not in ("day", "range", "uncertain"):
            problems.append(key + ": precision must be day/range/uncertain")
        for field in ("title", "summary", "review_status"):
            if not isinstance(ev.get(field), str) or not ev[field].strip():
                problems.append(key + ": " + field + " required")
        ids = ev.get("source_ids")
        if not isinstance(ids, list) or not ids or len(ids) != len(set(map(str, ids))):
            problems.append(key + ": must have distinct supporting source_ids")
        else:
            for sid in ids:
                if sid not in source_by_id:
                    problems.append(key + ": orphan source_id " + str(sid))
        tags = ev.get("tags")
        if not isinstance(tags, list) or any(not isinstance(t, str) or not t.strip() for t in tags):
            problems.append(key + ": tags must be string array")

    link_ids, triples = set(), set()
    for i, link in enumerate(links):
        key = "relationships[" + str(i) + "]"
        if not isinstance(link, dict):
            problems.append(key + ": expected object")
            continue
        lid = link.get("id")
        if not isinstance(lid, str) or not lid or lid in link_ids:
            problems.append(key + ": empty or duplicate relationship id")
        link_ids.add(lid)
        a, b, kind = link.get("source_event_id"), link.get("target_event_id"), link.get("type")
        if kind not in TYPES:
            problems.append(key + ": disallowed relationship type (no implicit causal edges)")
        if a not in event_by_id or b not in event_by_id or a == b:
            problems.append(key + ": dangling or self-referential event endpoints")
            continue
        triple = (a, b, kind)
        if triple in triples:
            problems.append(key + ": duplicate typed event pair")
        triples.add(triple)
        review = link.get("review_status")
        if review not in REVIEWS:
            problems.append(key + ": review_status must be candidate/reviewed/rejected")
        if link.get("confidence") not in CONFIDENCE:
            problems.append(key + ": confidence enum required")
        if not isinstance(link.get("assertion"), str) or len(link["assertion"].strip()) < 15:
            problems.append(key + ": informative assertion required")
        ids = link.get("source_ids")
        if not isinstance(ids, list) or not ids:
            problems.append(key + ": at least one attributable source_id required")
            ids = []
        families = set()
        for sid in ids:
            if sid not in source_by_id:
                problems.append(key + ": orphan relationship source " + str(sid))
            else:
                families.add(source_by_id[sid]["publisher_family"].casefold().strip())
        aa, bb = event_by_id[a], event_by_id[b]
        # Link citations must be attributable to one of the events at its endpoints.
        # Valid URLs and shared topics alone cannot justify importing unrelated sources.
        endpoint_sources = set(aa.get("source_ids", [])) | set(bb.get("source_ids", []))
        if not set(ids).issubset(endpoint_sources):
            problems.append(key + ": relationship sources are not cited by endpoint events")
        shared = set(aa.get("tags", [])) & set(bb.get("tags", []))
        if kind in ("Shared subject", "Temporal sequence") and not shared:
            problems.append(key + ": no shared controlled context tags; unrelated-event link blocked")
        if kind == "Temporal sequence" and _iso_date(aa.get("occurred_on")) and _iso_date(bb.get("occurred_on")):
            if _iso_date(aa["occurred_on"]) > _iso_date(bb["occurred_on"]):
                problems.append(key + ": reversed temporal sequence")
        if kind == "Documented interaction" and (review != "reviewed" or len(families) < 2):
            problems.append(key + ": documented interaction requires reviewed status and >=2 source families")
        if kind == "Hypothesis" and review != "candidate":
            problems.append(key + ": hypotheses cannot be promoted to established links automatically")
        if kind in ("Shared subject", "Temporal sequence") and review == "reviewed" and len(families) < 2:
            problems.append(key + ": reviewed links require >=2 source families")
    if problems:
        raise GraphIntegrityError(problems)
    return {"events": len(events), "sources": len(sources), "event_links": len(links),
            "evidence_edges": sum(len(e["source_ids"]) for e in events),
            "candidate_links": sum(x["review_status"] == "candidate" for x in links),
            "reviewed_links": sum(x["review_status"] == "reviewed" for x in links)}


def to_networkx(doc):
    """Use pinned NetworkX to preserve direction and multiple evidence edges."""
    validate_graph(doc)
    import networkx as nx
    graph = nx.MultiDiGraph(schema=SCHEMA, cutoff=doc["cutoff"])
    for s in doc["sources"]:
        graph.add_node(s["id"], kind="source", label=s["title"],
                       publisher=s.get("publisher", ""), url=s["url"])
    for ev in doc["events"]:
        graph.add_node(ev["id"], kind="event", label=ev["title"], occurred_on=ev["occurred_on"])
        for sid in ev["source_ids"]:
            graph.add_edge(sid, ev["id"], key="source:" + sid,
                           relationship="REPORTS", review="source-indexed-unreviewed")
    for link in doc["relationships"]:
        graph.add_edge(link["source_event_id"], link["target_event_id"],
                       key=link["id"], relationship=link["type"],
                       review=link["review_status"], assertion=link["assertion"])
    return graph


def main():
    p = argparse.ArgumentParser(description="Validate ARGUS event graph; optionally emit GraphML.")
    p.add_argument("input", type=Path)
    p.add_argument("--graphml", type=Path)
    args = p.parse_args()
    if args.input.stat().st_size > 8_000_000:
        raise SystemExit("REJECTED: graph file exceeds 8MB bound")
    doc = json.loads(args.input.read_text(encoding="utf-8"))
    try:
        result = validate_graph(doc)
    except GraphIntegrityError as exc:
        print("REJECTED: " + str(exc))
        raise SystemExit(1) from exc
    print("PASS: " + json.dumps(result, sort_keys=True))
    if args.graphml:
        import networkx as nx
        nx.write_graphml(to_networkx(doc), args.graphml)
        print("GraphML written to " + str(args.graphml))


if __name__ == "__main__":
    main()
