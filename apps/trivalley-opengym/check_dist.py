#!/usr/bin/env python3
"""Validate and cache the patched upstream OpenGym static release."""
import json
import hashlib
import os
import re
import subprocess
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
catalogue_source = (Path(__file__).parent / 'tv-catalogue-art-batch2.mjs').read_text()
catalogue_art = json.loads(re.search(r'export const CATALOGUE_ART_BATCH2 = (\{.*?\})\nexport', catalogue_source, re.S).group(1))
if len(catalogue_art) != 37 or len(set(catalogue_art) & {a['id'] for a in movement_manifest['assets']}) != 0:
    raise SystemExit('Catalogue artwork batch must contain 37 distinct exact IDs')
abs_source = (Path(__file__).parent / 'tv-catalogue-art-abs-avatar.mjs').read_text()
abs_art = json.loads(re.search(r'export const CATALOGUE_ART_ABS_AVATAR = (\{.*?\})\nexport', abs_source, re.S).group(1))
if len(abs_art) != 10 or set(abs_art) & (set(catalogue_art) | {a['id'] for a in movement_manifest['assets']}):
    raise SystemExit('Abdominal artwork must add ten distinct queued exact IDs')
catalogue_art.update(abs_art)
# Preserve earlier artwork before adding this exact-ID core release.
core_file = Path(__file__).parent / 'tv-catalogue-art-core.mjs'
core_candidates = json.loads(core_file.read_text().split('export const CATALOGUE_ART_CORE = ', 1)[1])
if len(core_candidates) != 200 or set(core_candidates) & (set(catalogue_art) | {a['id'] for a in movement_manifest['assets']}):
    raise SystemExit('Core artwork must add 200 distinct exercise IDs')
for ident, asset in core_candidates.items():
    if (asset['id'] != ident
            or not re.fullmatch(r'https://static\.wixstatic\.com/media/[A-Za-z0-9_~.-]+\.(?:png|webp)', asset['url'])
            or not re.fullmatch(r'[0-9a-f]{64}', asset['sha256'])
            or asset['width'] != 1536 or asset['height'] != 1024 or not 0 < asset['bytes'] < 500000):
        raise SystemExit('Invalid core artwork metadata for ' + ident)
catalogue_art.update(core_candidates)
batch9_art = json.loads(subprocess.run(
    ['node', '--input-type=module', '-e', "import {CATALOGUE_ART_BATCH9 as x} from './apps/trivalley-opengym/tv-catalogue-art-batch9.mjs'; console.log(JSON.stringify(x))"],
    check=True, capture_output=True, text=True).stdout)
if len(batch9_art) != 25 or set(batch9_art) & (set(catalogue_art) | {a['id'] for a in movement_manifest['assets']}):
    raise SystemExit('Batch 9 artwork must add 25 distinct queued exercise IDs')
catalogue_art.update(batch9_art)
batch10_art = json.loads(subprocess.run(
    ['node', '--input-type=module', '-e', "import {CATALOGUE_ART_BATCH10 as x} from './apps/trivalley-opengym/tv-catalogue-art-batch10.mjs'; console.log(JSON.stringify(x))"],
    check=True, capture_output=True, text=True).stdout)
if len(batch10_art) != 25 or set(batch10_art) & (set(catalogue_art) | {a['id'] for a in movement_manifest['assets']}):
    raise SystemExit('Batch 10 artwork must add 25 distinct queued exercise IDs')
catalogue_art.update(batch10_art)
batch11_art = json.loads(subprocess.run(
    ['node', '--input-type=module', '-e', "import {CATALOGUE_ART_BATCH11 as x} from './apps/trivalley-opengym/tv-catalogue-art-batch11.mjs'; console.log(JSON.stringify(x))"],
    check=True, capture_output=True, text=True).stdout)
if len(batch11_art) != 25 or set(batch11_art) & (set(catalogue_art) | {a['id'] for a in movement_manifest['assets']}):
    raise SystemExit('Batch 11 artwork must add 25 distinct queued exercise IDs')
catalogue_art.update(batch11_art)
batch12_art = json.loads(subprocess.run(
    ['node', '--input-type=module', '-e', "import {CATALOGUE_ART_BATCH12 as x} from './apps/trivalley-opengym/tv-catalogue-art-batch12.mjs'; console.log(JSON.stringify(x))"],
    check=True, capture_output=True, text=True).stdout)
if len(batch12_art) != 25 or set(batch12_art) & (set(catalogue_art) | {a['id'] for a in movement_manifest['assets']}):
    raise SystemExit('Batch 12 artwork must add 25 distinct queued exercise IDs')
for ident, asset in batch12_art.items():
    if (asset['id'] != ident
            or not re.fullmatch(r'https://static\.wixstatic\.com/media/[A-Za-z0-9_~.-]+\.webp', asset['url'])
            or not re.fullmatch(r'[0-9a-f]{64}', asset['sha256'])
            or asset['width'] != 1200 or asset['height'] != 800 or not 0 < asset['bytes'] < 500000):
        raise SystemExit('Invalid Batch 12 artwork metadata for ' + ident)
catalogue_art.update(batch12_art)
batch13_art = json.loads(subprocess.run(
    ['node', '--input-type=module', '-e', "import {CATALOGUE_ART_BATCH13 as x} from './apps/trivalley-opengym/tv-catalogue-art-batch13.mjs'; console.log(JSON.stringify(x))"],
    check=True, capture_output=True, text=True).stdout)
if len(batch13_art) != 25 or set(batch13_art) & (set(catalogue_art) | {a['id'] for a in movement_manifest['assets']}):
    raise SystemExit('Batch 13 artwork must add 25 distinct queued exercise IDs')
for ident, asset in batch13_art.items():
    if (asset['id'] != ident
            or not re.fullmatch(r'https://static\.wixstatic\.com/media/[A-Za-z0-9_~.-]+\.webp', asset['url'])
            or not re.fullmatch(r'[0-9a-f]{64}', asset['sha256'])
            or asset['width'] != 1200 or asset['height'] != 800 or not 0 < asset['bytes'] < 500000):
        raise SystemExit('Invalid Batch 13 artwork metadata for ' + ident)
catalogue_art.update(batch13_art)
batch14_art = json.loads(subprocess.run(
    ['node', '--input-type=module', '-e', "import {CATALOGUE_ART_BATCH14 as x} from './apps/trivalley-opengym/tv-catalogue-art-batch14.mjs'; console.log(JSON.stringify(x))"],
    check=True, capture_output=True, text=True).stdout)
if len(batch14_art) != 25 or set(batch14_art) & (set(catalogue_art) | {a['id'] for a in movement_manifest['assets']}):
    raise SystemExit('Batch 14 artwork must add 25 distinct queued exercise IDs')
for ident, asset in batch14_art.items():
    if (asset['id'] != ident
            or not re.fullmatch(r'https://static\.wixstatic\.com/media/[A-Za-z0-9_~.-]+\.webp', asset['url'])
            or not re.fullmatch(r'[0-9a-f]{64}', asset['sha256'])
            or asset['width'] != 1200 or asset['height'] != 800 or not 0 < asset['bytes'] < 500000):
        raise SystemExit('Invalid Batch 14 artwork metadata for ' + ident)
catalogue_art.update(batch14_art)
batch15_art = json.loads(subprocess.run(
    ['node', '--input-type=module', '-e', "import {CATALOGUE_ART_BATCH15 as x} from './apps/trivalley-opengym/tv-catalogue-art-batch15.mjs'; console.log(JSON.stringify(x))"],
    check=True, capture_output=True, text=True).stdout)
if len(batch15_art) != 25 or set(batch15_art) & (set(catalogue_art) | {a['id'] for a in movement_manifest['assets']}):
    raise SystemExit('Batch 15 artwork must add 25 distinct queued exercise IDs')
for ident, asset in batch15_art.items():
    if (asset['id'] != ident
            or not re.fullmatch(r'https://static\.wixstatic\.com/media/[A-Za-z0-9_~.-]+\.webp', asset['url'])
            or not re.fullmatch(r'[0-9a-f]{64}', asset['sha256'])
            or asset['width'] != 1200 or asset['height'] != 800 or not 0 < asset['bytes'] < 500000):
        raise SystemExit('Invalid Batch 15 artwork metadata for ' + ident)
catalogue_art.update(batch15_art)

batch16_art = json.loads(subprocess.run(
    ['node', '--input-type=module', '-e', "import {CATALOGUE_ART_BATCH16 as x} from './apps/trivalley-opengym/tv-catalogue-art-batch16.mjs'; console.log(JSON.stringify(x))"],
    check=True, capture_output=True, text=True).stdout)
if len(batch16_art) != 25 or set(batch16_art) & (set(catalogue_art) | {a['id'] for a in movement_manifest['assets']}):
    raise SystemExit('Batch 16 artwork must add 25 distinct queued exercise IDs')
for ident, asset in batch16_art.items():
    if (asset['id'] != ident
            or not re.fullmatch(r'https://static\.wixstatic\.com/media/[A-Za-z0-9_~.-]+\.webp', asset['url'])
            or not re.fullmatch(r'[0-9a-f]{64}', asset['sha256'])
            or asset['width'] != 1200 or asset['height'] != 800 or not 0 < asset['bytes'] < 500000):
        raise SystemExit('Invalid Batch 16 artwork metadata for ' + ident)
catalogue_art.update(batch16_art)

batch17_art = json.loads(subprocess.run(
    ['node', '--input-type=module', '-e', "import {CATALOGUE_ART_BATCH17 as x} from './apps/trivalley-opengym/tv-catalogue-art-batch17.mjs'; console.log(JSON.stringify(x))"],
    check=True, capture_output=True, text=True).stdout)
if len(batch17_art) != 25 or set(batch17_art) & (set(catalogue_art) | {a['id'] for a in movement_manifest['assets']}):
    raise SystemExit('Batch 17 artwork must add 25 distinct queued exercise IDs')
for ident, asset in batch17_art.items():
    if (asset['id'] != ident
            or not re.fullmatch(r'https://static\.wixstatic\.com/media/[A-Za-z0-9_~.-]+\.webp', asset['url'])
            or not re.fullmatch(r'[0-9a-f]{64}', asset['sha256'])
            or asset['width'] != 1200 or asset['height'] != 800 or not 0 < asset['bytes'] < 500000):
        raise SystemExit('Invalid Batch 17 artwork metadata for ' + ident)
catalogue_art.update(batch17_art)

batch18_art = json.loads(subprocess.run(
    ['node', '--input-type=module', '-e', "import {CATALOGUE_ART_BATCH18 as x} from './apps/trivalley-opengym/tv-catalogue-art-batch18.mjs'; console.log(JSON.stringify(x))"],
    check=True, capture_output=True, text=True).stdout)
if len(batch18_art) != 25 or set(batch18_art) & (set(catalogue_art) | {a['id'] for a in movement_manifest['assets']}):
    raise SystemExit('Batch 18 artwork must add 25 accepted distinct exercise IDs')
for ident, asset in batch18_art.items():
    if (asset['id'] != ident
            or not re.fullmatch(r'https://static\.wixstatic\.com/media/[A-Za-z0-9_~.-]+\.webp', asset['url'])
            or not re.fullmatch(r'[0-9a-f]{64}', asset['sha256'])
            or asset['width'] != 1200 or asset['height'] != 800 or not 0 < asset['bytes'] < 500000):
        raise SystemExit('Invalid Batch 18 artwork metadata for ' + ident)
catalogue_art.update(batch18_art)

batch19_art = json.loads(subprocess.run(
    ['node', '--input-type=module', '-e', "import {CATALOGUE_ART_BATCH19 as x} from './apps/trivalley-opengym/tv-catalogue-art-batch19.mjs'; console.log(JSON.stringify(x))"],
    check=True, capture_output=True, text=True).stdout)
if len(batch19_art) != 25 or set(batch19_art) & (set(catalogue_art) | {a['id'] for a in movement_manifest['assets']}):
    raise SystemExit('Batch 19 artwork must add 25 accepted distinct exercise IDs')
for ident, asset in batch19_art.items():
    if (asset['id'] != ident
            or not re.fullmatch(r'https://static\.wixstatic\.com/media/[A-Za-z0-9_~.-]+\.webp', asset['url'])
            or not re.fullmatch(r'[0-9a-f]{64}', asset['sha256'])
            or asset['width'] != 1200 or asset['height'] != 800 or not 0 < asset['bytes'] < 500000):
        raise SystemExit('Invalid Batch 19 artwork metadata for ' + ident)
catalogue_art.update(batch19_art)

batch20_art = json.loads(subprocess.run(
    ['node', '--input-type=module', '-e', "import {CATALOGUE_ART_BATCH20 as x} from './apps/trivalley-opengym/tv-catalogue-art-batch20.mjs'; console.log(JSON.stringify(x))"],
    check=True, capture_output=True, text=True).stdout)
if len(batch20_art) != 25 or set(batch20_art) & (set(catalogue_art) | {a['id'] for a in movement_manifest['assets']}):
    raise SystemExit('Batch 20 artwork must add 25 accepted distinct exercise IDs')
for ident, asset in batch20_art.items():
    if (asset['id'] != ident
            or not re.fullmatch(r'https://static\.wixstatic\.com/media/[A-Za-z0-9_~.-]+\.webp', asset['url'])
            or not re.fullmatch(r'[0-9a-f]{64}', asset['sha256'])
            or asset['width'] != 1200 or asset['height'] != 800 or not 0 < asset['bytes'] < 500000):
        raise SystemExit('Invalid Batch 20 artwork metadata for ' + ident)
catalogue_art.update(batch20_art)

batch21_art = json.loads(subprocess.run(
    ['node', '--input-type=module', '-e', "import {CATALOGUE_ART_BATCH21 as x} from './apps/trivalley-opengym/tv-catalogue-art-batch21.mjs'; console.log(JSON.stringify(x))"],
    check=True, capture_output=True, text=True).stdout)
if len(batch21_art) != 25 or set(batch21_art) & (set(catalogue_art) | {a['id'] for a in movement_manifest['assets']}):
    raise SystemExit('Batch 21 artwork must add 25 accepted distinct exercise IDs')
for ident, asset in batch21_art.items():
    if (asset['id'] != ident
            or not re.fullmatch(r'https://static\.wixstatic\.com/media/[A-Za-z0-9_~.-]+\.webp', asset['url'])
            or not re.fullmatch(r'[0-9a-f]{64}', asset['sha256'])
            or asset['width'] != 1200 or asset['height'] != 800 or not 0 < asset['bytes'] < 500000):
        raise SystemExit('Invalid Batch 21 artwork metadata for ' + ident)
catalogue_art.update(batch21_art)

batch22_art = json.loads(subprocess.run(
    ['node', '--input-type=module', '-e', "import {CATALOGUE_ART_BATCH22 as x} from './apps/trivalley-opengym/tv-catalogue-art-batch22.mjs'; console.log(JSON.stringify(x))"],
    check=True, capture_output=True, text=True).stdout)
if len(batch22_art) != 25 or set(batch22_art) & (set(catalogue_art) | {a['id'] for a in movement_manifest['assets']}):
    raise SystemExit('Batch 22 artwork must add 25 accepted distinct exercise IDs')
for ident, asset in batch22_art.items():
    if (asset['id'] != ident
            or not re.fullmatch(r'https://static\.wixstatic\.com/media/[A-Za-z0-9_~.-]+\.webp', asset['url'])
            or not re.fullmatch(r'[0-9a-f]{64}', asset['sha256'])
            or asset['width'] != 1200 or asset['height'] != 800 or not 0 < asset['bytes'] < 500000):
        raise SystemExit('Invalid Batch 22 artwork metadata for ' + ident)
catalogue_art.update(batch22_art)

batch23_art = json.loads(subprocess.run(
    ['node', '--input-type=module', '-e', "import {CATALOGUE_ART_BATCH23 as x} from './apps/trivalley-opengym/tv-catalogue-art-batch23.mjs'; console.log(JSON.stringify(x))"],
    check=True, capture_output=True, text=True).stdout)
if len(batch23_art) != 25 or set(batch23_art) & (set(catalogue_art) | {a['id'] for a in movement_manifest['assets']}):
    raise SystemExit('Batch 23 artwork must add 25 accepted distinct exercise IDs')
for ident, asset in batch23_art.items():
    if (asset['id'] != ident
            or not re.fullmatch(r'https://static\.wixstatic\.com/media/[A-Za-z0-9_~.-]+\.webp', asset['url'])
            or not re.fullmatch(r'[0-9a-f]{64}', asset['sha256'])
            or asset['width'] != 1200 or asset['height'] != 800 or not 0 < asset['bytes'] < 500000):
        raise SystemExit('Invalid Batch 23 artwork metadata for ' + ident)
catalogue_art.update(batch23_art)

batch24_art = json.loads(subprocess.run(
    ['node', '--input-type=module', '-e', "import {CATALOGUE_ART_BATCH24 as x} from './apps/trivalley-opengym/tv-catalogue-art-batch24.mjs'; console.log(JSON.stringify(x))"],
    check=True, capture_output=True, text=True).stdout)
if len(batch24_art) != 25 or set(batch24_art) & (set(catalogue_art) | {a['id'] for a in movement_manifest['assets']}):
    raise SystemExit('Batch 24 artwork must add 25 accepted distinct exercise IDs')
for ident, asset in batch24_art.items():
    if (asset['id'] != ident
            or not re.fullmatch(r'https://static\.wixstatic\.com/media/[A-Za-z0-9_~.-]+\.webp', asset['url'])
            or not re.fullmatch(r'[0-9a-f]{64}', asset['sha256'])
            or asset['width'] != 1200 or asset['height'] != 800 or not 0 < asset['bytes'] < 500000):
        raise SystemExit('Invalid Batch 24 artwork metadata for ' + ident)
catalogue_art.update(batch24_art)

batch25_art = json.loads(subprocess.run(
    ['node', '--input-type=module', '-e', "import {CATALOGUE_ART_BATCH25 as x} from './apps/trivalley-opengym/tv-catalogue-art-batch25.mjs'; console.log(JSON.stringify(x))"],
    check=True, capture_output=True, text=True).stdout)
if len(batch25_art) != 25 or set(batch25_art) & (set(catalogue_art) | {a['id'] for a in movement_manifest['assets']}):
    raise SystemExit('Batch 25 artwork must add 25 accepted distinct exercise IDs')
for ident, asset in batch25_art.items():
    if (asset['id'] != ident
            or not re.fullmatch(r'https://static\.wixstatic\.com/media/[A-Za-z0-9_~.-]+\.webp', asset['url'])
            or not re.fullmatch(r'[0-9a-f]{64}', asset['sha256'])
            or asset['width'] != 1200 or asset['height'] != 800 or not 0 < asset['bytes'] < 500000):
        raise SystemExit('Invalid Batch 25 artwork metadata for ' + ident)
catalogue_art.update(batch25_art)

batch26_art = json.loads(subprocess.run(
    ['node', '--input-type=module', '-e', "import {CATALOGUE_ART_BATCH26 as x} from './apps/trivalley-opengym/tv-catalogue-art-batch26.mjs'; console.log(JSON.stringify(x))"],
    check=True, capture_output=True, text=True).stdout)
if len(batch26_art) != 25 or set(batch26_art) & (set(catalogue_art) | {a['id'] for a in movement_manifest['assets']}):
    raise SystemExit('Batch 26 artwork must add 25 accepted distinct exercise IDs')
for ident, asset in batch26_art.items():
    if (asset['id'] != ident
            or not re.fullmatch(r'https://static\.wixstatic\.com/media/[A-Za-z0-9_~.-]+\.webp', asset['url'])
            or not re.fullmatch(r'[0-9a-f]{64}', asset['sha256'])
            or asset['width'] != 1200 or asset['height'] != 800 or not 0 < asset['bytes'] < 500000):
        raise SystemExit('Invalid Batch 26 artwork metadata for ' + ident)
catalogue_art.update(batch26_art)

batch27_art = json.loads(subprocess.run(
    ['node', '--input-type=module', '-e', "import {CATALOGUE_ART_BATCH27 as x} from './apps/trivalley-opengym/tv-catalogue-art-batch27.mjs'; console.log(JSON.stringify(x))"],
    check=True, capture_output=True, text=True).stdout)
if len(batch27_art) != 25 or set(batch27_art) & (set(catalogue_art) | {a['id'] for a in movement_manifest['assets']}):
    raise SystemExit('Batch 27 artwork must add 25 accepted distinct exercise IDs')
for ident, asset in batch27_art.items():
    if (asset['id'] != ident
            or not re.fullmatch(r'https://static\.wixstatic\.com/media/[A-Za-z0-9_~.-]+\.webp', asset['url'])
            or not re.fullmatch(r'[0-9a-f]{64}', asset['sha256'])
            or asset['width'] != 1200 or asset['height'] != 800 or not 0 < asset['bytes'] < 500000):
        raise SystemExit('Invalid Batch 27 artwork metadata for ' + ident)
catalogue_art.update(batch27_art)

illustrated_count = len(movement_manifest['assets']) + len(catalogue_art)
(dist / 'tv-catalogue-art-batch2.json').write_text(json.dumps({'batch':'20261121-reviewed-core-200','assets':list(catalogue_art.values())}, indent=2))
source_sha = os.environ.get("GITHUB_SHA", "")
if source_sha and not re.fullmatch(r"[0-9a-f]{40}", source_sha):
    raise SystemExit("Invalid source commit identifier")
release = {
    "product": "TriValley FIT",
    "version": "5.47.0",
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
    "features": ["422 additional exact-ID catalogue illustrations including 200 reviewed core references with on-demand offline caching", "corrected one-arm barbell geometry and distinct rear-delt raise/row references", "corrected standing cable crunch mechanics and varied natural facial expressions", "four owner-authorized illustrated short-session presets with blended TRX and dumbbell likeness styles and separate side logging","five original Learn guides, user-label protein portions and three bodyweight workout posters with eight reviewed generated Nick likeness references", "first-workout guide, question-led calculators with practical interpretation and recommended Main 16 default", "explicit main-16 equipment substitutions with performed-set and fresh-load safeguards", "per-equipment lifting weight conventions and next-step guidance", "user-reviewed feedback drafts without attached workout records", "13 original local calculators with formula sources and four labelled external resources", "main sixteen exercise collection and first-person setup/do/avoid/scale coaching notes", "complete catalogue integrity audit and corrected degree labels", "polished program and session briefs", "seven-day activity card with separate partial-workout and recorded rep-improvement counts", "one reviewed training-day setup, returning-user guidance and reserved navigation/timer space", "client-focused header, Settings-only healthy storage details and compact guided setup", "reviewed program setup, explicit calendar changes and iPhone installation/backup help", "first-user audit fixes: unit lock, dialog focus, partial sessions, timer recovery, typo suggestions", "optional one-time Stripe support link", "direct all-exercise lifting-weight and rep entry", "logging before optional illustrations", "body-weight shortcuts", "compact technique cues", "native session guidance", "record-based progress", "truthful local save status", "explicit backup confirmation", "Onyx and Gold appearance", "interactive workout posters", "session start and finish timestamps", "poster set logging and timed holds", "local session notes", "ready-made Back/Biceps Chest/Triceps Legs program", "per-exercise rest timers", "explicit working-load selection", "program previews during active sessions", "explicit empty freestyle recovery", "owner-approved program covers", "history-based Continue my program", "program actions before long previews", "sixteen revised exercise illustrations with owner-approved likeness direction", "corrected neutral hammer-curl instructions"],
    "programCovers": cover_manifest['assets'],
    "illustrationReview": {"display": "enabled", "reviewed": illustrated_count, "pending": 0, "likenessDirection": "owner-approved avatar face alongside Nick Style 3; prior deployed art preserved", "scope": "operator visual review; generated illustrations, not recorded demonstrations; qualified movement and physical iPhone review unverified"},
    "movementIllustrations": movement_manifest['assets'] + list(catalogue_art.values()),
    "catalogueIllustrated": illustrated_count,
    "structuredCoachingIds": [a['id'] for a in movement_manifest['assets']] + [ident for ident, asset in catalogue_art.items() if asset.get('coaching')],
    "catalogueQueued": 1324 - illustrated_count,
    "portraitSha256": hashlib.sha256((dist / "assets/tv-coach-portrait.webp").read_bytes()).hexdigest(),
    "iconAddon": {"version": "trinity-20261119", "appleTouchIcon": touch_name,
                  "sha256": {path: hashlib.sha256((dist / path).read_bytes()).hexdigest() for path in icon_files}},
}
release["features"][0] = f"{illustrated_count} exact-ID catalogue illustrations with on-demand offline caching"
if release["portraitSha256"] != "ef1b3e6367cf189731f9d26abb4dd73971391717a1e0e370614ba114b50c03b8":
    raise SystemExit("Approved coach portrait checksum mismatch")
(dist / "tv-release.json").write_text(json.dumps(release, indent=2) + "\n")
bodyweight_release = json.loads(subprocess.run(
    ['node', '--input-type=module', '-e', "import {BODYWEIGHT_POSTER_ART as x} from './apps/trivalley-opengym/tv-bodyweight-art.mjs'; console.log(JSON.stringify(x))"],
    check=True, capture_output=True, text=True).stdout)
release['bodyweightPosterIllustrations'] = [dict(id=ident, **a) for ident,a in bodyweight_release.items()]
(dist / 'tv-release.json').write_text(json.dumps(release, indent=2) + '\n')
core = ["./", "./index.html", "./tv-release.json", "./manifest.json", "./icon-192.png",
        "./icon-512.png", "./trivalley-exercise.svg", "./trivalley-triquetra.png", "./assets/tv-coach-portrait.webp",
        "./" + entry_js[0], "./" + entry_css[0]]
core += ["./" + path for path in icon_files if "./" + path not in core]
core += ['./tv-catalogue-art-batch2.json', './tv-movement-assets.json'] + ['./' + asset['path'] for asset in movement_manifest['assets']]
core += ['./tv-cover-assets.json'] + ['./' + asset['path'] for asset in cover_manifest['assets']]
# Covers reuse three movement assets; duplicate cache.addAll URLs reject SW installation.
core = list(dict.fromkeys(core))
extras = ["./" + x for x in assets if x not in entry_js + entry_css and './' + x not in core]
# Only the owner-authorized public illustration assets may be cached cross-origin.
art_source = (Path(__file__).parent / 'tv-illustrated-presets.mjs').read_text()
art_urls = sorted(set(re.findall(r'https://static\.wixstatic\.com/media/[A-Za-z0-9_~.-]+\.png', art_source)))
if len(art_urls) != 5:
    raise SystemExit('Expected five pinned Nick poster artwork URLs')
# Additional owner-requested bodyweight poster references are outside the 1,324-ID catalogue.
bodyweight_art = json.loads(subprocess.run(
    ['node', '--input-type=module', '-e', "import {BODYWEIGHT_POSTER_ART as x} from './apps/trivalley-opengym/tv-bodyweight-art.mjs'; console.log(JSON.stringify(x))"],
    check=True, capture_output=True, text=True).stdout)
if len(bodyweight_art) != 8 or len({a['url'] for a in bodyweight_art.values()}) != 8:
    raise SystemExit('Expected eight distinct original bodyweight poster assets')
for ident, a in bodyweight_art.items():
    if not re.fullmatch(r'https://static\.wixstatic\.com/media/[A-Za-z0-9_~.-]+\.webp',a['url']) or not re.fullmatch(r'[0-9a-f]{64}',a['sha256']):
        raise SystemExit('Invalid bodyweight poster media metadata: '+ident)
art_urls += sorted(a['url'] for a in bodyweight_art.values())
extras += art_urls
catalogue_urls = sorted(set(a['url'] for a in catalogue_art.values()))
fingerprint = hashlib.sha256(("|".join(assets) + bundle[:500] + "|".join(hashlib.sha256((dist / path).read_bytes()).hexdigest() for path in icon_files)).encode()).hexdigest()[:12]
worker = """
const CACHE = 'trivalley-open-gym-v2-%s';
const MEDIA_CACHE = CACHE + '-catalogue-art';
const MAX_MEDIA = 12;
const CORE = %s;
const EXTRAS = %s;
const ART_URLS = %s;
const CATALOGUE_URLS = %s;
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
    await Promise.all(keys.filter(k => k.startsWith('trivalley-open-gym-') && k !== CACHE && k !== MEDIA_CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || (new URL(event.request.url).origin !== self.location.origin && !ART_URLS.includes(event.request.url))) return;
  event.respondWith((async () => {
    const catalogueMedia = CATALOGUE_URLS.includes(event.request.url);
    const cache = await caches.open(catalogueMedia ? MEDIA_CACHE : CACHE);
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
      if (response.ok || (catalogueMedia && response.type === 'opaque')) {
        await cache.put(event.request, response.clone());
        if (catalogueMedia) {
          const keys = await cache.keys();
          while (keys.length > MAX_MEDIA) await cache.delete(keys.shift());
        }
      }
      return response;
    } catch {
      return Response.error();
    }
  })());
});
""" % (fingerprint, json.dumps(core, separators=(",", ":")), json.dumps(extras, separators=(",", ":")), json.dumps(art_urls + catalogue_urls, separators=(",", ":")), json.dumps(catalogue_urls, separators=(",", ":")))
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


