#!/usr/bin/env python3
import json, os, re, subprocess, tomllib
from pathlib import Path

ROOT=Path(os.environ.get('GITHUB_WORKSPACE','.'))
OUT=ROOT/'status'/'node-repl-liveness-strict.json'
OUT.parent.mkdir(parents=True,exist_ok=True)
result={'probe':'strict node_repl liveness','model':'openrouter/free','pass':False,'gpt_action_secret_read':False}

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

prompt='''Make exactly one MCP call to server `node_repl`, tool `js`. Use code exactly: nodeRepl.write("NODE_REPL_OK"); Use title `Strict node repl liveness` and timeout_ms 15000. Do not call any other tool. After the tool result, output exactly NODE_REPL_OK.'''

try:
    p=subprocess.run(['codex',*cfg,'exec','--ephemeral','--json',prompt],cwd=str(ROOT),env=env,text=True,capture_output=True,timeout=90)
    raw=(p.stdout or '')+'\n'+(p.stderr or '')
    result['exit_code']=p.returncode
    calls=[]; completed_texts=[]; agent_messages=[]
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
                    if isinstance(part,dict) and part.get('type')=='text': completed_texts.append(str(part.get('text') or ''))
        elif item.get('type')=='agent_message':
            txt=str(item.get('text') or '')
            if len(txt)<=200: agent_messages.append(txt)
    result['call_trace']=calls[-10:]
    result['tool_texts']=completed_texts[-5:]
    result['agent_messages']=agent_messages[-5:]
    result['state']='NODE_REPL_OK' if 'NODE_REPL_OK' in completed_texts else 'NO_AUTHORITATIVE_RESULT'
    result['pass']=bool(p.returncode==0 and result['state']=='NODE_REPL_OK')
except subprocess.TimeoutExpired:
    result['state']='TIMEOUT'
except Exception as e:
    result['state']=type(e).__name__
OUT.write_text(json.dumps(result,indent=2)+'\n')
