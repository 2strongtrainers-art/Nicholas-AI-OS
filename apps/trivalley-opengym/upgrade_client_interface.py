#!/usr/bin/env python3
"""A quiet client header and shorter setup, after the reviewed setup patch."""
from pathlib import Path
import re,sys,shutil
front=Path(sys.argv[1]).resolve();assets=Path(__file__).resolve().parent
p=front/'src/App.jsx';s=p.read_text()
match=re.search(r'<header className="tv-v4-topbar">.*?</header>',s,re.S)
if not match:raise RuntimeError('Client header anchor changed')
source=re.search(r'<a href="([^"]+)"[^>]*\s+aria-label="Modified OpenGym corresponding source, AGPL 3.0"',match.group())
if not source:raise RuntimeError('Exact corresponding source URL missing')
header=(assets/'ClientHeader.jsx').read_text().replace('__TV_SOURCE_URL__',source.group(1))
(front/'src/components/ClientHeader.jsx').write_text(header)
s=s[:match.start()]+'<ClientHeader />'+s[match.end():]
anchor="import DailyVerse from './components/DailyVerse.jsx'"
if s.count(anchor)!=1:raise RuntimeError('Client header import anchor changed')
p.write_text(s.replace(anchor,anchor+"\nimport ClientHeader from './components/ClientHeader.jsx'",1))
p=front/'src/main.jsx';s=p.read_text();anchor="import './getting-started.css'"
if s.count(anchor)!=1:raise RuntimeError('Client stylesheet anchor changed')
p.write_text(s.replace(anchor,anchor+"\nimport './client-interface.css'",1))
shutil.copyfile(assets/'client-interface.css',front/'src/client-interface.css')
print('Client-focused header and compact setup applied; corresponding source remains accessible')
