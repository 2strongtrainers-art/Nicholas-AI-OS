#!/usr/bin/env python3
"""TriValley.fit read-only, evidence-gated social learning.

Uses explicitly supplied metric snapshots. It never visits, posts to, or modifies
any external account. SOURCE_VERIFIED is an operator assertion, not proof of live
connector verification; the receipts intentionally preserve that distinction.
"""
from __future__ import annotations
import argparse
import csv
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

PACIFIC = ZoneInfo("America/Los_Angeles")
NETWORKS = {"Instagram", "Facebook", "YouTube Shorts"}
REQUIRED = {"post_id", "platform", "post_url", "approved_at_pacific", "published_at_pacific", "reach", "saves", "shares"}
EVIDENCE = {"instagram_insights", "facebook_insights", "youtube_studio", "hubspot_authorized", "owner_verified_export"}


def stamp(raw: str):
    """Parse operator date as Pacific when timezone is omitted."""
    if not raw.strip():
        return None
    v = datetime.fromisoformat(raw.strip().replace("Z", "+00:00"))
    return v.replace(tzinfo=PACIFIC) if v.tzinfo is None else v.astimezone(PACIFIC)


def count(raw: str):
    """Missing data is None, NEVER zero."""
    if raw is None or str(raw).strip() == "":
        return None
    v = float(raw)
    if v < 0 or not v.is_integer():
        raise ValueError("metrics must be non-negative whole-number counts")
    return int(v)


def process(metrics_csv: Path, as_of: datetime):
    as_of = as_of.astimezone(PACIFIC)
    with metrics_csv.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames or (missing := REQUIRED.difference(reader.fieldnames)):
            raise ValueError(f"Required metric columns missing: {sorted(missing if reader.fieldnames else REQUIRED)}")
        rows = list(reader)
    examined = []
    eligible = []
    seen = set()
    for i, row in enumerate(rows, start=2):
        key = (row.get("post_id", "").strip(), row.get("platform", "").strip())
        reasons = []
        if not key[0] or key[1] not in NETWORKS:
            reasons.append("INVALID_POST_ID_OR_PLATFORM")
        if key in seen:
            reasons.append("DUPLICATE_POST_PLATFORM")
        seen.add(key)
        if row.get("approval_state", "").strip() != "OWNER_APPROVED":
            reasons.append("NO_OWNER_APPROVAL_RECEIPT")
        if row.get("evidence_status", "").strip() != "SOURCE_VERIFIED":
            reasons.append("NO_VERIFIED_METRIC_SOURCE_ASSERTION")
        if row.get("metrics_source", "").strip() not in EVIDENCE:
            reasons.append("MISSING_SUPPORTED_METRICS_SOURCE")
        if not row.get("evidence_reference", "").strip():
            reasons.append("NO_EVIDENCE_REFERENCE")
        if not row.get("post_url", "").startswith("https://"):
            reasons.append("NO_PUBLISHED_POST_URL")
        try:
            approved = stamp(row.get("approved_at_pacific", ""))
            published = stamp(row.get("published_at_pacific", ""))
            snap = stamp(row.get("metrics_as_of_pacific", ""))
            if not approved or not published or not snap:
                reasons.append("MISSING_PUBLISH_OR_SNAPSHOT_TIME")
            elif not (approved <= published <= snap <= as_of):
                reasons.append("INVALID_TIMESTAMP_ORDER")
        except (ValueError, TypeError):
            reasons.append("INVALID_TIMESTAMP_FORMAT")
            published = snap = None
        try:
            reach = count(row.get("reach", ""))
            saves = count(row.get("saves", ""))
            shares = count(row.get("shares", ""))
            leads = count(row.get("qualified_applications", ""))
            bookings = count(row.get("booked_assessments", ""))
            if reach is None or reach == 0:
                reasons.append("NO_POSITIVE_REACH")
            if saves is None or shares is None:
                reasons.append("MISSING_SAVES_OR_SHARES")
            if reach and saves is not None and shares is not None and saves + shares > reach * 3:
                reasons.append("ENGAGEMENT_OUTLIER_NEEDS_REVIEW")
        except (ValueError, TypeError):
            reasons.append("INVALID_METRIC_COUNT")
            reach = saves = shares = leads = bookings = None
        window = None
        if published and snap:
            hours = (snap - published).total_seconds() / 3600
            if 36 <= hours <= 60:
                window = "48h"
            elif 156 <= hours <= 180:
                window = "7d"
            else:
                reasons.append("NOT_COMPARABLE_48H_OR_7D_WINDOW")
            if (as_of - snap).days > 14:
                reasons.append("STALE_SNAPSHOT_OVER_14_DAYS")
        status = "ELIGIBLE_FROM_OPERATOR_MARKED_EVIDENCE" if not reasons else "EXCLUDED"
        item = {"row": i, "post_id": key[0], "platform": key[1], "state": status, "reasons": reasons}
        if not reasons:
            item.update({"window": window, "reach": reach, "saves": saves, "shares": shares,
                         "saves_and_shares_per_1000_reach": round(1000 * (saves + shares) / reach, 3),
                         "qualified_applications_per_1000_reach": round(1000 * leads / reach, 3) if leads is not None else None,
                         "booked_assessments_per_1000_reach": round(1000 * bookings / reach, 3) if bookings is not None else None,
                         "hook_variant": row.get("hook_variant", "").strip() or "unlabeled",
                         "evidence_reference": row.get("evidence_reference", "").strip()})
            eligible.append(item)
        examined.append(item)
    groups = defaultdict(list)
    for item in eligible:
        groups[(item["platform"], item["window"])].append(item)
    suggestions = []
    for (platform, window), group in sorted(groups.items()):
        reviewed = [x for x in group if x["reach"] >= 100]
        if len(reviewed) < 2:
            continue
        ordered = sorted(reviewed, key=lambda x: (-x["saves_and_shares_per_1000_reach"], x["post_id"]))
        top, bottom = ordered[0], ordered[-1]
        suggestions.append({
            "platform": platform, "observation_window": window,
            "state": "TENTATIVE_HYPOTHESIS_NOT_CAUSAL_LIFT",
            "higher_engagement_post": top["post_id"], "lower_engagement_post": bottom["post_id"],
            "metric": "saves_plus_shares_per_1000_reach",
            "rates": [top["saves_and_shares_per_1000_reach"], bottom["saves_and_shares_per_1000_reach"]],
            "next_experiment": "Propose two original first-frame/hook alternatives for a comparable topic and length; owner approves before posting.",
            "owner_approval_required": True, "auto_publish": False,
            "provenance": [top["evidence_reference"], bottom["evidence_reference"]]
        })
    reason_counts = dict(sorted(Counter(r for x in examined for r in x["reasons"]).items()))
    status = "DRAFT_HYPOTHESES_FROM_DECLARED_EVIDENCE" if suggestions else (
        "INSUFFICIENT_VERIFIED_METRICS" if not eligible else "INSUFFICIENT_COMPARABLE_POSTS")
    return {"schema": "trivalley.agentic-social-learning.v1", "as_of_pacific": as_of.isoformat(),
            "status": status, "source_file": metrics_csv.name, "rows_total": len(rows), "rows_eligible": len(eligible),
            "reason_counts": reason_counts, "rows": examined, "proposals": suggestions,
            "guardrails": {"external_actions": 0, "automatic_publish": False, "approved_posts_generated": 0,
                           "data_label": "Operator-asserted metrics; no independent API verification in this script",
                           "learning_requires_real_post_receipts": True}}


def main():
    p = argparse.ArgumentParser(description="Produce a read-only private content learning brief and JSON evidence receipt")
    p.add_argument("--metrics", required=True, type=Path)
    p.add_argument("--out", required=True, type=Path)
    p.add_argument("--as-of", default=None, help="ISO timestamp; defaults to current Pacific time")
    a = p.parse_args()
    now = stamp(a.as_of) if a.as_of else datetime.now(timezone.utc).astimezone(PACIFIC)
    receipt = process(a.metrics, now)
    a.out.mkdir(parents=True, exist_ok=True)
    (a.out / "learning_receipt.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    report = ["# TriValley.fit — Source-gated Social Learning Brief", "",
              f"**As of:** {receipt['as_of_pacific']}", f"**State:** {receipt['status']}",
              f"**Eligible rows:** {receipt['rows_eligible']} / {receipt['rows_total']}", "",
              "This is a read-only computation from supplied data, not a claim of verified platform uplift.",
              "No content is published, sent, billed, or deployed.", ""]
    if receipt["reason_counts"]:
        report.extend(["## Why data was excluded", ""])
        for k,v in receipt["reason_counts"].items():report.append(f"- {k}: {v}")
        report.append("")
    if receipt["proposals"]:
        report.extend(["## Owner-review hypotheses", ""])
        for prop in receipt["proposals"]:
            report.append(f"- {prop['platform']} ({prop['observation_window']}): compare {prop['higher_engagement_post']} vs {prop['lower_engagement_post']}; try two new hooks, owner approval required; no causal-lift claim.")
    else:
        report.extend(["## Next evidence requirement", "", "Provide genuine post URL, owner approval, matched 48-hour or 7-day source-referenced reach/saves/shares snapshots for at least two comparable posts on the SAME platform; keep missing values blank, not zero."])
    (a.out / "learning_brief.md").write_text("\n".join(report)+"\n", encoding="utf-8")
    print(json.dumps({k:receipt[k] for k in ["status", "rows_total", "rows_eligible", "reason_counts"]}))

if __name__ == "__main__":
    main()