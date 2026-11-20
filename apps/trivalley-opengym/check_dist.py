#!/usr/bin/env python3
"""Validate and cache the patched upstream OpenGym static release."""
import json
import hashlib
import os
import re
import sys
from pathlib import Path

dist = Path(sys.argv[1]).resolve()
required = ["index.html", "manifest.json", "icon-192.png", "icon-512.png", "trivalley-exercise.svg", "trivalley-triquetra.png", "assets/tv-coach-portrait.webp", "tv-cover-assets.json", "tv-movement-assets.json"]
missing = [p for p in required if not (dist / p).is_file()]
if missing:
    raise SystemExit("Missing required built files: " + ", ".join(missing))

html = (dist / "index.html").read_text()
manifest = json.loads((dist / "manifest.json").read_text())
cover_manifest = json.loads((dist / 'tv-cover-assets.json').read_text())
for asset in cover_manifest['assets']:
    if hashlib.sha256((dist / asset['path']).read_bytes()).hexdigest() != asset['sha256']:
        raise SystemExit('Program cover checksum mismatch: ' + asset['path'])
movement_manifest = json.loads((dist / 'tv-movement-assets.json').read_text())
if len(movement_manifest['assets']) != 16:
    raise SystemExit('Expected sixteen exact exercise illustrations')
for asset in movement_manifest['assets']:
    if hashlib.sha256((dist / asset['path']).read_bytes()).hexdigest() != asset['sha256']:
        raise SystemExit('Movement illustration checksum mismatch: ' + asset['path'])
if "TriValley FIT" not in html or manifest.get("name") != "TriValley FIT Training":
    raise SystemExit("Branding is missing from real OpenGym build")

# Verify the actual Apple touch icon and every installation image before release.
touch_name = "apple-touch-icon-trinity-20261119.png"
icon_files = [touch_name] + [icon["src"] for icon in manifest["icons"]]
if not re.search(r'<link(?=[^>]*rel="apple-touch-icon")(?=[^>]*sizes="180x180")(?=[^>]*href="' + re.escape(touch_name) + r'")[^>]*>', html):
    raise SystemExit("Missing explicit 180px Trinity Apple touch icon")
for filename, width in [(touch_name, 180), ("icon-192-trinity-20261119.png", 192), ("icon-512-trinity-20261119.png", 512)]:
    raw = (dist / filename).read_bytes()
    if not raw.startswith(b"\x89PNG\r\n\x1a\n") or int.from_bytes(raw[16:20], "big") != width or int.from_bytes(raw[20:24], "big") != width:
        raise SystemExit("Invalid installation icon: " + filename)

assets = sorted(str(p.relative_to(dist)).replace("\\", "/") for p in (dist / "assets").rglob("*") if p.is_file())
if not assets or not any(x.endswith(".js") for x in assets):
    raise SystemExit("Missing Vite compiled React asset(s)")
built_bytes = sum(p.stat().st_size for p in dist.rglob("*") if p.is_file())
if built_bytes > 20 * 1024 * 1024:
    raise SystemExit("Wix Headless 20 MiB static file limit exceeded")
bundle = " ".join(p.read_text(errors="ignore") for p in (dist / "assets").rglob("*.js"))
if "TRIVALLEY.FIT" not in bundle or "Source · AGPL" not in bundle or "openGym" not in bundle:
    raise SystemExit("Visible AGPL source and upstream credit missing from app bundle")
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
    "version": "5.16.0",
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
    "features": ["five original Learn guides, user-label protein portions and three bodyweight workout posters with original sketches", "first-workout guide, question-led calculators with practical interpretation and recommended Main 16 default", "explicit main-16 equipment substitutions with performed-set and fresh-load safeguards", "per-equipment lifting weight conventions and next-step guidance", "user-reviewed feedback drafts without attached workout records", "13 original local calculators with formula sources and four labelled external resources", "main sixteen exercise collection and first-person setup/do/avoid/scale coaching notes", "complete catalogue integrity audit and corrected degree labels", "polished program and session briefs", "seven-day activity card with separate partial-workout and recorded rep-improvement counts", "one reviewed training-day setup, returning-user guidance and reserved navigation/timer space", "client-focused header, Settings-only healthy storage details and compact guided setup", "reviewed program setup, explicit calendar changes and iPhone installation/backup help", "first-user audit fixes: unit lock, dialog focus, partial sessions, timer recovery, typo suggestions", "optional one-time Stripe support link", "direct all-exercise lifting-weight and rep entry", "logging before optional illustrations", "body-weight shortcuts", "compact technique cues", "native session guidance", "record-based progress", "truthful local save status", "explicit backup confirmation", "Onyx and Gold appearance", "interactive workout posters", "session start and finish timestamps", "poster set logging and timed holds", "local session notes", "ready-made Back/Biceps Chest/Triceps Legs program", "per-exercise rest timers", "explicit working-load selection", "program previews during active sessions", "explicit empty freestyle recovery", "owner-approved program covers", "history-based Continue my program", "program actions before long previews", "sixteen revised exercise illustrations with owner-approved likeness direction", "corrected neutral hammer-curl instructions"],
    "programCovers": cover_manifest['assets'],
    "illustrationReview": {"display": "enabled", "reviewed": 16, "pending": 0, "likenessDirection": "owner-approved two proofs and continued generation authorized", "scope": "operator visual review; generated illustrations, not recorded demonstrations"},
    "movementIllustrations": movement_manifest['assets'],
    "portraitSha256": hashlib.sha256((dist / "assets/tv-coach-portrait.webp").read_bytes()).hexdigest(),
    "iconAddon": {"version": "trinity-20261119", "appleTouchIcon": touch_name,
                  "sha256": {path: hashlib.sha256((dist / path).read_bytes()).hexdigest() for path in icon_files}},
}
if release["portraitSha256"] != "ef1b3e6367cf189731f9d26abb4dd73971391717a1e0e370614ba114b50c03b8":
    raise SystemExit("Approved coach portrait checksum mismatch")
(dist / "tv-release.json").write_text(json.dumps(release, indent=2) + "\n")
core = ["./", "./index.html", "./tv-release.json", "./manifest.json", "./icon-192.png",
        "./icon-512.png", "./trivalley-exercise.svg", "./trivalley-triquetra.png", "./assets/tv-coach-portrait.webp",
        "./" + entry_js[0], "./" + entry_css[0]]
core += ["./" + path for path in icon_files if "./" + path not in core]
core += ['./tv-movement-assets.json'] + ['./' + asset['path'] for asset in movement_manifest['assets']]
core += ['./tv-cover-assets.json'] + ['./' + asset['path'] for asset in cover_manifest['assets']]
# Covers reuse three movement assets; duplicate cache.addAll URLs reject SW installation.
core = list(dict.fromkeys(core))
extras = ["./" + x for x in assets if x not in entry_js + entry_css and './' + x not in core]
fingerprint = hashlib.sha256(("|".join(assets) + bundle[:500] + "|".join(hashlib.sha256((dist / path).read_bytes()).hexdigest() for path in icon_files)).encode()).hexdigest()[:12]
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
    "media":"original SVG fallback, approved coach imagery and generated movement illustrations; no third-party exercise GIFs",
    "source":"https://github.com/alexpcosta/opengym"
}))


