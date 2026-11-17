#!/usr/bin/env python3
"""Validate and cache the patched upstream OpenGym static release."""
import json
import sys
from pathlib import Path

dist = Path(sys.argv[1]).resolve()
required = ["index.html", "manifest.json", "sw.js", "icon-192.png", "icon-512.png", "trivalley-exercise.svg"]
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

# Precache the actual hashed bundle for standalone/offline use; no paid workers.
precache = ["./", "./index.html", "./manifest.json", "./icon-192.png",
            "./icon-512.png", "./trivalley-exercise.svg"] + ["./" + x for x in assets]
worker = """
const CACHE = 'trivalley-open-gym-v1';
const ASSETS = %s;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k.startsWith('trivalley-open-gym-') && k !== CACHE).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (event.request.mode === 'navigate') {
      try { return await fetch(event.request); }
      catch { return await cache.match('./index.html') || Response.error(); }
    }
    const cached = await cache.match(event.request);
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response.ok) cache.put(event.request, response.clone());
    return response;
  })());
});
""" % json.dumps(precache, separators=(",", ":"))
(dist / "sw.js").write_text(worker)

print(json.dumps({
    "status":"BUILD_OK",
    "app":"TriValley-branded actual alexpcosta/opengym",
    "mode":"VITE_DEMO=1 / browser-local",
    "appFiles": len(assets) + len(required),
    "sizeBytes": built_bytes,
    "media":"original generic SVG only; no third-party exercise GIFs",
    "source":"https://github.com/alexpcosta/opengym"
}))
