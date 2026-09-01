#!/usr/bin/env python3
import json, os, re, subprocess, tomllib
from pathlib import Path

ROOT=Path(os.environ.get('GITHUB_WORKSPACE','.'))
OUT=ROOT/'status'/'chrome-documentation-tabs.json'
OUT.parent.mkdir(parents=True,exist_ok=True)
result={'probe':'current Chrome documentation tab/navigation API','model':'openrouter/free','pass':False,'gpt_action_secret_read':False}
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
cfg=['-c','model_provider="openrouter-temp"','-c','model="openrouter/free"','-c','model_reasoning_effort="low"','-c','model_context_window=100000','-c','model_max_output_tokens=2048','-c','disable_response_storage=true','-c','features.apps=false','-c','model_providers.openrouter-temp.name="OpenRouter Temporary"','-c','model_providers.openrouter-temp.base_url="https://openrouter.ai/api/v1"','-c','model_providers.openrouter-temp.env_key="OPENROUTER_API_KEY"','-c','model_providers.openrouter-temp.wire_api="responses"','-c','model_providers.openrouter-temp.requires_openai_auth=false']
try:
    ccfg=tomllib.loads((Path.home()/'.codex/config.toml').read_text()); names=sorted((ccfg.get('mcp_servers') or {}).keys())
except Exception: names=[]
for name in names:
    if name!='node_repl' and re.fullmatch(r'[A-Za-z0-9_.-]+',str(name)): cfg += ['-c',f'mcp_servers.{name}.enabled=false']
js=f'''const {{ setupBrowserRuntime }} = await import({json.dumps(str(browser_client))}); const agent = await setupBrowserRuntime(); const chrome = await agent.browsers.get("chrome"); const d = String(await chrome.documentation()); const lines=d.split("\\n"); const keep=[]; for(let i=0;i<lines.length;i++){{ if(/tabs|navigate|navigation|url|playwright|page|create|new tab|open/i.test(lines[i])){{ for(let j=Math.max(0,i-1);j<=Math.min(lines.length-1,i+2);j++) keep.push(lines[j]); }} }} nodeRepl.write([...new Set(keep)].slice(0,220).join("\\n"));'''
prompt=f'''Make exactly one MCP call to server `node_repl`, tool `js` using this exact JavaScript and no other tool:\n{js}\nUse title `Inspect Chrome tab navigation docs` and timeout_ms 30000. Then output exactly the tool result text.'''
try:
    p=subprocess.run(['codex',*cfg,'exec','--ephemeral','--json',prompt],cwd=str(ROOT),env=env,text=True,capture_output=True,timeout=90)
    raw=(p.stdout or '')+'\n'+(p.stderr or '')
    result['exit_code']=p.returncode; calls=[]; texts=[]
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
                    if isinstance(part,dict) and part.get('type')=='text': texts.append(str(part.get('text') or ''))
    result['call_trace']=calls[-10:]
    doc=next((t for t in reversed(texts) if len(t)>20),None)
    result['documentation_excerpt']=doc[:12000] if doc else None
    result['state']='DOCS_OK' if doc else 'NO_AUTHORITATIVE_RESULT'
    result['pass']=bool(p.returncode==0 and doc and any(x.get('status')=='completed' for x in calls))
except subprocess.TimeoutExpired:
    result['state']='TIMEOUT'
except Exception as e: result['state']=type(e).__name__
OUT.write_text(json.dumps(result,indent=2)+'\n')
