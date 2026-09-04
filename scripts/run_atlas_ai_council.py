#!/usr/bin/env python3
"""Run a read-only Atlas AI council: Hermes research -> Ox strategy + Qwen technical critique -> Codex handoff.

This runner uses the existing Nicholas AI Switchboard and local owner-only credentials.
It does not edit Atlas, deploy code, spend money, or expose credentials. Its output is
an evidence packet that Codex can use for implementation after review.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HOME = Path.home()
CONFIG_DIR = HOME / ".config" / "nicholas-ai-switchboard"
DEPLOY_ENV = CONFIG_DIR / "deployment.env"
HERMES_WORKER_KEY_FILE = CONFIG_DIR / "hermes-worker.key"
KEYCHAIN_SERVICE = "nicholas-ai-switchboard"
KEYCHAIN_ACCOUNT = "gpt-action"
ATLAS_URL = "https://2strongtrainers-art.github.io/terrain-environmental-gis/atlas/"
ATLAS_REPORT_URL = ATLAS_URL + "build-report.json"


def redact(value: str) -> str:
    return re.sub(
        r"(?i)((?:api[_-]?key|token|authorization|secret)\s*[:=]\s*)\S+",
        r"\1[REDACTED]",
        value,
    ).replace(str(HOME), "$HOME")


def switchboard_url() -> str:
    if not DEPLOY_ENV.exists():
        raise RuntimeError("Switchboard deployment metadata is missing")
    for raw in DEPLOY_ENV.read_text(encoding="utf-8").splitlines():
        if raw.startswith("AI_SWITCHBOARD_URL="):
            value = raw.split("=", 1)[1].strip().replace("\\:", ":").replace("\\/", "/")
            if value.startswith("https://"):
                return value.rstrip("/")
    raise RuntimeError("AI_SWITCHBOARD_URL is missing")


def switchboard_key() -> str:
    if sys.platform != "darwin":
        raise RuntimeError("Switchboard Keychain lookup requires macOS")
    result = subprocess.run(
        [
            "security",
            "find-generic-password",
            "-s",
            KEYCHAIN_SERVICE,
            "-a",
            KEYCHAIN_ACCOUNT,
            "-w",
        ],
        text=True,
        capture_output=True,
        timeout=20,
    )
    key = (result.stdout or "").strip()
    if result.returncode != 0 or not key:
        raise RuntimeError("Switchboard key is missing from Keychain")
    return key


def hermes_worker_key() -> str:
    if not HERMES_WORKER_KEY_FILE.exists():
        raise RuntimeError("Hermes worker key file is missing")
    mode = HERMES_WORKER_KEY_FILE.stat().st_mode & 0o777
    if mode & 0o077:
        raise RuntimeError("Hermes worker key permissions are too broad")
    key = HERMES_WORKER_KEY_FILE.read_text(encoding="utf-8").strip()
    if not key:
        raise RuntimeError("Hermes worker key is empty")
    return key


def request_json(url: str, key: str | None = None, payload=None, timeout: int = 60):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {
        "Accept": "application/json",
        "User-Agent": "Nicholas-Atlas-AI-Council/1.0",
        "Cache-Control": "no-cache",
    }
    if data is not None:
        headers["Content-Type"] = "application/json"
    if key:
        headers["Authorization"] = f"Bearer {key}"
    req = urllib.request.Request(
        url,
        data=data,
        method="POST" if payload is not None else "GET",
        headers=headers,
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        body = ""
        try:
            body = exc.read().decode("utf-8", "replace")
        except Exception:
            pass
        raise RuntimeError(f"HTTP {exc.code}: {redact(body)[:500]}") from exc


def fetch_live_report() -> dict:
    payload = request_json(ATLAS_REPORT_URL, None, None, 30)
    if not isinstance(payload, dict):
        raise RuntimeError("Atlas build report did not return a JSON object")
    return payload


def kick_hermes_worker() -> None:
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


def run_hermes(url: str, worker_key: str, live_report: dict, focus: str, timeout_seconds: int) -> dict:
    compact_report = json.dumps(live_report, separators=(",", ":"), ensure_ascii=False)[:12000]
    task = f"""ATLAS COUNCIL — HERMES RESEARCH ROLE (READ ONLY)

Production Atlas: {ATLAS_URL}
Current production build report: {compact_report}
Nick focus: {focus}

You are the council's research and adversarial scout. Use public-web research only. Do not edit files, deploy, purchase, message, or access private credentials.

Research what Atlas may be missing despite its internal tests. Compare current discovery-product patterns from relevant products such as There’s An AI For That, Toolify, Futurepedia, AlternativeTo, Product Hunt, JustWatch, and other useful comparables. Generate at least 40 new realistic user requests that can expose search/routing blind spots. Identify missing official/legal resources, missing workflow/Stack ideas, trust problems, retention opportunities, mobile/discovery friction, and ethical monetization opportunities.

Return:
1. Observed facts vs hypotheses.
2. 10 likely blind spots with exact query examples.
3. 10 highest-value product opportunities.
4. 5 missing Stack/workflow ideas.
5. 3 changes you believe Codex should implement next.

Hard rules: do not fabricate traffic, popularity, pricing, login requirements, verification, ratings, or commercial relationships. Free is not the same as no-login. Prefer official/legal/safe sources."""
    created = request_json(
        f"{url}/hermes/internal/jobs",
        worker_key,
        {"task": task, "timeout_seconds": timeout_seconds},
        30,
    )
    job = created.get("job") if isinstance(created, dict) else None
    job_id = str((job or {}).get("id") or "")
    if not job_id:
        raise RuntimeError("Hermes job was not created")
    print(f"COUNCIL_HERMES_JOB_ID={job_id}")
    kick_hermes_worker()
    deadline = time.time() + timeout_seconds + 180
    while time.time() < deadline:
        state = request_json(f"{url}/hermes/internal/jobs/{job_id}", worker_key, None, 30)
        current = state.get("job") if isinstance(state, dict) else None
        status = str((current or {}).get("status") or "unknown")
        if status in {"completed", "failed"}:
            return current or {}
        time.sleep(5)
    raise RuntimeError("Hermes council job timed out")


HARD_QUESTIONS = """Answer the same ten hard questions independently:
1. What would most increase repeat usage rather than one-time browsing?
2. What are the most dangerous search/routing blind spots still likely to exist?
3. Which missing sections would add real user value rather than navigation clutter?
4. Which complete Stacks/workflows should Atlas build first?
5. What would make the iPhone experience materially easier for a first-time user?
6. Where could Atlas accidentally damage trust or overstate verification/access?
7. Which analytics signals should change ranking or roadmap decisions, and which should not?
8. What ethical monetization model best fits Atlas without corrupting organic ranking?
9. What performance or architecture risks become important as the dataset and features grow?
10. Rank the next five changes by Impact / Confidence / Effort / Risk and choose the top three."""


def ask_model(url: str, key: str, model: str, system: str, prompt: str, max_tokens: int = 7000) -> dict:
    payload = request_json(
        f"{url}/ask",
        key,
        {
            "model": model,
            "system": system,
            "prompt": prompt,
            "max_tokens": max_tokens,
        },
        180,
    )
    if not isinstance(payload, dict) or payload.get("ok") is not True:
        raise RuntimeError(f"{model} switchboard call failed: {redact(str(payload))[:800]}")
    return payload


def build_shared_brief(live_report: dict, hermes: dict, focus: str) -> str:
    hermes_text = str(hermes.get("result") or hermes.get("error") or "Hermes returned no result")
    return f"""NICK'S DIGITAL ATLAS COUNCIL REVIEW

Production URL: {ATLAS_URL}
Nick focus: {focus}

CURRENT LIVE BUILD REPORT
{json.dumps(live_report, indent=2, ensure_ascii=False)[:18000]}

HERMES PUBLIC-RESEARCH PACKET
{hermes_text[:30000]}

{HARD_QUESTIONS}

Requirements:
- Treat the live build report as current evidence; do not invent counts or capabilities.
- Distinguish facts from hypotheses.
- Preserve strict free vs no-login semantics.
- Do not recommend selling verification or organic ranking.
- Be concrete enough that Codex can translate your answer into tests and code.
"""


def make_markdown(packet: dict) -> str:
    def section(title: str, text: str) -> str:
        return f"\n## {title}\n\n{text.strip()}\n"

    models = packet.get("models", {})
    lines = [
        "# Atlas AI Council — Codex Handoff",
        "",
        f"Generated: {packet.get('generated_at')}",
        f"Production: {ATLAS_URL}",
        f"Ox resolved model: {models.get('ox')}",
        f"Qwen resolved model: {models.get('qwen')}",
        "",
        "Council roles: Hermes = public research/red team; Ox = product architect; Qwen = technical systems critic; Codex = implementation + production certification.",
    ]
    lines.append(section("Hermes research", str(packet.get("hermes", {}).get("result") or packet.get("hermes", {}).get("error") or "No Hermes result")))
    lines.append(section("Ox product strategy", str(packet.get("ox", {}).get("text") or "No Ox result")))
    lines.append(section("Qwen technical critique", str(packet.get("qwen", {}).get("text") or "No Qwen result")))
    lines.append(
        section(
            "Codex implementation rule",
            "Compare areas of agreement and disagreement. Implement only changes supported by evidence and compatible with current production. Preserve working features. Add/adjust tests before claiming a fix. Deploy, test live production, repair failures, and report exact evidence. Do not treat any council recommendation as automatically correct.",
        )
    )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--focus", default="Improve Atlas discovery, workflows, repeat usage, trust, and monetization without adding clutter")
    parser.add_argument("--output", default="atlas-ai-council.json")
    parser.add_argument("--markdown", default="atlas-ai-council-codex-handoff.md")
    parser.add_argument("--timeout", type=int, default=1200)
    args = parser.parse_args()

    url = switchboard_url()
    ask_key = switchboard_key()
    worker_key = hermes_worker_key()
    live_report = fetch_live_report()
    timeout_seconds = max(180, min(args.timeout, 1200))

    models = request_json(f"{url}/models?refresh=1", ask_key, None, 60)
    if not isinstance(models, dict) or models.get("ok") is not True:
        raise RuntimeError("Switchboard model resolution failed")
    print(f"COUNCIL_OX_MODEL={models.get('ox')}")
    print(f"COUNCIL_QWEN_MODEL={models.get('qwen')}")

    hermes = run_hermes(url, worker_key, live_report, args.focus, timeout_seconds)
    if hermes.get("status") != "completed":
        raise RuntimeError(f"Hermes did not complete: {redact(str(hermes.get('error') or hermes))[:1000]}")
    print("COUNCIL_HERMES=PASS")

    brief = build_shared_brief(live_report, hermes, args.focus)
    ox = ask_model(
        url,
        ask_key,
        "ox",
        "You are the Atlas council product architect and skeptical strategist. Focus on product architecture, user psychology, discovery, retention, trust, differentiation, and ethical monetization. Challenge unnecessary complexity. Do not write code.",
        brief,
    )
    print(f"COUNCIL_OX=PASS resolved_model={ox.get('resolved_model')}")

    qwen = ask_model(
        url,
        ask_key,
        "qwen",
        "You are the Atlas council technical systems analyst and search-engine red team. Focus on intent parsing, ranking, data structure, metadata quality, false positives, test design, performance, mobile failure modes, observability, and implementation risk. Challenge weak assumptions. Do not edit code.",
        brief,
    )
    print(f"COUNCIL_QWEN=PASS resolved_model={qwen.get('resolved_model')}")

    packet = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "atlas_url": ATLAS_URL,
        "focus": args.focus,
        "live_build_report": live_report,
        "models": {
            "ox": models.get("ox"),
            "qwen": models.get("qwen"),
            "auto": models.get("auto"),
        },
        "hermes": hermes,
        "ox": ox,
        "qwen": qwen,
        "codex_role": "Compare council outputs, implement evidence-supported changes, then deploy and certify live production.",
    }

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(packet, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    md = Path(args.markdown)
    md.parent.mkdir(parents=True, exist_ok=True)
    md.write_text(make_markdown(packet), encoding="utf-8")
    print(f"COUNCIL_JSON={out}")
    print(f"COUNCIL_CODEX_HANDOFF={md}")
    print("ATLAS_AI_COUNCIL=PASS")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print("ATLAS_AI_COUNCIL=FAIL")
        print(redact(str(exc))[:2000])
        raise
