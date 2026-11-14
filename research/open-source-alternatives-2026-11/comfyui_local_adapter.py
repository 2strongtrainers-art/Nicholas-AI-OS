#!/usr/bin/env python3
"""Local-only ComfyUI API adapter (free-model workflow validation + optional run).

Requires a separately running ComfyUI server and downloaded licensed model weights.
This client does NOT install ComfyUI, require a paid API, expose a server to the
internet, or bypass an explicitly disabled paid-AI policy. Only loopback URLs
are permitted. For remote GPUs, create an authenticated SSH port forward first.
"""
import argparse
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path


def ensure_loopback(url):
    p=urllib.parse.urlparse(url)
    if p.scheme != 'http' or p.hostname not in {'127.0.0.1', 'localhost', '::1'}:
        raise ValueError('Refusing non-loopback endpoint; use an SSH tunnel to localhost')
    if p.username or p.password or p.query or p.fragment or p.path not in ('', '/'):
        raise ValueError('Endpoint must be a bare local origin without embedded credentials')
    return url.rstrip('/')


def request(host, path, data=None, timeout=10):
    url=host+path
    payload=None if data is None else json.dumps(data).encode('utf-8')
    req=urllib.request.Request(url,data=payload,method='POST' if data is not None else 'GET')
    if data is not None: req.add_header('Content-Type','application/json')
    with urllib.request.urlopen(req,timeout=timeout) as response:
        raw=response.read(20*1024*1024)
    return json.loads(raw)


def validate_workflow(path):
    wf=json.loads(Path(path).read_text('utf-8'))
    if not isinstance(wf,dict) or not wf:
        raise ValueError('Expected nonempty ComfyUI API workflow object')
    for node_id,node in wf.items():
        if not isinstance(node,dict) or not isinstance(node.get('class_type'),str):
            raise ValueError(f'Node {node_id} lacks class_type (export as API format)')
        if not isinstance(node.get('inputs',{}),dict):
            raise ValueError(f'Node {node_id} inputs must be an object')
    return wf


def wait_for_result(host,prompt_id,seconds=120):
    deadline=time.monotonic()+seconds
    while time.monotonic()<deadline:
        history=request(host,'/history/'+urllib.parse.quote(prompt_id,safe=''))
        if prompt_id in history:
            record=history[prompt_id]
            if record.get('status',{}).get('status_str')=='error':
                raise RuntimeError('ComfyUI reported workflow error; inspect local logs')
            return record.get('outputs',{})
        time.sleep(1)
    raise TimeoutError('Workflow did not complete before deadline')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host',default='http://127.0.0.1:8188')
    parser.add_argument('--check',action='store_true',help='Query local ComfyUI system stats')
    parser.add_argument('--workflow',type=Path,help='ComfyUI API-format exported workflow')
    parser.add_argument('--run',action='store_true',help='Explicitly submit the workflow to the local GPU')
    parser.add_argument('--timeout',type=int,default=120)
    args=parser.parse_args()
    host=ensure_loopback(args.host)
    if args.check:
        info=request(host,'/system_stats')
        print('ComfyUI local server reachable; systems:',len(info.get('devices',[])))
    if args.workflow:
        workflow=validate_workflow(args.workflow)
        print('Validated API workflow nodes:',len(workflow))
        if args.run:
            result=request(host,'/prompt',{'prompt':workflow})
            prompt_id=result.get('prompt_id')
            if not isinstance(prompt_id,str) or not prompt_id:
                raise RuntimeError('ComfyUI did not return a prompt_id')
            outputs=wait_for_result(host,prompt_id,args.timeout)
            print(json.dumps({'prompt_id':prompt_id,'output_nodes':list(outputs)},indent=2))
    elif args.run:
        parser.error('--run requires --workflow')
    elif not args.check:
        parser.error('Specify --check or --workflow')


if __name__=='__main__':main()
