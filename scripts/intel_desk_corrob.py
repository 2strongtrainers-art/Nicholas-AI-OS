#!/usr/bin/env python3
"""Bounded, conservative cross-publisher review leads from the public intel snapshot.

Read-only/offline. Reports coverage overlap, NOT independently verified facts,
attack attribution, causality, or Chief delivery. No provider calls or spending.
"""
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timedelta, timezone
from itertools import combinations
from pathlib import Path
from urllib.parse import urlparse

SCHEMA = "trivalley.global-intel-corroboration.v1"
MAX_EVENTS = 300
MAX_LEADS = 12
OFFICIAL_SOURCES = frozenset({"Federal Reserve", "Defense Department",
                              "Department of Energy"})
BROAD_PLACES = frozenset({"United States"})
STOP = frozenset("""the a an and or of for to in on by at after before amid with from
                  over under during says said new latest report reports as us uk
                  could may will about into updates officials people world today
                  2026 government news more than has have had this that""".split())
TOPIC_WORDS = {
    "Security": re.compile(r"\b(cyber|hack|malware|ransomware|breach|vulnerab\w*|"
                           r"espionage|data leak|security flaw|network attack|phishing)\b", re.I),
    "Geopolitics": re.compile(r"\b(war|military|missile|drone|strike|attac\w*|"
                              r"sanction\w*|ceasefire|troops|airstrike|naval|"
                              r"border|conflict|defence|defense|security pact|"
                              r"export controls?)\b", re.I),
    "Energy": re.compile(r"\b(oil|gas|crude|energy|power|electricity|diesel|"
                         r"fuel|nuclear|pipeline|lng|refiner\w*|renewabl\w*|"
                         r"tanker|opec)\b", re.I),
    "Economy": re.compile(r"\b(inflation|consumer prices?|interest rates?|fed|"
                          r"economic|business|market|tariff|jobs|employment|"
                          r"trade|bond|gdp|central bank|retail|exports?)\b", re.I),
}
ACTIONS = {
    "aviation_disruption": re.compile(r"\b(ground stops?|flights? (?:halt|cancel|delay)|"
                                      r"aviation outage|air traffic control)\b", re.I),
    "cyber_incident": re.compile(r"\b(ransomware|cyberattac\w*|hacked|malware|"
                                 r"breached|data breach|intrusion)\b", re.I),
    "physical_strike": re.compile(r"\b(struck|strikes?|airstrikes?|missiles?|"
                                  r"drones?|bombard\w*|shelling)\b", re.I),
    "maritime_incident": re.compile(r"\b(tanker|vessel|ship)\b.*\b(attac\w*|"
                                    r"struck|hit|fire|mine|explosion)\b|"
                                    r"\b(attac\w*|struck|hit|mine)\b.*\b(tanker|"
                                    r"vessel|ship)\b", re.I),
    "restriction": re.compile(r"\b(sanction\w*|tariff\w*|export ban|"
                               r"export restrict\w*|export controls?)\b", re.I),
    "energy_disruption": re.compile(r"\b(oil|gas|energy|fuel|power|lng|pipeline)\b.*"
                                    r"\b(shortage|disruption|shutdown|outage|"
                                    r"strike|halt)\b", re.I),
}
PUBLISHER_ALIASES = {"bbc": "BBC", "npr": "NPR", "defense department": "DOD",
                     "department of energy": "DOE", "federal reserve": "FED"}


def stamp(value):
    if not isinstance(value, str):
        return None
    try:
        d = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return d.astimezone(timezone.utc) if d.tzinfo else None
    except ValueError:
        return None


def tokens(text):
    return {w for w in re.findall(r"[a-z]{4,}", str(text).lower())
            if w not in STOP}


def family(event):
    p = str(event.get("publisher") or "").strip()
    if not p:
        return ""
    key = p.lower()
    if key in PUBLISHER_ALIASES:
        return PUBLISHER_ALIASES[key]
    hostname = (urlparse("https://" + key).hostname or key)
    hostname = re.sub(r"^www\.", "", hostname)
    return hostname


def actions(text):
    return {key for key, pattern in ACTIONS.items() if pattern.search(text)}


def eligible(event, at):
    if not isinstance(event, dict) or event.get("kind") != "report":
        return False, "not_report"
    topic = event.get("topic")
    if topic not in TOPIC_WORDS:
        return False, "unsupported_topic"
    if event.get("source") in ("CISA KEV", "GDELT event data"):
        return False, "catalog_or_automated_coding"
    date = stamp(event.get("observed_at"))
    if date is None:
        return False, "missing_or_invalid_time"
    if date > at + timedelta(minutes=2):
        return False, "future_dated"
    if at - date > timedelta(hours=72):
        return False, "outside_72h"
    if not TOPIC_WORDS[topic].search(str(event.get("title") or "")):
        return False, "off_topic_headline"
    url = str(event.get("url") or "")
    if (not url.startswith("https://") or
            urlparse(url).hostname is None or not family(event)):
        return False, "missing_provenance"
    return True, None


def evidence(e):
    return {"title": str(e["title"])[:190], "publisher": str(e["publisher"])[:90],
            "publisher_family": family(e), "url": str(e["url"])[:2000],
            "observed_at": e["observed_at"],
            "source": str(e.get("source") or "")[:90]}


def make_report(snapshot):
    if not isinstance(snapshot, dict) or snapshot.get("schema") != "trivalley.global-intel.v1":
        raise ValueError("unsupported_snapshot_schema")
    events = snapshot.get("events")
    if not isinstance(events, list) or len(events) > MAX_EVENTS:
        raise ValueError("invalid_event_count")
    at = stamp(snapshot.get("generated_at"))
    if not at:
        raise ValueError("invalid_generation_time")
    valid, excluded, official = [], {}, []
    for e in events:
        ok, why = eligible(e, at)
        if not ok:
            excluded[why] = excluded.get(why, 0) + 1
            continue
        valid.append(e)
        if e.get("source") in OFFICIAL_SOURCES:
            official.append(e)

    pairs = {}
    # Consider each pair only once; capped input size makes O(n^2) bounded.
    for a, b in combinations(valid, 2):
        if a["topic"] != b["topic"] or family(a) == family(b):
            continue
        shared_places = (set(a.get("mentions") or []) &
                         set(b.get("mentions") or [])) - BROAD_PLACES
        if not shared_places:
            continue
        shared_actions = actions(a.get("title", "")) & actions(b.get("title", ""))
        if not shared_actions:
            continue
        overlap = tokens(a["title"]) & tokens(b["title"])
        if len(overlap) < 2:
            continue
        da, db = stamp(a["observed_at"]), stamp(b["observed_at"])
        if abs(da - db) > timedelta(hours=36):
            continue
        # Same underlying wire copy across publishers cannot be ruled out:
        # *never* call a match independent event verification.
        place = sorted(shared_places)[0]
        tag = sorted(shared_actions)[0]
        key = (a["topic"], place, tag)
        score = (len(overlap), -abs((da - db).total_seconds()))
        item = {"topic": a["topic"], "place_mention": place,
                "action_tag": tag, "classification": "CROSS_PUBLISHER_COVERAGE_LEAD",
                "evidence": [evidence(a), evidence(b)],
                "publisher_families": sorted((family(a), family(b))),
                "shared_tokens": sorted(overlap)[:8],
                "independence": "Different publisher families; underlying syndication unknown",
                "caveat": "Same-topic reported headline overlap, not an independently verified event or causal connection"}
        if key not in pairs or score > pairs[key][0]:
            pairs[key] = (score, item)

    leads = [x[1] for x in sorted(pairs.values(),
                                key=lambda pair: (-pair[0][0], pair[1]["topic"],
                                                  pair[1]["place_mention"]))[:MAX_LEADS]]
    primary = [dict(evidence(e), classification="OFFICIAL_PUBLICATION_LEAD",
                    caveat="Agency-published headline; event details and claims require independent verification")
               for e in sorted(official, key=lambda e: e["observed_at"], reverse=True)[:8]]
    usable_families = sorted({family(e) for e in valid})
    receipt_key = "global-intel-" + re.sub(r"[^0-9]", "", snapshot["generated_at"])
    return {
        "schema": SCHEMA,
        "generated_at": snapshot["generated_at"],
        "receipt_key": receipt_key,
        "state": "REVIEW_REQUIRED",
        "cross_publisher_leads": leads,
        "official_publication_leads": primary,
        "counts": {
            "input_signals": len(events),
            "eligible_report_headlines": len(valid),
            "eligible_publisher_families": len(usable_families),
            "cross_publisher_leads": len(leads),
            "official_publication_leads": len(primary),
            "excluded_by_reason": excluded,
        },
        "methodology": (
            "Strict shared topic, named place, action, lexical overlap, UTC timing <=36h, "
            "and two distinct publishing families. Headline-level matching only; "
            "does not establish editorial independence, actual incidents, coordination, or causation."
        ),
        "chief_delivery": "normalized_output_prepared; acknowledgment_not_observed",
        "approval_state": "REVIEW_REQUIRED",
        "outbound_actions": 0, "paid_provider_calls": 0,
    }


def amend_receipt(receipt, report):
    if (receipt.get("schema") != "trivalley.global-intel-review.v1" or
            receipt.get("source_generated_at") != report["generated_at"] or
            receipt.get("receipt_key") != report["receipt_key"]):
        raise ValueError("source_receipt_mismatch")
    receipt["corroboration"] = {
        "url": "https://2strongtrainers-art.github.io/Nicholas-AI-OS/data/corroboration.json",
        "state": "REVIEW_REQUIRED",
        "cross_publisher_leads": report["counts"]["cross_publisher_leads"],
        "official_publication_leads": report["counts"]["official_publication_leads"],
        "excluded_by_reason": report["counts"]["excluded_by_reason"],
        "method": report["methodology"],
        "claim_level": "LEAD_ONLY_UNVERIFIED",
    }
    receipt["approval_state"] = "REVIEW_REQUIRED"
    receipt["chief_delivery"] = "normalized_output_prepared; acknowledgment_not_observed"
    receipt["paid_provider_calls"] = 0
    receipt["outbound_actions"] = 0
    items = receipt.get("chief_snapshot", {}).get("items", [])
    if not isinstance(items, list) or len(items) != 1:
        raise ValueError("unexpected_chief_snapshot")
    items.append({
        "source": "github", "id": "global-intel-corroboration-review",
        "version": report["receipt_key"] + ":REVIEW_REQUIRED",
        "title": "CORROBORATION TRIAGE — UNVERIFIED REPORTING LEADS",
        "next_step": "Read the candidate evidence, check syndication and primary records, record alternative explanations; do not infer causation.",
        "url": receipt["corroboration"]["url"],
        "observed_at": report["generated_at"], "due_at": None,
        "direction": "owner_action", "priority": "normal",
    })
    return receipt


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", default="intel-desk/data/events.json")
    p.add_argument("--output", default="intel-desk/data/corroboration.json")
    p.add_argument("--receipt", default="intel-desk/data/review-receipt.json")
    args = p.parse_args()
    source = json.loads(Path(args.input).read_text(encoding="utf-8"))
    receipt = json.loads(Path(args.receipt).read_text(encoding="utf-8"))
    report = make_report(source)
    receipt = amend_receipt(receipt, report)
    Path(args.output).write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n",
                                 encoding="utf-8")
    Path(args.receipt).write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n",
                                  encoding="utf-8")
    print(json.dumps({"receipt_key": report["receipt_key"],
                      "cross_publisher_leads": report["counts"]["cross_publisher_leads"],
                      "official_leads": report["counts"]["official_publication_leads"],
                      "excluded": report["counts"]["excluded_by_reason"],
                      "chief_delivery": report["chief_delivery"], "paid_provider_calls": 0},
                     sort_keys=True))


if __name__ == "__main__":
    main()
