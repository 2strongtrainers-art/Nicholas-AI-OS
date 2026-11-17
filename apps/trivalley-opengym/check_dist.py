#!/usr/bin/env python3
"""Validate and cache the patched upstream OpenGym static release."""
import json
import hashlib
import os
import re
import sys
from pathlib import Path

dist = Path(sys.argv[1]).resolve()
required = ["index.html", "manifest.json", "icon-192.png", "icon-512.png", "trivalley-exercise.svg"]
missing = [p for p in required if not (dist / p).is_file()]
if missing:
    raise SystemExit("Missing required built files: " + ", ".join(missing))

html = (dist / "index.html").read_text()
manifest = json.loads((dist / "manifest.json").read_text())
if "TriValley FIT" not in html or manifest.get("name") != "TriValley FIT Training":
    raise SystemExit("Branding is missing from real OpenGym build")

assets = sorted(str(p.relative_to(dist)).replace("\\", "/") for p in (dist / "assets").rglob("*") if p.is_file())
if not assets or not any(x.endswith(".js") for x in assets):
    raise SystemExit("Missing Vite compiled React asset(s)")
built_bytes = sum(p.stat().st_size for p in dist.rglob("*") if p.is_file())
if built_bytes > 20 * 1024 * 1024:
    raise SystemExit("Wix Headless 20 MiB static file limit exceeded")
bundle = " ".join(p.read_text(errors="ignore") for p in (dist / "assets").rglob("*.js"))
if "TRIVALLEY.FIT" not in bundle or "Modified source" not in bundle:
    raise SystemExit("Modified original-source attribution not bundled")
if "cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset" in bundle:
    raise SystemExit("Exercise image CDN must not be in the no-media build")

# Wix reserves /sw.js for its own tiny worker. Register and ship a unique /tv-sw.js.
# Cache the critical app shell strictly; noncritical translations/coach-demo chunks are best-effort.
if "tv-sw.js" not in bundle:
    raise SystemExit("Main React bundle does not register the unique tv-sw.js worker")
entry_js = [x for x in assets if x.startswith("assets/index-") and x.endswith(".js")]
entry_css = [x for x in assets if x.startswith("assets/index-") and x.endswith(".css")]
if len(entry_js) != 1 or len(entry_css) != 1:
    raise SystemExit("Expected one Vite entrypoint JS and CSS, found " + repr((entry_js, entry_css)))
source_sha = os.environ.get("GITHUB_SHA", "")
if source_sha and not re.fullmatch(r"[0-9a-f]{40}", source_sha):
    raise SystemExit("Invalid source commit identifier")
release = {
    "product": "TriValley FIT",
    "version": "4.0.0",
    "sourceCommit": source_sha or "local-unversioned",
    "upstreamCommit": "678bf5bf10446e8997a77d43e89c9b2721d8d0fc",
    "mainScript": entry_js[0],
    "mainStylesheet": entry_css[0],
    "mainScriptSha256": hashlib.sha256((dist / entry_js[0]).read_bytes()).hexdigest(),
    "source": (
        f"https://github.com/2strongtrainers-art/Nicholas-AI-OS/tree/{source_sha}/apps/trivalley-opengym"
        if source_sha else "https://github.com/2strongtrainers-art/Nicholas-AI-OS"
    ),
    "storage": "browser-local; no client cloud sync",
    "backend": "disabled",
}
(dist / "tv-release.json").write_text(json.dumps(release, indent=2) + "\n")
core = ["./", "./index.html", "./tv-release.json", "./manifest.json", "./icon-192.png",
        "./icon-512.png", "./trivalley-exercise.svg",
        "./" + entry_js[0], "./" + entry_css[0]]
extras = ["./" + x for x in assets if x not in entry_js + entry_css]
fingerprint = hashlib.sha256(("|".join(assets) + bundle[:500]).encode()).hexdigest()[:12]
worker = """
const CACHE = 'trivalley-open-gym-v2-%s';
const CORE = %s;
const EXTRAS = %s;
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);
    await Promise.allSettled(EXTRAS.map(file => cache.add(file)));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('trivalley-open-gym-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (event.request.mode === 'navigate') {
      try {
        const response = await fetch(event.request);
        if (response.ok) await cache.put('./index.html', response.clone());
        return response;
      } catch {
        return await cache.match('./index.html') || await cache.match('./') || Response.error();
      }
    }
    const cached = await cache.match(event.request);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    } catch {
      return Response.error();
    }
  })());
});
""" % (fingerprint, json.dumps(core, separators=(",", ":")), json.dumps(extras, separators=(",", ":")))
(dist / "tv-sw.js").write_text(worker)

print(json.dumps({
    "status":"BUILD_OK",
    "app":"TriValley-branded actual alexpcosta/opengym",
    "mode":"VITE_DEMO=1 + VITE_TRIVALLEY_FREE=1 / real browser-local",
    "appFiles": len(assets) + len(required) + 2,
    "sizeBytes": built_bytes,
    "media":"original generic SVG only; no third-party exercise GIFs",
    "source":"https://github.com/alexpcosta/opengym"
}))
