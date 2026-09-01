#!/usr/bin/env python3
"""Read-only verification of the first-party Codex Chrome bridge.

This script never reads page bodies, cookies, storage, passwords, or query-string
secrets. It asks Codex to use the trusted node_repl/js bridge and persists only
redacted proof that a chatgpt.com tab origin was observed.
"""

import json
import os
import re
import subprocess
import sys
import tomllib
from pathlib import Path

ROOT = Path(os.environ.get("GITHUB_WORKSPACE") or Path.cwd())
OUT = ROOT / "status" / "codex-openrouter-chrome-readonly.json"
OUT.parent.mkdir(parents=True, exist_ok=True)
MODEL = "openrouter/free"

result = {
    "probe": "codex openrouter chrome read-only",
    "model": MODEL,
    "max_output_tokens": 2048,
    "apps_disabled_for_probe": True,
    "expected": "CHROME_HARNESS_OK",
    "pass": False,
}


def finish() -> None:
    OUT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")


pl = subprocess.run(["codex", "plugin", "list"], text=True, capture_output=True)
pltext = (pl.stdout or "") + "\n" + (pl.stderr or "")
line = next((x for x in pltext.splitlines() if x.startswith("chrome@openai-bundled")), "")
result["chrome_plugin_enabled"] = "installed, enabled" in line
if not result["chrome_plugin_enabled"]:
    result["error"] = "chrome plugin not enabled"
    finish()
    raise SystemExit(0)

browser_clients = sorted(Path.home().glob(".codex/plugins/cache/openai-bundled/chrome/*/scripts/browser-client.mjs"))
if not browser_clients:
    result["error"] = "browser-client.mjs missing"
    finish()
    raise SystemExit(0)
browser_client = browser_clients[-1]
result["browser_client_present"] = True

auth = Path.home() / ".local/share/opencode/auth.json"
try:
    data = json.loads(auth.read_text(encoding="utf-8"))
except Exception:
    result["error"] = "openrouter credential source unavailable"
    finish()
    raise SystemExit(0)
entry = data.get("openrouter") if isinstance(data, dict) else None
key = entry.get("key") if isinstance(entry, dict) else None
if not isinstance(key, str) or not key.strip():
    result["error"] = "openrouter credential missing"
    finish()
    raise SystemExit(0)

env = os.environ.copy()
env["OPENROUTER_API_KEY"] = key.strip()

cfg = [
    "-c", 'model_provider="openrouter-temp"',
    "-c", f'model="{MODEL}"',
    "-c", 'model_reasoning_effort="medium"',
    "-c", "model_context_window=200000",
    "-c", "model_max_output_tokens=2048",
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
    ccfg = tomllib.loads((Path.home() / ".codex/config.toml").read_text(encoding="utf-8"))
    names = sorted((ccfg.get("mcp_servers") or {}).keys())
except Exception:
    names = []
disabled = []
for name in names:
    if name != "node_repl" and re.fullmatch(r"[A-Za-z0-9_.-]+", str(name)):
        cfg += ["-c", f"mcp_servers.{name}.enabled=false"]
        disabled.append(name)
result["unrelated_mcp_servers_disabled_count"] = len(disabled)

js = "".join(
    [
        "const { setupBrowserRuntime } = await import(" + json.dumps(str(browser_client)) + ");",
        " const agent = await setupBrowserRuntime();",
        ' const chrome = await agent.browsers.get("chrome");',
        " await chrome.documentation();",
        " const tabs = await chrome.tabs.list();",
        ' const hasChatGPT = tabs.some(t => { try { return new URL(String(t.url||"" )).origin === "https://chatgpt.com"; } catch { return false; } });',
        ' nodeRepl.write(hasChatGPT ? "CHATGPT_TAB_PRESENT" : "CHATGPT_TAB_ABSENT");',
    ]
)

prompt = f"""MANDATORY EXACT TOOL CALL. Before answering, call MCP server `node_repl`, tool `js`.
Do NOT call list_mcp_resources and do NOT guess a server named browser or chrome.
The trusted Chrome bridge is reached only through node_repl/js.

Call node_repl/js with this exact JavaScript as its `code` argument:
{js}
Use title `Read-only Chrome tab-origin verification` and timeout_ms 45000.

This code is strictly read-only: it binds the existing Chrome runtime, reads the required
Chrome documentation, lists tabs, and emits only CHATGPT_TAB_PRESENT or CHATGPT_TAB_ABSENT.
Do not navigate, click, type, submit, inspect page body content, or modify anything.
Do not expose query strings, cookies, storage, tokens, passwords, tab titles, or unrelated data.

After node_repl/js ACTUALLY returns: if it returned CHATGPT_TAB_PRESENT, output exactly
CHROME_HARNESS_OK. If it returned CHATGPT_TAB_ABSENT, output exactly CHROME_HARNESS_NO_CHATGPT.
If node_repl/js fails, output exactly CHROME_HARNESS_BLOCKED.
A response without first calling node_repl/js is invalid."""

try:
    p = subprocess.run(
        ["codex", *cfg, "exec", "--ephemeral", "--json", prompt],
        cwd=str(ROOT),
        env=env,
        text=True,
        capture_output=True,
        timeout=240,
    )
    raw = (p.stdout or "") + "\n" + (p.stderr or "")
    result["exit_code"] = p.returncode
    result["exact_ok_seen"] = "CHROME_HARNESS_OK" in raw
    result["chatgpt_tab_tool_result_seen"] = "CHATGPT_TAB_PRESENT" in raw
    node_repl_js = bool(
        re.search(r'"server"\s*:\s*"node_repl"[^\n]{0,1200}"tool"\s*:\s*"js"', raw, re.I)
    )
    result["node_repl_js_evidence"] = node_repl_js
    result["actual_browser_tool_evidence"] = bool(node_repl_js and result["chatgpt_tab_tool_result_seen"])
    result["pass"] = bool(p.returncode == 0 and result["exact_ok_seen"] and result["actual_browser_tool_evidence"])

    safe = []
    for ln in raw.splitlines():
        ll = ln.lower()
        if (
            ('"server":"node_repl"' in ll and '"tool":"js"' in ll)
            or "chrome_harness_" in ll
            or "chatgpt_tab_present" in ll
            or "chatgpt_tab_absent" in ll
            or '"type":"error"' in ll
        ):
            safe.append(ln[:1800])
    text = "\n".join(safe[-50:]).replace(str(Path.home()), "$HOME")
    text = re.sub(r'https?://[^\s"\']+', "[URL_REDACTED]", text)
    text = re.sub(r'(?i)(authorization\s*[:=]\s*)([^\s"\']+)', r"\1[REDACTED]", text)
    text = re.sub(r'(?i)(bearer\s+)[A-Za-z0-9._~+\-/=]+', r"\1[REDACTED]", text)
    text = re.sub(
        r'(?i)((?:api[_-]?key|token|password|secret|cookie)\s*[:=]\s*["\']?)([^\s,"\']+)',
        r"\1[REDACTED]",
        text,
    )
    result["safe_evidence"] = text[:10000]
except subprocess.TimeoutExpired:
    result["error"] = "codex chrome probe timed out"
except Exception as exc:
    result["error"] = type(exc).__name__

finish()
