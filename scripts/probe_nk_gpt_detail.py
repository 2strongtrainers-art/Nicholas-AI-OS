#!/usr/bin/env python3
import json, os, re, subprocess, tomllib
from pathlib import Path
from urllib.parse import urlparse

ROOT=Path(os.environ.get('GITHUB_WORKSPACE','.'))
OUT=ROOT/'status'/'nk-gpt-detail.json'
OUT.parent.mkdir(parents=True,exist_ok=True)
result={'probe':'inspect exact NK GPT detail page read-only','model':'openrouter/free','pass':False,'gpt_action_secret_read':False}
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
cfg=['-c','model_provider="openrouter-temp"','-c','model="openrouter/free"','-c','model_reasoning_effort="low"','-c','model_context_window=100000','-c','model_max_output_tokens=1800','-c','disable_response_storage=true','-c','features.apps=false','-c','model_providers.openrouter-temp.name="OpenRouter Temporary"','-c','model_providers.openrouter-temp.base_url="https://openrouter.ai/api/v1"','-c','model_providers.openrouter-temp.env_key="OPENROUTER_API_KEY"','-c','model_providers.openrouter-temp.wire_api="responses"','-c','model_providers.openrouter-temp.requires_openai_auth=false']
try:
    ccfg=tomllib.loads((Path.home()/'.codex/config.toml').read_text()); names=sorted((ccfg.get('mcp_servers') or {}).keys())
except Exception: names=[]
for name in names:
    if name!='node_repl' and re.fullmatch(r'[A-Za-z0-9_.-]+',str(name)): cfg += ['-c',f'mcp_servers.{name}.enabled=false']
js=f'''const {{ setupBrowserRuntime }} = await import({json.dumps(str(browser_client))});
const agent=await setupBrowserRuntime(); const chrome=await agent.browsers.get("chrome"); await chrome.nameSession("🔎 Inspect NK GPT");
const tab=await chrome.tabs.new(); await tab.goto("https://chatgpt.com/gpts/mine"); await tab.playwright.waitForTimeout(2500);
const nk=tab.playwright.getByText("NK",{{exact:true}}); const nkCount=await nk.count(); if(nkCount!==1){{nodeRepl.write(JSON.stringify({{state:"NK_AMBIGUOUS",nkCount}}));}} else {{
 await nk.nth(0).click(); await tab.playwright.waitForTimeout(3000); const currentUrl=String(await tab.url()||"");
 const controls=[]; const names=["Edit GPT","Edit","Configure","Update","Save","Share","Create","View GPT"];
 for(const name of names){{for(const role of ["button","link"]){{try{{const loc=tab.playwright.getByRole(role,{{name,exact:true}}); const n=Math.min(await loc.count(),5); for(let i=0;i<n;i++){{let href=null;try{{href=await loc.nth(i).getAttribute("href");}}catch{{}}controls.push({{name,role,href}});}}}}catch{{}}}}}}
 const headings=[]; try{{const hs=tab.playwright.getByRole("heading"); const n=Math.min(await hs.count(),15); for(let i=0;i<n;i++){{try{{headings.push(await hs.nth(i).innerText());}}catch{{}}}}}}catch{{}}
 await tab.markHandoff(); nodeRepl.write(JSON.stringify({{state:"NK_DETAIL_OK",url:currentUrl,controls,headings}}));
}}'''
prompt=f'''Make exactly one read-only/navigation MCP call to server `node_repl`, tool `js` using this exact JavaScript and no other tool. It opens /gpts/mine, clicks the one exact NK GPT, and only inspects resulting controls.\n\n{js}\n\nUse title `Inspect exact NK GPT detail` and timeout_ms 60000. Output exactly the tool result text.'''
try:
    p=subprocess.run(['codex',*cfg,'exec','--ephemeral','--json',prompt],cwd=str(ROOT),env=env,text=True,capture_output=True,timeout=120)
    raw=(p.stdout or '')+'\n'+(p.stderr or '')
    result['exit_code']=p.returncode; calls=[]; payload=None; agents=[]
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
                            if obj.get('state') in ('NK_DETAIL_OK','NK_AMBIGUOUS'): payload=obj
                        except Exception: pass
        elif item.get('type')=='agent_message':
            t=str(item.get('text') or '')
            if len(t)<=1200: agents.append(t)
    result['call_trace']=calls[-6:]; result['agent_messages']=agents[-3:]; result['state']=(payload or {}).get('state','NO_AUTHORITATIVE_RESULT')
    result['nk_count']=(payload or {}).get('nkCount')
    url=(payload or {}).get('url') or ''
    try: result['url_path']=urlparse(url).path if url else ''
    except Exception: result['url_path']=''
    controls=[]
    for c in ((payload or {}).get('controls') or []):
        href=c.get('href')
        if isinstance(href,str) and href.startswith('https://chatgpt.com'): href=urlparse(href).path
        controls.append({'name':c.get('name'),'role':c.get('role'),'href_path':href})
    result['controls']=controls; result['headings']=[str(x)[:200] for x in ((payload or {}).get('headings') or [])]
    result['pass']=bool(p.returncode==0 and payload and payload.get('state')=='NK_DETAIL_OK' and any(x.get('status')=='completed' for x in calls))
except subprocess.TimeoutExpired: result['state']='TIMEOUT'
except Exception as e: result['state']=type(e).__name__
OUT.write_text(json.dumps(result,indent=2)+'\n')
