#!/usr/bin/env python3
import json, os, re, subprocess, tomllib
from pathlib import Path

ROOT=Path(os.environ.get('GITHUB_WORKSPACE','.'))
OUT=ROOT/'status'/'browser-ensure-ready-strict.json'
OUT.parent.mkdir(parents=True,exist_ok=True)
result={'probe':'strict browser ensureReady launch','model':'openrouter/free','pass':False,'gpt_action_secret_read':False}
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
cfg=['-c','model_provider="openrouter-temp"','-c','model="openrouter/free"','-c','model_reasoning_effort="low"','-c','model_context_window=80000','-c','model_max_output_tokens=1024','-c','disable_response_storage=true','-c','features.apps=false','-c','model_providers.openrouter-temp.name="OpenRouter Temporary"','-c','model_providers.openrouter-temp.base_url="https://openrouter.ai/api/v1"','-c','model_providers.openrouter-temp.env_key="OPENROUTER_API_KEY"','-c','model_providers.openrouter-temp.wire_api="responses"','-c','model_providers.openrouter-temp.requires_openai_auth=false']
try:
    ccfg=tomllib.loads((Path.home()/'.codex/config.toml').read_text()); names=sorted((ccfg.get('mcp_servers') or {}).keys())
except Exception: names=[]
for name in names:
    if name!='node_repl' and re.fullmatch(r'[A-Za-z0-9_.-]+',str(name)): cfg += ['-c',f'mcp_servers.{name}.enabled=false']
js=f'''const {{ setupBrowserRuntime }} = await import({json.dumps(str(browser_client))}); const agent = await setupBrowserRuntime({{ environment: "codex-app" }}); const ready = await agent.browsers.ensureReady({{ launch: true }}); nodeRepl.write("ENSURE_READY_STATE:"+String(ready?.state));'''
prompt=f'''Make exactly one MCP call to server `node_repl`, tool `js` using this exact JavaScript and no other tool:\n{js}\nUse title `Strict browser ensure ready` and timeout_ms 45000. Then output exactly the tool result text.'''
try:
    p=subprocess.run(['codex',*cfg,'exec','--ephemeral','--json',prompt],cwd=str(ROOT),env=env,text=True,capture_output=True,timeout=100)
    raw=(p.stdout or '')+'\n'+(p.stderr or '')
    result['exit_code']=p.returncode; calls=[]; texts=[]; agents=[]
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
        elif item.get('type')=='agent_message':
            t=str(item.get('text') or '')
            if len(t)<=200: agents.append(t)
    result['call_trace']=calls[-10:]; result['tool_texts']=texts[-5:]; result['agent_messages']=agents[-5:]
    authoritative=next((t for t in reversed(texts) if t.startswith('ENSURE_READY_STATE:')),None)
    result['authoritative_tool_result']=authoritative
    result['ready_state']=authoritative.split(':',1)[1] if authoritative else None
    result['state']='ENSURE_READY_OK' if result['ready_state']=='ready' else ('ENSURE_READY_'+str(result['ready_state']) if authoritative else 'NO_AUTHORITATIVE_RESULT')
    result['pass']=bool(p.returncode==0 and result['ready_state']=='ready')
except subprocess.TimeoutExpired:
    result['state']='TIMEOUT'
except Exception as e: result['state']=type(e).__name__
OUT.write_text(json.dumps(result,indent=2)+'\n')
