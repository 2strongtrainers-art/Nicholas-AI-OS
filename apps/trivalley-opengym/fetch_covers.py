#!/usr/bin/env python3
"""Fetch only approved public cover derivatives; source likeness photos stay private."""
import hashlib
import json
from pathlib import Path
import sys
import urllib.request

front = Path(sys.argv[1]).resolve()
manifest = json.loads((Path(__file__).parent / 'cover-assets.json').read_text())
base = 'https://headless-lukuteamnwo-1strongtrainer-140e.wix-site-host.com/'
for asset in manifest['assets']:
    name = asset['path']
    if not name.startswith('assets/tv-cover-') or '/' in name[len('assets/'):] or not name.endswith('.webp'):
        raise SystemExit('Unexpected cover path')
    data = urllib.request.urlopen(base + name, timeout=25).read()
    if hashlib.sha256(data).hexdigest() != asset['sha256'] or data[:4] != b'RIFF' or data[8:12] != b'WEBP':
        raise SystemExit('Cover verification failed: ' + name)
    target = front / 'public' / name
    target.parent.mkdir(exist_ok=True, parents=True)
    target.write_bytes(data)
(front / 'public/tv-cover-assets.json').write_text(json.dumps(manifest, indent=2) + '\n')
print('Three approved cover derivatives verified; original references were not published')
