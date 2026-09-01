#!/usr/bin/env python3
import json, os, re, subprocess, sys, tomllib
from pathlib import Path

OUT = Path(os.environ.get('GITHUB_WORKSPACE', '.')) / 'status' / 'chatgpt-trusted-chrome-auth.json'
OUT.parent.mkdir(parents=True, exist_ok=True)
result = {
    'probe': 'trusted Chrome ChatGPT auth state',
    'model': 'openrouter/free',
    'target': 'https://chatgpt.com/gpts',
    'pass': False,
    'secrets_read': False,
}

pl = subprocess.run(['codex','plugin','list'], text=True, capture_output=True)
pltext = (pl.stdout or '') + '\n' + (pl.stderr or '')
line = next((x for x in pltext.splitlines() if x.startswith('chrome@openai-bundled')), '')
result['chrome_plugin_enabled'] = 'installed, enabled' in line
if not result['chrome_plugin_enabled']:
    result['state'] = 'CHROME_PLUGIN_DISABLED'
    OUT.write_text(json.dumps(result, indent=2) + '\n')
    raise SystemExit(0)

browser_clients = sorted(Path.home().glob('.codex/plugins/cache/openai-bundled/chrome/*/scripts/browser-client.mjs'))
if not browser_clients:
    result['state'] = 'BROWSER_CLIENT_MISSING'
    OUT.write_text(json.dumps(result, indent=2) + '\n')
    raise SystemExit(0)
browser_client = browser_clients[-1]

auth = Path.home()/'.local/share/opencode/auth.json'
try:
    data = json.loads(auth.read_text())
except Exception:
    result['state'] = 'OPENROUTER_CREDENTIAL_SOURCE_UNAVAILABLE'
    OUT.write_text(json.dumps(result, indent=2) + '\n')
    raise SystemExit(0)
entry = data.get('openrouter') if isinstance(data, dict) else None
key = entry.get('key') if isinstance(entry, dict) else None
if not isinstance(key, str) or not key.strip():
    result['state'] = 'OPENROUTER_CREDENTIAL_MISSING'
    OUT.write_text(json.dumps(result, indent=2) + '\n')
    raise SystemExit(0)

env = os.environ.copy()
env['OPENROUTER_API_KEY'] = key.strip()

cfg = [
    '-c','model_provider="openrouter-temp"',
    '-c','model="openrouter/free"',
    '-c','model_reasoning_effort="medium"',
    '-c','model_context_window=200000',
    '-c','model_max_output_tokens=2048',
    '-c','service_tier="auto"',
    '-c','disable_response_storage=true',
    '-c','features.apps=false',
    '-c','model_providers.openrouter-temp.name="OpenRouter Temporary"',
    '-c','model_providers.openrouter-temp.base_url="https://openrouter.ai/api/v1"',
    '-c','model_providers.openrouter-temp.env_key="OPENROUTER_API_KEY"',
    '-c','model_providers.openrouter-temp.wire_api="responses"',
    '-c','model_providers.openrouter-temp.requires_openai_auth=false',
]
try:
    ccfg = tomllib.loads((Path.home()/'.codex/config.toml').read_text())
    names = sorted((ccfg.get('mcp_servers') or {}).keys())
except Exception:
    names = []
for name in names:
    if name != 'node_repl' and re.fullmatch(r'[A-Za-z0-9_.-]+', str(name)):
        cfg += ['-c', f'mcp_servers.{name}.enabled=false']

js = (
    'const { setupBrowserRuntime } = await import('+json.dumps(str(browser_client))+');'
    ' if (globalThis.agent?.browsers == null) { await setupBrowserRuntime({globals:globalThis}); }'
    ' const ready = await agent.browsers.ensureReady({launch:true});'
    ' if (ready.state !== "ready") { nodeRepl.write("AUTH_PROBE_BROWSER_NOT_READY:"+String(ready.state)); } else {'
    ' const chrome = await agent.browsers.getDefault();'
    ' await chrome.nameSession("Nick Assistant setup");'
    ' const tab = await chrome.tabs.open("https://chatgpt.com/gpts");'
    ' await tab.playwright.waitForTimeout(3500);'
    ' const info = await tab.info();'
    ' let origin="", path=""; try { const u=new URL(String(info.url||"")); origin=u.origin; path=u.pathname; } catch {}'
    ' let loginCount=0, myGptsCount=0;'
    ' try { loginCount += await tab.playwright.getByRole("button",{name:"Log in",exact:true}).count(); } catch {}'
    ' try { loginCount += await tab.playwright.getByRole("link",{name:"Log in",exact:true}).count(); } catch {}'
    ' try { myGptsCount += await tab.playwright.getByText("My GPTs",{exact:true}).count(); } catch {}'
    ' let state="AUTH_STATE_UNKNOWN";'
    ' if (origin !== "https://chatgpt.com" || /auth|login|signin/i.test(path) || loginCount>0) state="AUTH_STATE_LOGIN_REQUIRED";'
    ' else if (myGptsCount>0 || path.startsWith("/gpts")) state="AUTH_STATE_SIGNED_IN";'
    ' nodeRepl.write(state);'
    ' await chrome.tabs.finalize({keep:[{tab,status:"handoff"}]});'
    ' }'
)

prompt = f'''MANDATORY EXACT TOOL CALL. Before answering, call MCP server `node_repl`, tool `js` with the exact code below. Do not call list_mcp_resources and do not guess another browser server.

CODE:
{js}

Use title `Open ChatGPT GPTs in trusted Chrome` and timeout_ms 60000. The code navigates only to chatgpt.com/gpts, reads only minimal URL/login/My GPTs state, and emits one auth-state token. Do not inspect cookies, storage, tokens, passwords, or unrelated page content.

After the node_repl/js tool returns, output exactly the token it emitted: AUTH_STATE_SIGNED_IN, AUTH_STATE_LOGIN_REQUIRED, AUTH_STATE_UNKNOWN, or AUTH_PROBE_BROWSER_NOT_READY:<state>.'''

try:
    p = subprocess.run(['codex', *cfg, 'exec', '--ephemeral', '--json', prompt], cwd=os.environ.get('GITHUB_WORKSPACE') or str(Path.home()), env=env, text=True, capture_output=True, timeout=300)
    raw = (p.stdout or '') + '\n' + (p.stderr or '')
    result['exit_code'] = p.returncode
    state = None
    for token in ('AUTH_STATE_SIGNED_IN','AUTH_STATE_LOGIN_REQUIRED','AUTH_STATE_UNKNOWN'):
        if token in raw:
            state = token
            break
    if state is None:
        m = re.search(r'AUTH_PROBE_BROWSER_NOT_READY:[A-Za-z0-9_.-]+', raw)
        if m:
            state = m.group(0)
    result['state'] = state or 'NO_AUTH_STATE_TOKEN'
    result['node_repl_js_evidence'] = bool(re.search(r'"server"\s*:\s*"node_repl"[^\n]{0,700}"tool"\s*:\s*"js"', raw, re.I))
    result['pass'] = bool(p.returncode == 0 and result['node_repl_js_evidence'] and state == 'AUTH_STATE_SIGNED_IN')
    safe = []
    for ln in raw.splitlines():
        ll = ln.lower()
        if ('"server":"node_repl"' in ll and '"tool":"js"' in ll) or 'auth_state_' in ll or 'auth_probe_browser_not_ready' in ll or 'browser is not available' in ll:
            safe.append(ln[:1600])
    text='\n'.join(safe[-30:])
    text=text.replace(str(Path.home()),'$HOME')
    text=re.sub(r'https?://[^\s"\']+','[URL_REDACTED]',text)
    text=re.sub(r'(?i)(bearer\s+)[A-Za-z0-9._~+\-/=]+',r'\1[REDACTED]',text)
    result['safe_evidence']=text[:6000]
except subprocess.TimeoutExpired:
    result['state']='TIMEOUT'
except Exception as e:
    result['state']=type(e).__name__

OUT.write_text(json.dumps(result, indent=2) + '\n')
