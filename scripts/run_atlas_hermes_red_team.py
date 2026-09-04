#!/usr/bin/env python3
"""Queue a read-only Atlas research/red-team task through the existing Hermes switchboard.

This script never prints credentials. It uses the existing local worker credential,
asks the persistent Hermes worker to perform public-web research only, then polls the
job until terminal state and optionally writes the result as JSON.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HOME = Path.home()
CONFIG_DIR = HOME / ".config" / "nicholas-ai-switchboard"
DEPLOY_ENV = CONFIG_DIR / "deployment.env"
WORKER_KEY_FILE = CONFIG_DIR / "hermes-worker.key"
ATLAS_URL = "https://2strongtrainers-art.github.io/terrain-environmental-gis/atlas/"


def switchboard_url() -> str:
    if not DEPLOY_ENV.exists():
        raise RuntimeError("Switchboard deployment metadata is missing")
    for raw in DEPLOY_ENV.read_text(encoding="utf-8").splitlines():
        if raw.startswith("AI_SWITCHBOARD_URL="):
            value = raw.split("=", 1)[1].strip().replace("\\:", ":").replace("\\/", "/")
            if value.startswith("https://"):
                return value.rstrip("/")
    raise RuntimeError("AI_SWITCHBOARD_URL is missing")


def worker_key() -> str:
    if not WORKER_KEY_FILE.exists():
        raise RuntimeError("Hermes worker key file is missing")
    mode = WORKER_KEY_FILE.stat().st_mode & 0o777
    if mode & 0o077:
        raise RuntimeError("Hermes worker key permissions are too broad")
    key = WORKER_KEY_FILE.read_text(encoding="utf-8").strip()
    if not key:
        raise RuntimeError("Hermes worker key is empty")
    return key


def request_json(url: str, key: str, payload=None, timeout: int = 30):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method="POST" if payload is not None else "GET",
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "Nicholas-Atlas-Hermes-RedTeam/1.0",
            "Cache-Control": "no-cache",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"Switchboard returned HTTP {exc.code}") from exc


def kick_worker() -> None:
    if sys.platform != "darwin":
        return
    domain = f"gui/{os.getuid()}"
    subprocess.run(
        ["launchctl", "kickstart", "-k", f"{domain}/com.nicholas.hermes-switchboard-worker"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
        timeout=20,
    )


def build_task(focus: str) -> str:
    return f"""ATLAS HERMES RED TEAM — READ-ONLY PUBLIC RESEARCH

Target production site:
{ATLAS_URL}

Primary objective:
Find weaknesses and high-value improvement opportunities that fixed internal QA may miss. Do not edit anything. Research only public information.

Current certified search evidence from the latest production-gate work before this request:
- core benchmark: 20/20 relevance
- legacy stress benchmark: 60/60 relevance
- expanded adversarial benchmark: 220/220 relevance
- 0 benchmark JavaScript errors
- 0 same-origin benchmark failures
- no overflow at 375x812, 390x844, and 430x932 in the expanded benchmark

These scores are NOT permission to assume the product is perfect. Your job is to attack the blind spots of those tests.

Focus from Nick:
{focus.strip() or 'Full discovery, workflow, trust, mobile, retention, and monetization red-team.'}

Perform these tasks:
1. Inspect the live Atlas and current public pages you can reach.
2. Generate at least 60 NEW realistic natural-language user requests that are materially different from the known benchmark families. Include beginners, vague wording, misspellings, long requests, mobile users, free/no-login constraints, business, creator work, fitness-coaching business, grants/GIS, markets, local discovery, Watch/Listen, learning, boredom, Surprise Me, and complete multi-tool workflows.
3. Identify the 10 most likely search/routing failure modes. For each give exact query examples, why current deterministic ranking may fail, and what an ideal top-5 result set should contain conceptually. Do not invent Atlas verification/access status.
4. Research current public patterns from strong discovery products such as There’s An AI For That, Toolify, Futurepedia, Product Hunt, AlternativeTo, JustWatch, or other relevant products. Extract systems worth adapting, not visual copying.
5. Identify missing sections, missing workflows/Stacks, or missing official resources that would add real utility. Prefer official/legal/safe destinations. Clearly label anything you could not verify.
6. Identify UX, trust, retention, analytics, SEO, and ethical monetization improvements with highest expected user value.
7. Produce a prioritized top-10 backlog using Impact / Confidence / Effort / Risk.
8. End with the 3 highest-value changes Codex should implement next.

Hard rules:
- Do not fabricate traffic, popularity, pricing, access/login requirements, verification, ratings, or commercial relationships.
- Free is not the same as no-login.
- Do not recommend piracy, deceptive streaming mirrors, unsafe finance promises, or purchasing organic ranking/verification.
- Distinguish observed facts from hypotheses.
- Prefer concrete exact query examples and actionable product changes over generic commentary.

Return a concise but substantive red-team report. Structure it so Codex can directly convert the findings into tests and implementation tasks."""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--focus", default="Full Atlas discovery and workflow red-team")
    parser.add_argument("--output", default="")
    parser.add_argument("--timeout", type=int, default=1200)
    args = parser.parse_args()

    url = switchboard_url()
    key = worker_key()
    task = build_task(args.focus)
    timeout_seconds = max(120, min(args.timeout, 1200))

    created = request_json(
        f"{url}/hermes/internal/jobs",
        key,
        {"task": task, "timeout_seconds": timeout_seconds},
    )
    job = created.get("job") if isinstance(created, dict) else None
    job_id = str((job or {}).get("id") or "")
    if not job_id:
        raise RuntimeError("Hermes job was not created")
    print(f"ATLAS_HERMES_JOB_ID={job_id}")
    print("ATLAS_HERMES_JOB_STATUS=queued")

    kick_worker()
    deadline = time.time() + timeout_seconds + 180
    last = None
    terminal = None
    while time.time() < deadline:
        state = request_json(f"{url}/hermes/internal/jobs/{job_id}", key)
        current = state.get("job") if isinstance(state, dict) else None
        status = str((current or {}).get("status") or "unknown")
        if status != last:
            print(f"ATLAS_HERMES_JOB_STATUS={status}")
            last = status
        if status in {"completed", "failed"}:
            terminal = current
            break
        time.sleep(5)

    if terminal is None:
        raise RuntimeError("Hermes red-team job did not reach terminal state before timeout")

    safe = {
        "job_id": terminal.get("id"),
        "status": terminal.get("status"),
        "provider": terminal.get("provider"),
        "model": terminal.get("model"),
        "profile": terminal.get("profile"),
        "created_at": terminal.get("created_at"),
        "started_at": terminal.get("started_at"),
        "completed_at": terminal.get("completed_at"),
        "failed_at": terminal.get("failed_at"),
        "result": terminal.get("result"),
        "error": terminal.get("error"),
        "atlas_url": ATLAS_URL,
        "focus": args.focus,
    }

    if args.output:
        out = Path(args.output)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(safe, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"ATLAS_HERMES_OUTPUT={out}")

    if terminal.get("status") != "completed":
        print("ATLAS_HERMES_RESULT=FAILED")
        if terminal.get("error"):
            print(str(terminal.get("error"))[:1200])
        return 1

    result = str(terminal.get("result") or "").strip()
    print("ATLAS_HERMES_RESULT=PASS")
    print("--- HERMES RED TEAM RESULT ---")
    print(result[:50000])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
