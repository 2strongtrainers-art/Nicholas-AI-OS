#!/usr/bin/env python3
import json, os, re, subprocess, tomllib
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(os.environ.get('GITHUB_WORKSPACE', '.'))
OUT = ROOT / 'status' / 'nicks-assistant-gpt-locator-v2.json'
OUT.parent.mkdir(parents=True, exist_ok=True)
result = {'probe':'locate existing Nick Assistant GPT in trusted Chrome v2','model':'openrouter/free','pass':False,'gpt_action_secret_read':False}

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
if (ready.state !== "ready") {{ nodeRepl.write(JSON.stringify({{state:"BROWSER_NOT_READY",ready:String(ready.state)}})); }} else {{
 const chrome=await agent.browsers.getDefault(); await chrome.nameSession("Nick Assistant setup");
 let tabs=await chrome.tabs.list(); let tab=tabs.find(t=>String(t.url||"").startsWith("https://chatgpt.com/gpts")); if(!tab) tab=await chrome.tabs.open("https://chatgpt.com/gpts");
 await tab.playwright.waitForTimeout(2500); const info=await tab.info();
 const names=["Nick's Assistant","NK","Nicholas AI Switchboard"]; const candidates=[];
 for(const name of names){{
   for(const role of ["link","button"]){{ try{{ const loc=tab.playwright.getByRole(role,{{name,exact:true}}); const n=Math.min(await loc.count(),5); for(let i=0;i<n;i++){{const el=loc.nth(i); let href=null; try{{href=await el.getAttribute("href");}}catch{{}} candidates.push({{name,role,href}});}} }}catch{{}} }}
   try{{ const loc=tab.playwright.getByText(name,{{exact:true}}); const n=Math.min(await loc.count(),5); for(let i=0;i<n;i++){{const el=loc.nth(i); let href=null; try{{href=await el.getAttribute("href");}}catch{{}} candidates.push({{name,role:"text",href}});}} }}catch{{}}
 }}
 nodeRepl.write(JSON.stringify({{state:"OK",url:String(info.url||""),candidates}}));
 await chrome.tabs.finalize({{keep:[{{tab,status:"handoff"}}]}});
}}'''
prompt=f'''Perform exactly one read-only browser call. Call MCP server `node_repl`, tool `js` with the exact code below and no other tool. Do not modify the page.\n\n{js}\n\nUse title `Locate existing Nick Assistant GPT v2` and timeout_ms 60000. Then output exactly the returned tool text.'''

try:
    p=subprocess.run(['codex',*cfg,'exec','--ephemeral','--json',prompt],cwd=str(ROOT),env=env,text=True,capture_output=True,timeout=150)
    raw=(p.stdout or '')+'\n'+(p.stderr or '')
    result['exit_code']=p.returncode
    payload=None; tool_calls=0; tool_completed=0
    for ln in raw.splitlines():
        try: ev=json.loads(ln)
        except Exception: continue
        item=ev.get('item') if isinstance(ev,dict) else None
        if not isinstance(item,dict): continue
        if item.get('type')=='mcp_tool_call' and item.get('server')=='node_repl' and item.get('tool')=='js':
            tool_calls += 1
            if item.get('status')=='completed': tool_completed += 1
            content=((item.get('result') or {}).get('content') or []) if isinstance(item.get('result'),dict) else []
            for part in content:
                if not isinstance(part,dict) or part.get('type')!='text': continue
                txt=part.get('text') or ''
                try: obj=json.loads(txt)
                except Exception: continue
                if isinstance(obj,dict) and obj.get('state') in ('OK','BROWSER_NOT_READY'): payload=obj
        if item.get('type')=='agent_message':
            txt=item.get('text') or ''
            try: obj=json.loads(txt)
            except Exception: obj=None
            if isinstance(obj,dict) and obj.get('state') in ('OK','BROWSER_NOT_READY'): payload=obj
    result['node_repl_js_calls']=tool_calls; result['node_repl_js_completed']=tool_completed
    result['node_repl_js_evidence']=tool_calls>0
    result['state']=(payload or {}).get('state','NO_RESULT')
    url=(payload or {}).get('url') or ''
    try: result['url_path']=urlparse(url).path if url else ''
    except Exception: result['url_path']=''
    safe=[]
    for c in ((payload or {}).get('candidates') or []):
        href=c.get('href')
        if isinstance(href,str) and href.startswith('https://chatgpt.com'): href=urlparse(href).path
        safe.append({'name':c.get('name'),'role':c.get('role'),'href_path':href})
    result['candidates']=safe; result['candidate_count']=len(safe)
    result['pass']=bool(p.returncode==0 and tool_completed>0 and result['state']=='OK' and len(safe)>0)
except subprocess.TimeoutExpired:
    result['state']='TIMEOUT'
except Exception as e:
    result['state']=type(e).__name__

OUT.write_text(json.dumps(result,indent=2)+'\n')
