#!/usr/bin/env python3
"""Check a creator brief against a recent capability snapshot and explicit caps.

This planner never calls a provider, retrieves private media, publishes, or changes
environment policy. A permitted plan is not proof that a generation completed.
"""
import argparse
from datetime import datetime, timezone
import json
import math
import os
from pathlib import Path
import re


def numeric(value, name, minimum=0):
    if type(value) not in (int, float) or not math.isfinite(value) or value < minimum:
        raise ValueError(f"{name} must be finite and at least {minimum}.")
    return value


def preflight(brief, snapshot, *, allow_paid_ai=False, now=None):
    if not isinstance(brief, dict) or brief.get("schema_version") != 1:
        raise ValueError("A version 1 creator brief is required.")
    if brief.get("template") not in {"coach-cue", "myth-check", "inside-program"}:
        raise ValueError("Unknown creator template.")
    for key in ("topic", "audience", "takeaway", "cta"):
        if not isinstance(brief.get(key), str) or not brief[key].strip():
            raise ValueError(f"A nonempty {key} is required.")
    if not isinstance(brief.get("sources"), list) or not brief["sources"]:
        raise ValueError("At least one reviewed source is required.")
    if any(not isinstance(s, dict) or s.get("reviewed") is not True or not s.get("reference") for s in brief["sources"]):
        raise ValueError("Every source needs a reference and an explicit review result.")
    if brief.get("claims_reviewed") is not True:
        raise ValueError("Claims must be reviewed before generation.")
    if not isinstance(snapshot, dict) or not isinstance(snapshot.get("node_types"), list):
        raise ValueError("Provide a live node-type capability snapshot.")
    fetched = datetime.fromisoformat(snapshot.get("fetched_at", "").replace("Z", "+00:00"))
    if fetched.tzinfo is None:
        raise ValueError("Capability timestamp needs an explicit timezone.")
    now = now or datetime.now(timezone.utc)
    age = (now - fetched).total_seconds()
    if age < -300 or age > 86400:
        raise ValueError("Capability snapshot must be no more than 24 hours old.")
    available = {n["type"]: {m["id"] for m in n.get("available_models", [])} for n in snapshot["node_types"]}
    cap = numeric(brief.get("max_estimated_credits"), "max_estimated_credits")
    maximum = brief.get("max_variations", 1)
    if type(maximum) is not int or not 1 <= maximum <= 3:
        raise ValueError("max_variations must be 1 to 3.")
    plan = brief.get("generation_plan", [])
    if not isinstance(plan, list) or len(plan) > 40:
        raise ValueError("generation_plan must contain no more than 40 steps.")
    total, steps, seen = 0, [], set()
    for step in plan:
        if not isinstance(step, dict) or not re.fullmatch(r"[a-z][a-z0-9-]{1,63}", str(step.get("id", ""))):
            raise ValueError("Every generation step requires a valid id.")
        if step["id"] in seen:
            raise ValueError("Generation step ids must be unique.")
        seen.add(step["id"])
        kind, model = step.get("node_type"), step.get("model_id")
        if model not in available.get(kind, set()):
            raise ValueError(f"Requested model is absent from current {kind} capabilities.")
        count = step.get("variations", 1)
        if type(count) is not int or not 1 <= count <= maximum:
            raise ValueError("A generation exceeds the allowed variation count.")
        estimate = numeric(step.get("estimated_credits_per_variation"), "step estimate") * count
        total += estimate
        steps.append({"id": step["id"], "node_type": kind, "model_id": model,
                      "variations": count, "estimated_credits": estimate, "state": "planned"})
    if total > cap:
        raise ValueError("Estimated generations exceed the explicit credit cap.")
    return {"schema_version": 1, "status": "preflight_passed",
            "generation_permitted": bool(allow_paid_ai),
            "reason": "policy_allows_capped_generation" if allow_paid_ai else "ALLOW_PAID_AI_is_false",
            "estimated_credits": total, "max_estimated_credits": cap, "steps": steps,
            "provider_calls_performed": 0, "publication_performed": False,
            "required_next_checks": ["current model schema and input ports", "private authorized asset resolution",
                                     "provider estimate immediately before generation", "completed generation result",
                                     "rendered file and QA", "actual destination receipt before claiming publication"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("brief", type=Path)
    parser.add_argument("capabilities", type=Path)
    args = parser.parse_args()
    result = preflight(json.loads(args.brief.read_text()), json.loads(args.capabilities.read_text()),
                       allow_paid_ai=os.environ.get("ALLOW_PAID_AI", "false").lower() == "true")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
