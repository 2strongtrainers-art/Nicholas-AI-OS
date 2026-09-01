#!/usr/bin/env python3
import json, os, re, subprocess, tomllib
from pathlib import Path
from urllib.parse import urlparse

ROOT=Path(os.environ.get('GITHUB_WORKSPACE','.'))
OUT=ROOT/'status'/'my-gpts-link.json'
OUT.parent.mkdir(parents=True,exist_ok=True)
result={'probe':'My GPTs link target','model':'openrouter/free','pass':False,'gpt_action_secret_read':False}
clients=sorted(Path.home().glob('.codex/plugins/cache/openai-bundled/chrome/*/scripts/browser-client.mjs'))
if not clients:
    result['state']='BROWSER_CLIENT_MISSING'; OUT.write_text(json.dumps(result,indent=2)+'\n'); raise SystemExit(0)
browser_client=clients[-1]
try:
    data=json.loads((Path.home()/'.local/share/opencode/auth.json').read_text()); key=(data.get('openrouter') or {}).get('key')
except Exception: key=None
if not isinstance(key,str) or not key.strip():
    result['state']='OPENROUTER_CREDENTIAL_UNAVAILABLE'; OUT.write_text(json.dumps(result,indent=2)+'\n'); raise SystemExit(0)
env=os.environ.copy(); env['OPENROUTER_API_KEY']=key.strip()
cfg=['-c','model_provider="openrouter-temp"','-c','model="openrouter/free"','-c','model_reasoning_effort="low"','-c','model_context_window=90000','-c','model_max_output_tokens=1200','-c','disable_response_storage=true','-c','features.apps=false','-c','model_providers.openrouter-temp.name="OpenRouter Temporary"','-c','model_providers.openrouter-temp.base_url="https://openrouter.ai/api/v1"','-c','model_providers.openrouter-temp.env_key="OPENROUTER_API_KEY"','-c','model_providers.openrouter-temp.wire_api="responses"','-c','model_providers.openrouter-temp.requires_openai_auth=false']
try:
    ccfg=tomllib.loads((Path.home()/'.codex/config.toml').read_text()); names=sorted((ccfg.get('mcp_servers') or {}).keys())
except Exception: names=[]
for name in names:
    if name!='node_repl' and re.fullmatch(r'[A-Za-z0-9_.-]+',str(name)): cfg += ['-c',f'mcp_servers.{name}.enabled=false']
js=f'''const {{ setupBrowserRuntime }} = await import({json.dumps(str(browser_client))});
const agent=await setupBrowserRuntime(); const chrome=await agent.browsers.get("chrome"); await chrome.nameSession("🔎 Nick Assistant setup");
const tab=await chrome.tabs.new(); await tab.goto("https://chatgpt.com/gpts"); await tab.playwright.waitForTimeout(2500);
const out=[];
for(const role of ["link","button"]){{ try{{ const loc=tab.playwright.getByRole(role,{{name:"My GPTs",exact:true}}); const n=Math.min(await loc.count(),5); for(let i=0;i<n;i++){{const el=loc.nth(i); let href=null; try{{href=await el.getAttribute("href");}}catch{{}} out.push({{role,href}});}} }}catch{{}} }}
try{{ const loc=tab.playwright.getByText("My GPTs",{{exact:true}}); const n=Math.min(await loc.count(),5); for(let i=0;i<n;i++){{const el=loc.nth(i); let href=null; try{{href=await el.getAttribute("href");}}catch{{}} out.push({{role:"text",href}});}} }}catch{{}}
nodeRepl.write(JSON.stringify({{state:"MY_GPTS_LINK_OK",items:out}}));'''
prompt=f'''Make exactly one read-only MCP call to server `node_repl`, tool `js` using this exact JavaScript and no other tool:\n\n{js}\n\nUse title `Inspect My GPTs link` and timeout_ms 45000. Output exactly the tool result text.'''
try:
    p=subprocess.run(['codex',*cfg,'exec','--ephemeral','--json',prompt],cwd=str(ROOT),env=env,text=True,capture_output=True,timeout=100)
    raw=(p.stdout or '')+'\n'+(p.stderr or '')
    result['exit_code']=p.returncode; payload=None; calls=[]
    for ln in raw.splitlines():
        try: ev=json.loads(ln)
        except Exception: continue
        item=ev.get('item') if isinstance(ev,dict) else None
        if not isinstance(item,dict): continue
        if item.get('type')=='mcp_tool_call' and item.get('server')=='node_repl' and item.get('tool')=='js':
            calls.append({'event':ev.get('type'),'status':item.get('status'),'has_result':isinstance(item.get('result'),dict)})
            r=item.get('result') or {}
            if isinstance(r,dict):
                for part in r.get('content') or []:
                    if isinstance(part,dict) and part.get('type')=='text':
                        try:
                            obj=json.loads(str(part.get('text') or ''))
                            if obj.get('state')=='MY_GPTS_LINK_OK': payload=obj
                        except Exception: pass
    result['call_trace']=calls[-6:]
    items=[]
    for x in ((payload or {}).get('items') or []):
        href=x.get('href')
        if isinstance(href,str) and href.startswith('https://chatgpt.com'): href=urlparse(href).path
        items.append({'role':x.get('role'),'href_path':href})
    result['items']=items; result['state']=(payload or {}).get('state','NO_AUTHORITATIVE_RESULT')
    result['pass']=bool(payload and any(i.get('href_path') for i in items) and any(c.get('status')=='completed' for c in calls))
except subprocess.TimeoutExpired: result['state']='TIMEOUT'
except Exception as e: result['state']=type(e).__name__
OUT.write_text(json.dumps(result,indent=2)+'\n')
