#!/usr/bin/env python3
"""Free AI 8 orchestrator.

Zero-spend-first adapters for the Nicholas AI OS.

Important safety behavior:
- Paid AI is blocked unless ALLOW_PAID_AI=true.
- Apollo credit-spending operations are intentionally not implemented here.
- Outbound sending is intentionally not implemented here.
- Fish free API is blocked after 2026-08-31 until revalidated.
- Secrets are read only from environment variables.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date
from pathlib import Path
from typing import Any

import requests

TIMEOUT = 45
FISH_FREE_UNTIL = date(2026, 8, 31)


def env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def request_json(method: str, url: str, **kwargs: Any) -> dict[str, Any]:
    response = requests.request(method, url, timeout=TIMEOUT, **kwargs)
    if not response.ok:
        safe_body = response.text[:1000]
        raise RuntimeError(f"HTTP {response.status_code} from {url}: {safe_body}")
    if not response.content:
        return {}
    return response.json()


def health() -> dict[str, Any]:
    today = date.today()
    return {
        "mode": "zero-spend-first",
        "date": today.isoformat(),
        "safety": {
            "allow_paid_ai": env_bool("ALLOW_PAID_AI"),
            "allow_apollo_credit_spend": env_bool("ALLOW_APOLLO_CREDIT_SPEND"),
            "allow_outbound_send": env_bool("ALLOW_OUTBOUND_SEND"),
        },
        "providers": {
            "hubspot": {"configured": bool(os.getenv("HUBSPOT_ACCESS_TOKEN"))},
            "apollo": {"configured": bool(os.getenv("APOLLO_API_KEY"))},
            "dify": {"configured": bool(os.getenv("DIFY_API_KEY"))},
            "fish_audio": {
                "configured": bool(os.getenv("FISH_API_KEY")),
                "free_model_window_valid": today <= FISH_FREE_UNTIL,
                "free_model": os.getenv("FISH_MODEL", "s2.1-pro-free"),
            },
            "minimax": {
                "configured": bool(os.getenv("MINIMAX_API_KEY")),
                "enabled": env_bool("ALLOW_PAID_AI"),
            },
            "qoder": {"configured": bool(os.getenv("QODER_PERSONAL_ACCESS_TOKEN"))},
            "freebuff": {"runtime": "developer workstation/agent; not a production API"},
            "chatgpt": {"runtime": "supervisory connected-app layer"},
        },
    }


def apollo_people_search(
    *,
    titles: list[str],
    locations: list[str],
    seniorities: list[str],
    per_page: int = 25,
) -> dict[str, Any]:
    """Zero-credit net-new prospect search.

    Apollo's People API Search does not reveal email/phone. This intentionally
    returns a qualification queue rather than spending enrichment credits.
    """
    api_key = require_env("APOLLO_API_KEY")
    payload: dict[str, Any] = {
        "person_titles": titles,
        "person_locations": locations,
        "person_seniorities": seniorities,
        "per_page": max(1, min(per_page, 100)),
        "page": 1,
    }
    return request_json(
        "POST",
        "https://api.apollo.io/api/v1/mixed_people/api_search",
        headers={"x-api-key": api_key, "accept": "application/json", "Content-Type": "application/json"},
        json=payload,
    )


def hubspot_search_contact_by_email(email: str) -> list[dict[str, Any]]:
    token = require_env("HUBSPOT_ACCESS_TOKEN")
    payload = {
        "filterGroups": [{"filters": [{"propertyName": "email", "operator": "EQ", "value": email}]}],
        "properties": ["firstname", "lastname", "email", "lifecyclestage", "hs_lead_status"],
        "limit": 10,
    }
    data = request_json(
        "POST",
        "https://api.hubapi.com/crm/v3/objects/contacts/search",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json=payload,
    )
    return data.get("results", [])


def hubspot_upsert_contact(properties: dict[str, str]) -> dict[str, Any]:
    """Deduping HubSpot upsert keyed by email.

    Intended primarily for inbound leads or already-approved/enriched outbound
    leads. HubSpot remains the canonical CRM source of truth.
    """
    token = require_env("HUBSPOT_ACCESS_TOKEN")
    email = properties.get("email", "").strip().lower()
    if not email:
        raise ValueError("HubSpot upsert requires an email to guarantee deterministic dedupe.")

    existing = hubspot_search_contact_by_email(email)
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    if existing:
        object_id = existing[0]["id"]
        return request_json(
            "PATCH",
            f"https://api.hubapi.com/crm/v3/objects/contacts/{object_id}",
            headers=headers,
            json={"properties": properties},
        )
    return request_json(
        "POST",
        "https://api.hubapi.com/crm/v3/objects/contacts",
        headers=headers,
        json={"properties": properties},
    )


def dify_workflow(inputs: dict[str, Any], *, response_mode: str = "blocking") -> dict[str, Any]:
    api_key = require_env("DIFY_API_KEY")
    base = os.getenv("DIFY_BASE_URL", "https://api.dify.ai/v1").rstrip("/")
    user = os.getenv("DIFY_USER", "free-ai-8")
    payload = {"inputs": inputs, "response_mode": response_mode, "user": user}
    return request_json(
        "POST",
        f"{base}/workflows/run",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json=payload,
    )


def fish_tts(text: str, output_path: str) -> str:
    today = date.today()
    if today > FISH_FREE_UNTIL:
        raise RuntimeError(
            "Fish free developer API window is past 2026-08-31. Revalidate pricing/terms before enabling this call."
        )
    api_key = require_env("FISH_API_KEY")
    model = os.getenv("FISH_MODEL", "s2.1-pro-free")
    payload: dict[str, Any] = {"text": text, "format": "mp3"}
    reference_id = os.getenv("FISH_VOICE_REFERENCE_ID", "").strip()
    if reference_id:
        payload["reference_id"] = reference_id

    response = requests.post(
        "https://api.fish.audio/v1/tts",
        timeout=TIMEOUT,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "model": model,
        },
        json=payload,
    )
    if not response.ok:
        raise RuntimeError(f"Fish Audio HTTP {response.status_code}: {response.text[:1000]}")
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(response.content)
    return str(path)


def minimax_text(prompt: str) -> dict[str, Any]:
    """Optional paid fallback. Hard-blocked in zero-spend mode."""
    if not env_bool("ALLOW_PAID_AI"):
        raise RuntimeError("MiniMax is blocked because ALLOW_PAID_AI is not true.")
    api_key = require_env("MINIMAX_API_KEY")
    base = os.getenv("MINIMAX_BASE_URL", "https://api.minimax.io/v1").rstrip("/")
    model = os.getenv("MINIMAX_TEXT_MODEL", "MiniMax-M2.7")
    payload = {"model": model, "messages": [{"role": "user", "content": prompt}]}
    return request_json(
        "POST",
        f"{base}/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json=payload,
    )


def write_json(data: Any, output: str | None) -> None:
    text = json.dumps(data, indent=2, ensure_ascii=False)
    if output:
        path = Path(output)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text + "\n", encoding="utf-8")
        print(path)
    else:
        print(text)


def parse_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def main() -> int:
    parser = argparse.ArgumentParser(description="Free AI 8 zero-spend-first orchestrator")
    sub = parser.add_subparsers(dest="command", required=True)

    p_health = sub.add_parser("health")
    p_health.add_argument("--output")

    p_apollo = sub.add_parser("apollo-search")
    p_apollo.add_argument("--titles", required=True, help="Comma-separated titles")
    p_apollo.add_argument("--locations", required=True, help="Comma-separated locations")
    p_apollo.add_argument("--seniorities", default="manager,director,vp,c_suite")
    p_apollo.add_argument("--per-page", type=int, default=25)
    p_apollo.add_argument("--output")

    p_hubspot = sub.add_parser("hubspot-upsert")
    p_hubspot.add_argument("--email", required=True)
    p_hubspot.add_argument("--firstname", default="")
    p_hubspot.add_argument("--lastname", default="")
    p_hubspot.add_argument("--lifecycle", default="lead")
    p_hubspot.add_argument("--output")

    p_dify = sub.add_parser("dify-run")
    p_dify.add_argument("--inputs-json", required=True)
    p_dify.add_argument("--output")

    p_fish = sub.add_parser("fish-tts")
    p_fish.add_argument("--text", required=True)
    p_fish.add_argument("--output", required=True)

    p_minimax = sub.add_parser("minimax-text")
    p_minimax.add_argument("--prompt", required=True)
    p_minimax.add_argument("--output")

    args = parser.parse_args()

    try:
        if args.command == "health":
            write_json(health(), args.output)
        elif args.command == "apollo-search":
            result = apollo_people_search(
                titles=parse_csv(args.titles),
                locations=parse_csv(args.locations),
                seniorities=parse_csv(args.seniorities),
                per_page=args.per_page,
            )
            write_json(result, args.output)
        elif args.command == "hubspot-upsert":
            props = {
                "email": args.email.strip().lower(),
                "firstname": args.firstname,
                "lastname": args.lastname,
                "lifecyclestage": args.lifecycle,
            }
            write_json(hubspot_upsert_contact(props), args.output)
        elif args.command == "dify-run":
            write_json(dify_workflow(json.loads(args.inputs_json)), args.output)
        elif args.command == "fish-tts":
            print(fish_tts(args.text, args.output))
        elif args.command == "minimax-text":
            write_json(minimax_text(args.prompt), args.output)
        else:
            parser.error("Unknown command")
    except Exception as exc:  # fail closed and make Actions logs useful
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
