#!/usr/bin/env python3
"""Fetch only owner-authorized public derivatives, verifying every byte hash."""
from pathlib import Path
import hashlib
import json
import re
import sys
import urllib.request
front=Path(sys.argv[1]).resolve()
manifest=json.loads((Path(__file__).parent/'movement-assets.json').read_text())
assert len(manifest['assets'])==16
for a in manifest['assets']:
    path=a['path']
    assert re.fullmatch(r'assets/tv-movement-\d{4}-20261119.webp',path)
    req=urllib.request.Request('https://headless-lukuteamnwo-1strongtrainer-140e.wix-site-host.com/'+path)
    with urllib.request.urlopen(req,timeout=25) as response: raw=response.read()
    assert raw.startswith(b'RIFF') and raw[8:12]==b'WEBP'
    assert len(raw)==a['bytes'] and hashlib.sha256(raw).hexdigest()==a['sha256'],path
    out=front/'public'/path;out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(raw)
(front/'public/tv-movement-assets.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Sixteen original movement illustrations verified')
