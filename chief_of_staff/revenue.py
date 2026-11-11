"""Score a bounded sales pilot from verified aggregate records."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sys

from commerce.instagram.control import economics, instant, integer, load


PILOT_POLICY = {
    "minimum_sales": 1,
    "maximum_data_age_hours": 24,
    "minimum_net_margin": 0,
}


def scorecard(snapshot: dict, now: datetime) -> dict:
    if not isinstance(snapshot, dict) or snapshot.get("schema_version") != 1:
        raise ValueError("Expected a version 1 revenue snapshot")
    pipeline = snapshot["pipeline"]
    eligible = integer(pipeline["eligible_contacts"], "eligible_contacts")
    sent = integer(pipeline["contacted"], "contacted")
    replies = integer(pipeline["positive_replies"], "positive_replies")
    calls = integer(pipeline["booked_calls"], "booked_calls")
    buyers = integer(pipeline["paid_customers"], "paid_customers")
    if sent > eligible or max(replies, calls, buyers) > sent:
        raise ValueError("Pipeline counts exceed the population contacted")

    metrics = snapshot["metrics"]
    cash = economics(metrics, PILOT_POLICY, now)
    orders = cash["settled_sales"]
    if buyers > orders or bool(buyers) != bool(orders):
        raise ValueError("Paid customers and attributed orders disagree")

    avoided = snapshot.get("verified_avoided_expense_cents")
    if avoided is not None:
        avoided = integer(avoided, "verified_avoided_expense_cents")
        reference = snapshot.get("avoided_expense_evidence")
        if avoided and (not isinstance(reference, str) or not reference.strip()):
            raise ValueError("Avoided cash expense requires evidence")

    estimated = snapshot.get("estimated_pipeline_value_cents")
    if estimated is not None:
        estimated = integer(estimated, "estimated_pipeline_value_cents")

    return {
        "currency": cash["currency"],
        "period_start": cash["period_start"],
        "period_end": cash["period_end"],
        "as_of": cash["as_of"],
        "pipeline": {
            "eligible_contacts": eligible,
            "contacted": sent,
            "positive_replies": replies,
            "booked_calls": calls,
            "paid_customers": buyers,
        },
        "cash": {
            "paid_orders": orders,
            "gross_cents": cash["gross_revenue_cents"],
            "direct_costs_and_refunds_cents": cash["total_costs_cents"],
            "contribution_cents": cash["net_profit_cents"],
        },
        "verified_avoided_expense_cents": avoided,
        "estimated_pipeline_value_cents": estimated,
        "next_review": cash["recommendation"],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("snapshot", type=Path, help="Private aggregate JSON file or bundled example")
    parser.add_argument("--as-of", help="Reference time for a historical replay")
    args = parser.parse_args()
    try:
        now = instant(args.as_of) if args.as_of else datetime.now(timezone.utc)
        result = scorecard(load(args.snapshot), now)
        print(json.dumps(result, indent=2))
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f"Revenue scorecard failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
