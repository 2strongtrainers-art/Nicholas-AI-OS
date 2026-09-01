#!/usr/bin/env python3
import json
import os
import re
import subprocess
import sys
import tomllib
from pathlib import Path

ROOT = Path(os.environ.get("GITHUB_WORKSPACE") or Path.home() / "Nicholas-AI-OS")
OUT = ROOT / "status" / "nicks-assistant-chrome-update.json"
OUT.parent.mkdir(parents=True, exist_ok=True)
INSTRUCTIONS = ROOT / "services" / "ai-switchboard" / "GPT_INSTRUCTIONS.md"
SCHEMA_URL = "https://nicholas-ai-switchboard.2strongtrainers.workers.dev/openapi.json?v=1.2.0"
MODEL = "openrouter/free"

result = {
    "probe": "update existing Nicks Assistant GPT via trusted Chrome harness",
    "model": MODEL,
    "max_output_tokens": 4096,
    "apps_disabled_for_run": True,
    "schema_url": SCHEMA_URL,
    "bearer_rotated": False,
    "pass": False,
    "secrets_read": False,
}


def finish(**kwargs):
    result.update(kwargs)
    OUT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    raise SystemExit(0)


if not INSTRUCTIONS.exists() or not INSTRUCTIONS.read_text(encoding="utf-8").strip():
    finish(error="GPT instructions file missing")

pl = subprocess.run(["codex", "plugin", "list"], text=True, capture_output=True)
pltext = (pl.stdout or "") + "\n" + (pl.stderr or "")
line = next((x for x in pltext.splitlines() if x.startswith("chrome@openai-bundled")), "")
result["chrome_plugin_enabled"] = "installed, enabled" in line
if not result["chrome_plugin_enabled"]:
    finish(error="chrome plugin not enabled")

browser_clients = sorted(Path.home().glob(".codex/plugins/cache/openai-bundled/chrome/*/scripts/browser-client.mjs"))
if not browser_clients:
    finish(error="browser-client.mjs missing")
browser_client = browser_clients[-1]
result["browser_client_present"] = True

auth = Path.home() / ".local" / "share" / "opencode" / "auth.json"
try:
    data = json.loads(auth.read_text(encoding="utf-8"))
except Exception:
    finish(error="openrouter credential source unavailable")
entry = data.get("openrouter") if isinstance(data, dict) else None
key = entry.get("key") if isinstance(entry, dict) else None
if not isinstance(key, str) or not key.strip():
    finish(error="openrouter credential missing")

env = os.environ.copy()
env["OPENROUTER_API_KEY"] = key.strip()

cfg = [
    "-c", 'model_provider="openrouter-temp"',
    "-c", f'model="{MODEL}"',
    "-c", 'model_reasoning_effort="medium"',
    "-c", "model_context_window=200000",
    "-c", "model_max_output_tokens=4096",
    "-c", 'service_tier="auto"',
    "-c", "disable_response_storage=true",
    "-c", "features.apps=false",
    "-c", 'model_providers.openrouter-temp.name="OpenRouter Temporary"',
    "-c", 'model_providers.openrouter-temp.base_url="https://openrouter.ai/api/v1"',
    "-c", 'model_providers.openrouter-temp.env_key="OPENROUTER_API_KEY"',
    "-c", 'model_providers.openrouter-temp.wire_api="responses"',
    "-c", "model_providers.openrouter-temp.requires_openai_auth=false",
]

try:
    ccfg = tomllib.loads((Path.home() / ".codex" / "config.toml").read_text(encoding="utf-8"))
    names = sorted((ccfg.get("mcp_servers") or {}).keys())
except Exception:
    names = []
disabled = []
for name in names:
    if name != "node_repl" and re.fullmatch(r"[A-Za-z0-9_.-]+", str(name)):
        cfg += ["-c", f"mcp_servers.{name}.enabled=false"]
        disabled.append(name)
result["unrelated_mcp_servers_disabled_count"] = len(disabled)

setup_js = (
    "const { setupBrowserRuntime } = await import(" + json.dumps(str(browser_client)) + ");"
    " globalThis.__nicholasAgent = await setupBrowserRuntime({ environment: \"codex-app\" });"
    " const __ready = await globalThis.__nicholasAgent.browsers.ensureReady({launch:true});"
    " if (__ready.state !== \"ready\") { throw new Error(\"BROWSER_NOT_READY:\"+String(__ready.state)); }"
    " globalThis.__nicholasChrome = await globalThis.__nicholasAgent.browsers.getDefault();"
    " await globalThis.__nicholasChrome.nameSession(\"Nick Assistant editor update\");"
    " nodeRepl.write(await globalThis.__nicholasChrome.documentation());"
)

prompt = f"""You are completing one narrowly authorized browser task for Nicholas-AI-OS. Browser access is ONLY through MCP server `node_repl`, tool `js`. Do not call list_mcp_resources and do not guess servers named browser or chrome.

FIRST REQUIRED TOOL CALL
Call node_repl/js with this exact JavaScript as `code`:
{setup_js}
Use title `Initialize trusted Chrome control` and timeout_ms 60000. The returned text is the authoritative Chrome interaction documentation. Follow it for every later browser interaction, also through node_repl/js.

GOAL
Update the EXISTING custom GPT named Nick's Assistant / NK / Nicholas AI Switchboard to the repository's current v1.2 Switchboard configuration.

AUTHORITATIVE LOCAL INPUT
Read the complete local file `services/ai-switchboard/GPT_INSTRUCTIONS.md` and use its text EXACTLY as the GPT Instructions field content.
Schema URL: {SCHEMA_URL}

STRICT SCOPE
- Existing GPT only. Do NOT create a duplicate.
- Do NOT rename it or change icon, conversation starters, visibility, sharing, ownership, or unrelated settings.
- Use Actions, not Apps.
- Preserve the EXISTING Action authentication exactly. Do NOT reveal, copy, inspect, rotate, delete, replace, or re-enter any API key/Bearer value.
- You may inspect only whether authentication is configured, never its secret value.
- If refreshing/importing the schema would clear/reset authentication, STOP before saving and return NICKS_ASSISTANT_UPDATE_BLOCKED_AUTH.
- If login/re-authentication, CAPTCHA, macOS security prompt, destructive confirmation, or ambiguous GPT/account selection appears, STOP and return NICKS_ASSISTANT_UPDATE_BLOCKED.
- Never inspect or expose cookies, local/session storage, query-string secrets, tokens, passwords, or unrelated content.

REQUIRED REAL BROWSER STEPS
1. Through `globalThis.__nicholasChrome`, open or navigate to `https://chatgpt.com/gpts` and verify the signed-in My GPTs state.
2. Find My GPTs and identify exactly one EXISTING GPT matching Nick's Assistant / NK / Nicholas AI Switchboard. Stop if ambiguous.
3. Open that GPT's Edit/Configure UI.
4. Replace only its Instructions field with the exact local file contents.
5. Ensure the GPT uses Actions rather than Apps without changing unrelated capabilities.
6. Open the existing Nicholas AI Switchboard Action and refresh/import `{SCHEMA_URL}` while preserving existing authentication.
7. Verify the UI exposes all six operation IDs exactly: `switchboardHealth`, `switchboardModels`, `switchboardAsk`, `routeNicholasTool`, `createHermesJob`, `getHermesJob`.
8. Verify authentication remains configured without revealing its value.
9. Click Update/Save exactly once to persist only these scoped changes.
10. Re-read the editor state after save and verify the same GPT remains selected and all six operations remain present.

FINAL OUTPUT
Return exactly `NICKS_ASSISTANT_UPDATE_OK` only after every real browser step and post-save verification succeeds. Return exactly `NICKS_ASSISTANT_UPDATE_BLOCKED_AUTH` for an authentication-preservation blocker. Otherwise return exactly `NICKS_ASSISTANT_UPDATE_BLOCKED`. Do not claim success without actual `node_repl/js` browser tool calls.
"""

try:
    p = subprocess.run(
        ["codex", *cfg, "exec", "--ephemeral", "--json", prompt],
        cwd=str(ROOT),
        env=env,
        text=True,
        capture_output=True,
        timeout=600,
    )
    raw = (p.stdout or "") + "\n" + (p.stderr or "")
    result["exit_code"] = p.returncode
    result["exact_ok_seen"] = "NICKS_ASSISTANT_UPDATE_OK" in raw
    result["blocked_auth_seen"] = "NICKS_ASSISTANT_UPDATE_BLOCKED_AUTH" in raw
    result["blocked_seen"] = "NICKS_ASSISTANT_UPDATE_BLOCKED" in raw and not result["exact_ok_seen"]
    node_repl_js = bool(re.search(r'"server"\s*:\s*"node_repl"[^\n]{{0,1000}}"tool"\s*:\s*"js"', raw, re.I))
    result["node_repl_js_evidence"] = node_repl_js
    result["pass"] = bool(p.returncode == 0 and result["exact_ok_seen"] and node_repl_js)

    safe = []
    for ln in raw.splitlines():
        ll = ln.lower()
        if ('"server":"node_repl"' in ll and '"tool":"js"' in ll) or "nicks_assistant_update_" in ll or "browser_not_ready" in ll or '"type":"error"' in ll:
            safe.append(ln[:1800])
    text = "\n".join(safe[-80:]).replace(str(Path.home()), "$HOME")
    text = re.sub(r"https?://[^\s\"']+", "[URL_REDACTED]", text)
    text = re.sub(r"(?i)(authorization\s*[:=]\s*)([^\s\"']+)", r"\1[REDACTED]", text)
    text = re.sub(r"(?i)(bearer\s+)[A-Za-z0-9._~+\-/=]+", r"\1[REDACTED]", text)
    text = re.sub(r"(?i)((?:api[_-]?key|token|password|secret|cookie)\s*[:=]\s*[\"']?)([^\s,\"']+)", r"\1[REDACTED]", text)
    result["safe_evidence"] = text[:14000]
except subprocess.TimeoutExpired:
    result["error"] = "browser editor run timed out"
except Exception as exc:
    result["error"] = type(exc).__name__

OUT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
