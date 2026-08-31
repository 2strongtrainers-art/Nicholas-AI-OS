#!/usr/bin/env python3
"""Poll the Nicholas AI Switchboard for one allowlisted Hermes job and return its result.

No arbitrary shell is exposed. The task is always executed with Hermes in a fixed
read-only one-shot profile and the worker-only bearer key stays in a local file
with owner-only permissions outside the repository.
"""

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
ROOT = HOME / "Nicholas-AI-OS"
CONFIG_DIR = HOME / ".config" / "nicholas-ai-switchboard"
DEPLOY_ENV = CONFIG_DIR / "deployment.env"
WORKER_KEY_FILE = CONFIG_DIR / "hermes-worker.key"
LOCK = HOME / ".hermes-switchboard-worker.lock"
LOG = HOME / "Library" / "Logs" / "HermesSwitchboardWorker.log"
WORKER_USER_AGENT = "Nicholas-AI-Hermes-Worker/1.0"


def log(message: str) -> None:
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a", encoding="utf-8") as fh:
        fh.write(f"[{time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}] {message}\n")


def redact(value: str) -> str:
    value = re.sub(r"(?i)((?:api[_-]?key|token|authorization|secret)\s*[:=]\s*)\S+", r"\1[REDACTED]", value)
    return value.replace(str(HOME), "$HOME")


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
        raise RuntimeError("Hermes worker key file permissions are too broad")
    key = WORKER_KEY_FILE.read_text(encoding="utf-8").strip()
    if not key:
        raise RuntimeError("Hermes worker key file is empty")
    return key


def request_json(url: str, key: str, payload=None, retries: int = 3):
    data = json.dumps(payload or {}).encode("utf-8") if payload is not None else None
    # Cloudflare may reject Python's default urllib fingerprint before a request
    # reaches the Worker. Send an explicit service identity and standard JSON
    # headers so this background client follows the same accepted path as curl.
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": WORKER_USER_AGENT,
        "Cache-Control": "no-cache",
    }
    last_error = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, data=data, headers=headers, method="POST" if payload is not None else "GET")
            with urllib.request.urlopen(req, timeout=30) as response:
                raw = response.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as exc:
            # Never include response bodies here; an upstream error page is not
            # needed for recovery and could contain request metadata.
            last_error = RuntimeError(f"HTTP {exc.code} {exc.reason}")
            if attempt + 1 < retries:
                time.sleep(2 ** attempt)
        except Exception as exc:
            last_error = exc
            if attempt + 1 < retries:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"Switchboard request failed: {last_error}")


def hermes_bin() -> str:
    for candidate in (
        HOME / ".local" / "bin" / "hermes",
        Path("/usr/local/bin/hermes"),
        Path("/opt/homebrew/bin/hermes"),
    ):
        if candidate.exists():
            return str(candidate)
    raise RuntimeError("Hermes executable not found")


def prompt_for(task: str) -> str:
    return f"""You are Nicholas Operator/Hermes running an authenticated one-shot job from Nicholas-AI-OS.

SAFETY PROFILE — READ ONLY
- Perform reasoning and public-information research only.
- Use only the enabled search toolset.
- Do not edit or create files.
- Do not execute terminal or shell commands.
- Do not send messages, publish, schedule tasks, make purchases, modify accounts, websites, CRM/payment systems, or control the computer.
- Do not access, reveal, print, or infer credentials, tokens, API keys, .env files, Keychain data, or other secrets.
- If the task requires a mutation or capability outside this profile, explain the blocked action instead of attempting it.

USER TASK
{task}

Return the useful result directly. Distinguish verified facts from uncertainty."""


def execute(job: dict) -> str:
    job_id = str(job["id"])
    task = str(job["task"]).strip()
    timeout_seconds = max(60, min(int(job.get("timeout_seconds") or 900), 1200))
    usage_path = HOME / ".hermes" / f"{re.sub(r'[^A-Za-z0-9._-]+', '-', job_id)[:120]}-usage.json"
    usage_path.parent.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        [
            hermes_bin(),
            "--provider", "openai-codex",
            "--model", "gpt-5.6-sol",
            "--reasoning", "high",
            "--toolsets", "search",
            "--usage-file", str(usage_path),
            "--oneshot", prompt_for(task),
        ],
        cwd=str(ROOT),
        text=True,
        capture_output=True,
        timeout=timeout_seconds,
    )
    output = (result.stdout or "").strip()
    stderr = (result.stderr or "").strip()
    combined = "\n".join(x for x in (output, stderr) if x).strip()
    lower = combined.lower()
    if result.returncode != 0:
        raise RuntimeError(redact(combined or f"Hermes exited {result.returncode}")[-4000:])
    if not output or ("api call failed after" in lower and len(output.splitlines()) <= 3):
        raise RuntimeError(redact(combined or "Hermes returned no usable output")[-4000:])
    return redact(output)[:50000]


def main() -> int:
    try:
        fd = os.open(str(LOCK), os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        os.write(fd, str(os.getpid()).encode("ascii"))
        os.close(fd)
    except FileExistsError:
        return 0

    try:
        url = switchboard_url()
        key = worker_key()
        claimed = request_json(f"{url}/hermes/internal/claim", key, {})
        job = claimed.get("job") if isinstance(claimed, dict) else None
        if not job:
            return 0
        job_id = str(job.get("id") or "")
        if not job_id:
            raise RuntimeError("Claimed Hermes job has no id")
        log(f"CLAIMED {job_id}")
        try:
            output = execute(job)
            request_json(
                f"{url}/hermes/internal/jobs/{job_id}",
                key,
                {
                    "status": "completed",
                    "result": output,
                    "provider": "openai-codex",
                    "model": "gpt-5.6-sol",
                    "profile": "research_readonly",
                },
            )
            log(f"COMPLETED {job_id}")
        except Exception as exc:
            error = redact(str(exc))[-4000:]
            try:
                request_json(
                    f"{url}/hermes/internal/jobs/{job_id}",
                    key,
                    {
                        "status": "failed",
                        "error": error,
                        "provider": "openai-codex",
                        "model": "gpt-5.6-sol",
                        "profile": "research_readonly",
                    },
                )
            finally:
                log(f"FAILED {job_id}: {error}")
        return 0
    except Exception as exc:
        log(f"WORKER ERROR: {redact(str(exc))}")
        return 1
    finally:
        LOCK.unlink(missing_ok=True)


if __name__ == "__main__":
    sys.exit(main())
