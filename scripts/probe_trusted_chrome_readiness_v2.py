#!/usr/bin/env python3
import json, os, re, subprocess, tomllib
from pathlib import Path

ROOT=Path(os.environ.get('GITHUB_WORKSPACE','.'))
OUT=ROOT/'status'/'trusted-chrome-readiness-v2.json'
OUT.parent.mkdir(parents=True,exist_ok=True)
result={'probe':'strict trusted Chrome readiness v2','model':'openrouter/free','pass':False,'gpt_action_secret_read':False}

pl=subprocess.run(['codex','plugin','list'],text=True,capture_output=True)
line=next((x for x in ((pl.stdout or '')+'\n'+(pl.stderr or '')).splitlines() if x.startswith('chrome@openai-bundled')), '')
clients=sorted(Path.home().glob('.codex/plugins/cache/openai-bundled/chrome/*/scripts/browser-client.mjs'))
result['chrome_plugin_enabled']='installed, enabled' in line
if not result['chrome_plugin_enabled'] or not clients:
    result['state']='CHROME_UNAVAILABLE'; OUT.write_text(json.dumps(result,indent=2)+'\n'); raise SystemExit(0)
browser_client=clients[-1]

try:
    data=json.loads((Path.home()/'.local/share/opencode/auth.json').read_text()); key=(data.get('openrouter') or {}).get('key')
except Exception: key=None
if not isinstance(key,str) or not key.strip():
    result['state']='OPENROUTER_CREDENTIAL_UNAVAILABLE'; OUT.write_text(json.dumps(result,indent=2)+'\n'); raise SystemExit(0)
env=os.environ.copy(); env['OPENROUTER_API_KEY']=key.strip()

cfg=['-c','model_provider="openrouter-temp"','-c','model="openrouter/free"','-c','model_reasoning_effort="low"','-c','model_context_window=120000','-c','model_max_output_tokens=1536','-c','disable_response_storage=true','-c','features.apps=false','-c','model_providers.openrouter-temp.name="OpenRouter Temporary"','-c','model_providers.openrouter-temp.base_url="https://openrouter.ai/api/v1"','-c','model_providers.openrouter-temp.env_key="OPENROUTER_API_KEY"','-c','model_providers.openrouter-temp.wire_api="responses"','-c','model_providers.openrouter-temp.requires_openai_auth=false']
try:
    ccfg=tomllib.loads((Path.home()/'.codex/config.toml').read_text()); names=sorted((ccfg.get('mcp_servers') or {}).keys())
except Exception: names=[]
for name in names:
    if name!='node_repl' and re.fullmatch(r'[A-Za-z0-9_.-]+',str(name)): cfg += ['-c',f'mcp_servers.{name}.enabled=false']

js=f'''const {{ setupBrowserRuntime }} = await import({json.dumps(str(browser_client))});
const agent = await setupBrowserRuntime({{ environment: "codex-app" }});
const ready = await agent.browsers.ensureReady({{ launch: true }});
if (ready.state !== "ready") {{
  nodeRepl.write("READINESS_NOT_READY:"+String(ready.state));
}} else {{
  const chrome = await agent.browsers.getDefault();
  await chrome.nameSession("Nick Assistant setup");
  const tab = await chrome.tabs.open("https://chatgpt.com/gpts");
  await tab.playwright.waitForTimeout(2500);
  const info = await tab.info();
  let origin="", path=""; try {{ const u=new URL(String(info.url||"")); origin=u.origin; path=u.pathname; }} catch {{}}
  let loginCount=0, myGptsCount=0;
  try {{ loginCount += await tab.playwright.getByRole("button",{{name:"Log in",exact:true}}).count(); }} catch {{}}
  try {{ loginCount += await tab.playwright.getByRole("link",{{name:"Log in",exact:true}}).count(); }} catch {{}}
  try {{ myGptsCount += await tab.playwright.getByText("My GPTs",{{exact:true}}).count(); }} catch {{}}
  let state="READINESS_AUTH_UNKNOWN";
  if (origin !== "https://chatgpt.com" || /auth|login|signin/i.test(path) || loginCount>0) state="READINESS_LOGIN_REQUIRED";
  else if (myGptsCount>0 || path.startsWith("/gpts")) state="READINESS_SIGNED_IN";
  nodeRepl.write(state);
  await chrome.tabs.finalize({{keep:[{{tab,status:"handoff"}}]}});
}}'''
prompt=f'''MANDATORY: make exactly one MCP call to server `node_repl`, tool `js`, with the exact JavaScript below. Do not call any other tool. Do not rewrite the JavaScript.\n\n{js}\n\nUse title `Strict trusted Chrome readiness` and timeout_ms 60000. After the tool result, output exactly that result text.'''

try:
    p=subprocess.run(['codex',*cfg,'exec','--ephemeral','--json',prompt],cwd=str(ROOT),env=env,text=True,capture_output=True,timeout=150)
    raw=(p.stdout or '')+'\n'+(p.stderr or '')
    result['exit_code']=p.returncode
    completed_texts=[]; tool_errors=[]; tool_calls=0; completed_calls=0
    for ln in raw.splitlines():
        try: ev=json.loads(ln)
        except Exception: continue
        item=ev.get('item') if isinstance(ev,dict) else None
        if not isinstance(item,dict): continue
        if item.get('type')=='mcp_tool_call' and item.get('server')=='node_repl' and item.get('tool')=='js':
            tool_calls += 1
            if item.get('status')=='completed':
                completed_calls += 1
                r=item.get('result') or {}
                if isinstance(r,dict):
                    for part in r.get('content') or []:
                        if isinstance(part,dict) and part.get('type')=='text': completed_texts.append(str(part.get('text') or ''))
            err=item.get('error')
            if err:
                s=str(err).replace(str(Path.home()),'$HOME')
                s=re.sub(r'https?://[^\s"\']+','[URL_REDACTED]',s)
                s=re.sub(r'(?i)(bearer\s+)[A-Za-z0-9._~+\-/=]+',r'\1[REDACTED]',s)
                tool_errors.append(s[:500])
    authoritative=None
    for txt in reversed(completed_texts):
        if txt in ('READINESS_SIGNED_IN','READINESS_LOGIN_REQUIRED','READINESS_AUTH_UNKNOWN') or txt.startswith('READINESS_NOT_READY:'):
            authoritative=txt; break
    result['node_repl_js_calls']=tool_calls
    result['node_repl_js_completed']=completed_calls
    result['authoritative_tool_result']=authoritative
    result['tool_errors']=tool_errors[-5:]
    result['state']=authoritative or ('TOOL_ERROR' if tool_errors else 'NO_AUTHORITATIVE_RESULT')
    result['pass']=bool(p.returncode==0 and authoritative=='READINESS_SIGNED_IN' and completed_calls>0)
except subprocess.TimeoutExpired:
    result['state']='TIMEOUT'
except Exception as e:
    result['state']=type(e).__name__

OUT.write_text(json.dumps(result,indent=2)+'\n')
