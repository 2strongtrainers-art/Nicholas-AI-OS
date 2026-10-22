#!/usr/bin/env python3
"""Offline commerce readiness and economics. No network, publishing or spending.

Actual store/payment exports stay outside this public repository. Reports expose
only aggregates and fixed reason codes. A recommendation is not an ad pause.
"""
import argparse
import hashlib
import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
COSTS = ("refunds_cents", "processing_fees_cents", "advertising_cents",
         "software_cents", "fulfillment_cents", "labor_cents", "other_costs_cents")
REQUIRED_EVIDENCE = ("instagram_connection", "product_review", "checkout_test", "delivery_test")


def instant(value):
    if not isinstance(value, str):
        raise ValueError("timestamp_required")
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        raise ValueError("timezone_required")
    return dt.astimezone(timezone.utc)


def integer(value, name):
    if type(value) is not int or not 0 <= value <= 10**12:
        raise ValueError("invalid_" + name)
    return value


def load(path):
    if Path(path).stat().st_size > 1_000_000:
        raise ValueError("input_too_large")
    def unique(pairs):
        out = {}
        for key, value in pairs:
            if key in out:
                raise ValueError("duplicate_json_key")
            out[key] = value
        return out
    return json.loads(Path(path).read_text(), object_pairs_hook=unique,
                      parse_constant=lambda _: (_ for _ in ()).throw(ValueError("nonfinite_json")))


def validate_config(config):
    if not isinstance(config, dict) or not isinstance(config.get("offer"), dict) or not isinstance(config.get("policy"), dict):
        raise ValueError("invalid_config_shape")
    if config.get("schema_version") != 1 or config.get("currency") != "USD":
        raise ValueError("unsupported_config")
    price = integer(config["offer"]["price_cents"], "price")
    if not price or config["offer"].get("status") not in ("draft", "approved"):
        raise ValueError("invalid_offer")
    for key in ("minimum_sales", "maximum_data_age_hours", "maximum_evidence_age_hours"):
        if not integer(config["policy"][key], key):
            raise ValueError("invalid_policy")
    margin = config["policy"]["minimum_net_margin"]
    if type(margin) not in (int, float) or not math.isfinite(margin) or not 0 <= margin <= 1:
        raise ValueError("invalid_margin")
    # This module has no execution adapters. Configuration cannot enable them.
    if config.get("live_execution_enabled") is not False:
        raise ValueError("live_execution_not_supported")


def economics(metrics, policy, now):
    if not isinstance(metrics, dict) or metrics.get("currency") != "USD":
        raise ValueError("invalid_metrics")
    if metrics.get("costs_complete") is not True:
        raise ValueError("incomplete_costs")
    start, end, asof = (instant(metrics[k]) for k in ("period_start", "period_end", "as_of"))
    if not start < end <= asof <= now or end - start > timedelta(days=31):
        raise ValueError("invalid_metrics_period")
    max_age = timedelta(hours=policy["maximum_data_age_hours"])
    if now - asof > max_age or asof - end > max_age:
        raise ValueError("stale_metrics")
    sales = integer(metrics["settled_sales"], "settled_sales")
    revenue = integer(metrics["gross_revenue_cents"], "gross_revenue")
    if (sales == 0) != (revenue == 0):
        raise ValueError("inconsistent_sales_revenue")
    costs = sum(integer(metrics[k], k) for k in COSTS)
    profit = revenue - costs
    margin = profit / revenue if revenue else None
    if profit < 0:
        decision = "STOP_NEW_SPEND_REVIEW_LOSS"
    elif sales < policy["minimum_sales"]:
        decision = "HOLD_INSUFFICIENT_SALES"
    elif margin is None or margin < policy["minimum_net_margin"]:
        decision = "HOLD_MARGIN_BELOW_TARGET"
    else:
        decision = "REVIEW_FOR_CONTINUATION"
    return {"currency": "USD", "settled_sales": sales, "gross_revenue_cents": revenue,
            "total_costs_cents": costs, "net_profit_cents": profit,
            "net_margin": margin, "recommendation": decision,
            "period_start": start.isoformat(), "period_end": end.isoformat(),
            "as_of": asof.isoformat(), "scope": "reported_period_only"}


def readiness(config, evidence, now):
    blockers = []
    if config["offer"]["status"] != "approved":
        blockers.append("PRODUCT_DRAFT")
    url = config["offer"].get("product_url")
    if not url:
        blockers.append("PRODUCT_URL_MISSING")
    else:
        u = urlsplit(url)
        if (u.scheme != "https" or u.hostname not in ("trivalley.fit", "www.trivalley.fit")
                or u.username or u.password or u.query or u.fragment):
            blockers.append("PRODUCT_URL_INVALID")
    # Evidence is an operator attestation, NOT a live connection probe.
    for key in REQUIRED_EVIDENCE:
        entry = evidence.get(key, {}) if isinstance(evidence, dict) else {}
        if not isinstance(entry, dict):
            entry = {}
        valid = False
        try:
            age = now - instant(entry.get("checked_at"))
            valid = (entry.get("passed") is True and
                     isinstance(entry.get("reference"), str) and bool(entry["reference"].strip()) and
                     timedelta(0) <= age <= timedelta(hours=config["policy"]["maximum_evidence_age_hours"]))
        except (ValueError, TypeError, OverflowError):
            pass
        if not valid:
            blockers.append(key.upper() + "_UNVERIFIED")
    return blockers


def report(config, metrics=None, evidence=None, now=None):
    now = now or datetime.now(timezone.utc)
    validate_config(config)
    blockers = readiness(config, evidence or {}, now)
    result = {"schema_version": 1, "checked_at": now.isoformat(),
              "live_execution_enabled": False, "external_actions_taken": [],
              "evidence_method": "operator_attestations_not_live_probes",
              "blockers": blockers, "economics": None}
    # A new product can be ready for an organic pilot before it has sales.
    # Sales evidence controls continuation/scaling review, not technical setup.
    result["launch_status"] = "BLOCKED" if blockers else "READY_FOR_OPERATOR_REVIEW"
    if metrics is None:
        blockers.append("SALES_AND_COST_DATA_MISSING")
    else:
        try:
            result["economics"] = economics(metrics, config["policy"], now)
            if result["economics"]["recommendation"] != "REVIEW_FOR_CONTINUATION":
                blockers.append("ECONOMICS_REVIEW_REQUIRED")
        except (ValueError, KeyError, TypeError, OverflowError):
            blockers.append("SALES_AND_COST_DATA_INVALID_OR_STALE")
    result["growth_status"] = ("READY_FOR_OPERATOR_REVIEW" if
        result["economics"] and result["economics"]["recommendation"] == "REVIEW_FOR_CONTINUATION"
        and not blockers else "HOLD")
    return result


def queue(config, content):
    validate_config(config)
    entries, ids = [], set()
    if not isinstance(content, list) or not content:
        raise ValueError("content_list_required")
    for item in content:
        key = item["id"]
        if not isinstance(key, str) or not key or key in ids:
            raise ValueError("duplicate_or_invalid_content_id")
        ids.add(key)
        if not all(isinstance(item.get(k), str) and item[k].strip()
                   for k in ("headline", "body", "caption")):
            raise ValueError("invalid_content")
        asset = ROOT / "assets" / (key + ".svg")
        if not asset.resolve().is_relative_to((ROOT / "assets").resolve()) or not asset.is_file():
            raise ValueError("invalid_asset")
        image = asset.with_suffix(".png")
        if not image.is_file():
            raise ValueError("missing_publish_image")
        # Bind review to both copy and asset; edits invalidate this digest.
        digest = hashlib.sha256(json.dumps(item, sort_keys=True).encode() + asset.read_bytes() + image.read_bytes()).hexdigest()
        entries.append({**item, "asset": "assets/" + asset.name,
                        "image": "assets/" + image.name,
                        "review_digest": digest, "status": "DRAFT",
                        "publishable": False, "product_url": config["offer"].get("product_url")})
    return {"schema_version": 1, "items": entries, "external_actions_taken": []}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("report", "queue"))
    parser.add_argument("--config", type=Path, default=ROOT / "config.json")
    parser.add_argument("--metrics", type=Path)
    parser.add_argument("--evidence", type=Path)
    parser.add_argument("--content", type=Path, default=ROOT / "content.json")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    try:
        config = load(args.config)
        if args.command == "report":
            result = report(config, load(args.metrics) if args.metrics else None,
                            load(args.evidence) if args.evidence else None)
        else:
            result = queue(config, load(args.content))
        output = json.dumps(result, indent=2, allow_nan=False) + "\n"
        if args.output:
            args.output.write_text(output)
        else:
            print(output, end="")
        return 0
    except (ValueError, KeyError, TypeError, OSError, OverflowError):
        # Never echo raw inputs, exception text, filenames or credentials.
        print('{"error":"INVALID_INPUT_OR_OUTPUT","live_execution_enabled":false}')
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
