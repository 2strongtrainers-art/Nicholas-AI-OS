#!/usr/bin/env python3
import json, os, re, subprocess, tomllib
from pathlib import Path
from urllib.parse import urlparse

ROOT=Path(os.environ.get('GITHUB_WORKSPACE','.'))
OUT=ROOT/'status'/'nicks-assistant-owner-list.json'
OUT.parent.mkdir(parents=True,exist_ok=True)
result={'probe':'locate Nick Assistant via visible My GPTs owner list','model':'openrouter/free','pass':False,'gpt_action_secret_read':False}
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
cfg=['-c','model_provider="openrouter-temp"','-c','model="openrouter/free"','-c','model_reasoning_effort="low"','-c','model_context_window=100000','-c','model_max_output_tokens=1600','-c','disable_response_storage=true','-c','features.apps=false','-c','model_providers.openrouter-temp.name="OpenRouter Temporary"','-c','model_providers.openrouter-temp.base_url="https://openrouter.ai/api/v1"','-c','model_providers.openrouter-temp.env_key="OPENROUTER_API_KEY"','-c','model_providers.openrouter-temp.wire_api="responses"','-c','model_providers.openrouter-temp.requires_openai_auth=false']
try:
    ccfg=tomllib.loads((Path.home()/'.codex/config.toml').read_text()); names=sorted((ccfg.get('mcp_servers') or {}).keys())
except Exception: names=[]
for name in names:
    if name!='node_repl' and re.fullmatch(r'[A-Za-z0-9_.-]+',str(name)): cfg += ['-c',f'mcp_servers.{name}.enabled=false']

js=f'''const {{ setupBrowserRuntime }} = await import({json.dumps(str(browser_client))});
const agent=await setupBrowserRuntime(); const chrome=await agent.browsers.get("chrome"); await chrome.nameSession("🔎 Nick Assistant owner list");
const tab=await chrome.tabs.new(); await tab.goto("https://chatgpt.com/gpts"); await tab.playwright.waitForTimeout(2500);
let clicked=false, sourceRole=null;
for(const role of ["link","button"]){{
  if(clicked) break;
  try{{ const loc=tab.playwright.getByRole(role,{{name:"My GPTs",exact:true}}); const n=await loc.count(); if(n>0){{ await loc.nth(0).click(); clicked=true; sourceRole=role; }} }}catch{{}}
}}
if(!clicked){{ try{{ const loc=tab.playwright.getByText("My GPTs",{{exact:true}}); const n=await loc.count(); if(n>0){{await loc.nth(0).click(); clicked=true; sourceRole="text";}} }}catch{{}} }}
await tab.playwright.waitForTimeout(3000);
const currentUrl=String(await tab.url()||"");
const names=["Nick's Assistant","NK","Nicholas AI Switchboard"]; const candidates=[];
for(const name of names){{
  for(const role of ["link","button"]){{
    try{{const loc=tab.playwright.getByRole(role,{{name,exact:true}}); const n=Math.min(await loc.count(),5); for(let i=0;i<n;i++){{const el=loc.nth(i);let href=null;try{{href=await el.getAttribute("href");}}catch{{}}candidates.push({{name,role,href}});}}}}catch{{}}
  }}
  try{{const loc=tab.playwright.getByText(name,{{exact:true}}); const n=Math.min(await loc.count(),5); for(let i=0;i<n;i++){{const el=loc.nth(i);let href=null;try{{href=await el.getAttribute("href");}}catch{{}}candidates.push({{name,role:"text",href}});}}}}catch{{}}
}}
let headingTexts=[]; for(const h of ["heading"]){{try{{const loc=tab.playwright.getByRole(h);const n=Math.min(await loc.count(),12);for(let i=0;i<n;i++){{try{{headingTexts.push(await loc.nth(i).innerText());}}catch{{}}}}}}catch{{}}}}
await tab.markHandoff(); nodeRepl.write(JSON.stringify({{state:"OWNER_LIST_OK",clicked,sourceRole,url:currentUrl,candidates,headingTexts:headingTexts.slice(0,12)}}));'''
prompt=f'''Make exactly one MCP call to server `node_repl`, tool `js` with the exact JavaScript below and no other tool. It only navigates within ChatGPT from GPTs to the visible My GPTs owner list and reads exact GPT labels/headings.\n\n{js}\n\nUse title `Locate Nick Assistant owner list` and timeout_ms 60000. Then output exactly the tool result text.'''
try:
    p=subprocess.run(['codex',*cfg,'exec','--ephemeral','--json',prompt],cwd=str(ROOT),env=env,text=True,capture_output=True,timeout=120)
    raw=(p.stdout or '')+'\n'+(p.stderr or '')
    result['exit_code']=p.returncode; calls=[]; payload=None; agent=[]
    for ln in raw.splitlines():
        try: ev=json.loads(ln)
        except Exception: continue
        item=ev.get('item') if isinstance(ev,dict) else None
        if not isinstance(item,dict): continue
        if item.get('type')=='mcp_tool_call' and item.get('server')=='node_repl' and item.get('tool')=='js':
            calls.append({'event':ev.get('type'),'status':item.get('status'),'has_result':isinstance(item.get('result'),dict),'has_error':bool(item.get('error'))})
            r=item.get('result') or {}
            if isinstance(r,dict):
                for part in r.get('content') or []:
                    if isinstance(part,dict) and part.get('type')=='text':
                        try:
                            obj=json.loads(str(part.get('text') or ''))
                            if obj.get('state')=='OWNER_LIST_OK': payload=obj
                        except Exception: pass
        elif item.get('type')=='agent_message':
            t=str(item.get('text') or '')
            if len(t)<=1000: agent.append(t)
    result['call_trace']=calls[-6:]; result['agent_messages']=agent[-3:]
    result['state']=(payload or {}).get('state','NO_AUTHORITATIVE_RESULT'); result['clicked']=(payload or {}).get('clicked'); result['click_source_role']=(payload or {}).get('sourceRole')
    url=(payload or {}).get('url') or ''
    try: result['url_path']=urlparse(url).path if url else ''
    except Exception: result['url_path']=''
    safe=[]
    for c in ((payload or {}).get('candidates') or []):
        href=c.get('href')
        if isinstance(href,str) and href.startswith('https://chatgpt.com'): href=urlparse(href).path
        safe.append({'name':c.get('name'),'role':c.get('role'),'href_path':href})
    result['candidates']=safe; result['candidate_count']=len(safe); result['heading_texts']=[str(x)[:200] for x in ((payload or {}).get('headingTexts') or [])]
    result['pass']=bool(p.returncode==0 and payload and payload.get('clicked') and len(safe)>0 and any(x.get('status')=='completed' for x in calls))
except subprocess.TimeoutExpired: result['state']='TIMEOUT'
except Exception as e: result['state']=type(e).__name__
OUT.write_text(json.dumps(result,indent=2)+'\n')
