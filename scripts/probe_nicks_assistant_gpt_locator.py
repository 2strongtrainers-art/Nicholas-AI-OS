#!/usr/bin/env python3
import json, os, re, subprocess, tomllib
from pathlib import Path

ROOT = Path(os.environ.get('GITHUB_WORKSPACE', '.'))
OUT = ROOT / 'status' / 'nicks-assistant-gpt-locator.json'
OUT.parent.mkdir(parents=True, exist_ok=True)
result = {
    'probe': 'locate existing Nick Assistant GPT in trusted Chrome',
    'model': 'openrouter/free',
    'pass': False,
    'gpt_action_secret_read': False,
}

pl = subprocess.run(['codex','plugin','list'], text=True, capture_output=True)
line = next((x for x in ((pl.stdout or '')+'\n'+(pl.stderr or '')).splitlines() if x.startswith('chrome@openai-bundled')), '')
result['chrome_plugin_enabled'] = 'installed, enabled' in line
clients = sorted(Path.home().glob('.codex/plugins/cache/openai-bundled/chrome/*/scripts/browser-client.mjs'))
if not result['chrome_plugin_enabled'] or not clients:
    result['state'] = 'CHROME_UNAVAILABLE'
    OUT.write_text(json.dumps(result, indent=2)+'\n')
    raise SystemExit(0)
browser_client = clients[-1]

auth = Path.home()/'.local/share/opencode/auth.json'
try:
    data = json.loads(auth.read_text())
    key = (data.get('openrouter') or {}).get('key')
except Exception:
    key = None
if not isinstance(key, str) or not key.strip():
    result['state'] = 'OPENROUTER_CREDENTIAL_UNAVAILABLE'
    OUT.write_text(json.dumps(result, indent=2)+'\n')
    raise SystemExit(0)

env = os.environ.copy(); env['OPENROUTER_API_KEY'] = key.strip()
cfg = [
    '-c','model_provider="openrouter-temp"',
    '-c','model="openrouter/free"',
    '-c','model_reasoning_effort="low"',
    '-c','model_context_window=120000',
    '-c','model_max_output_tokens=1536',
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

js = f'''const {{ setupBrowserRuntime }} = await import({json.dumps(str(browser_client))});
const agent = await setupBrowserRuntime({{ environment: "codex-app" }});
const ready = await agent.browsers.ensureReady({{ launch: true }});
if (ready.state !== "ready") {{ nodeRepl.write(JSON.stringify({{state:"BROWSER_NOT_READY",ready:String(ready.state)}})); }} else {{
  const chrome = await agent.browsers.getDefault();
  await chrome.nameSession("Nick Assistant setup");
  let tabs = await chrome.tabs.list();
  let tab = tabs.find(t => String(t.url||"").startsWith("https://chatgpt.com/gpts"));
  if (!tab) tab = await chrome.tabs.open("https://chatgpt.com/gpts");
  await tab.playwright.waitForTimeout(2500);
  const info = await tab.info();
  const names = ["Nick's Assistant","NK","Nicholas AI Switchboard"];
  const candidates = [];
  for (const name of names) {{
    for (const role of ["link","button"]) {{
      try {{
        const loc = tab.playwright.getByRole(role, {{name, exact:true}});
        const n = Math.min(await loc.count(), 5);
        for (let i=0;i<n;i++) {{
          const el = loc.nth(i);
          let href = null;
          try {{ href = await el.getAttribute("href"); }} catch {{}}
          candidates.push({{name,role,href}});
        }}
      }} catch {{}}
    }}
    try {{
      const loc = tab.playwright.getByText(name, {{exact:true}});
      const n = Math.min(await loc.count(), 5);
      for (let i=0;i<n;i++) {{
        const el = loc.nth(i);
        let href = null;
        try {{ href = await el.getAttribute("href"); }} catch {{}}
        candidates.push({{name,role:"text",href}});
      }}
    }} catch {{}}
  }}
  nodeRepl.write(JSON.stringify({{state:"OK",url:String(info.url||""),candidates}}));
  await chrome.tabs.finalize({{keep:[{{tab,status:"handoff"}}]}});
}}'''

prompt = f'''You must perform exactly one read-only browser tool call. Call MCP server `node_repl`, tool `js` with the exact JavaScript below. Do not call any other tool and do not modify the page.

{js}

Use title `Locate existing Nick Assistant GPT` and timeout_ms 60000. After the tool returns, output exactly its returned JSON and nothing else.'''

try:
    p = subprocess.run(['codex', *cfg, 'exec', '--ephemeral', '--json', prompt], cwd=str(ROOT), env=env, text=True, capture_output=True, timeout=150)
    raw = (p.stdout or '')+'\n'+(p.stderr or '')
    result['exit_code'] = p.returncode
    result['node_repl_js_evidence'] = bool(re.search(r'"server"\s*:\s*"node_repl"[^\n]{0,900}"tool"\s*:\s*"js"', raw, re.I))
    objs = []
    for m in re.finditer(r'\{\\?"state\\?".*?\}', raw):
        s = m.group(0).replace('\\"','"')
        try: objs.append(json.loads(s))
        except Exception: pass
    payload = next((o for o in reversed(objs) if isinstance(o,dict) and o.get('state') in ('OK','BROWSER_NOT_READY')), None)
    if payload is None:
        # Extract tool result text if JSON is nested/escaped in the JSONL event stream.
        for ln in raw.splitlines()[::-1]:
            if '"type":"text"' not in ln or 'candidates' not in ln: continue
            try:
                ev=json.loads(ln)
                content=((ev.get('item') or {}).get('result') or {}).get('content') or []
                for part in content:
                    if part.get('type')=='text':
                        o=json.loads(part.get('text') or '{}')
                        if o.get('state') in ('OK','BROWSER_NOT_READY'):
                            payload=o; break
                if payload: break
            except Exception: pass
    result['state'] = (payload or {}).get('state','NO_RESULT')
    result['url_path'] = ''
    if payload and payload.get('url'):
        try:
            from urllib.parse import urlparse
            u=urlparse(payload['url']); result['url_path']=u.path
        except Exception: pass
    cands = (payload or {}).get('candidates') or []
    safe=[]
    for c in cands:
        href=c.get('href')
        if isinstance(href,str) and href.startswith('https://chatgpt.com'):
            from urllib.parse import urlparse
            href=urlparse(href).path
        safe.append({'name':c.get('name'),'role':c.get('role'),'href_path':href})
    result['candidates']=safe
    result['candidate_count']=len(safe)
    result['pass']=bool(p.returncode==0 and result['node_repl_js_evidence'] and result['state']=='OK' and len(safe)>0)
except subprocess.TimeoutExpired:
    result['state']='TIMEOUT'
except Exception as e:
    result['state']=type(e).__name__

OUT.write_text(json.dumps(result, indent=2)+'\n')
