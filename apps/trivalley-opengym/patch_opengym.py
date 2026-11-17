#!/usr/bin/env python3
"""Reproducible TriValley FIT modifications to alexpcosta/opengym.

The upstream React app, its state engine and its AGPL-3.0-or-later licensing are preserved.
This patch creates an original, local-only, no-API, no-paid-service PWA.
"""
import json
import sys
from pathlib import Path

front = Path(sys.argv[1]).resolve()
assert (front / "src/App.jsx").exists(), "Run with path to upstream/frontend"
source_url = "https://github.com/2strongtrainers-art/Nicholas-AI-OS/tree/feat/trivalley-opengym-free-20261116/apps/trivalley-opengym"
upstream_url = "https://github.com/alexpcosta/opengym"

def replace_exact(rel, old, new):
    path = front / rel
    data = path.read_text()
    found = data.count(old)
    if found != 1:
        raise RuntimeError(f"{rel}: expected exactly one occurrence, found {found}, of {old[:90]!r}")
    path.write_text(data.replace(old, new, 1))

# Unlike upstream's public demo, never fabricate 12 weeks of client training history.
replace_exact(
    "src/store/useStore.js",
    """      if (DEMO) {
        if (!localStorage.getItem(DEMO_SEEDED)) {
          localStorage.setItem(DEMO_SEEDED, '1')
          await get().resetDemo()
        }
        get().setGuest(true)
        set({ ready: true })
        return
      }""",
    """      if (DEMO) {
        // Real training data starts empty and stays in this browser only.
        get().setGuest(true)
        set({ ready: true })
        return
      }"""
)

# No exercise photos/GIFs from the external Gym Visual dataset. It is separately licensed.
# Generic original movement visuals are educational UI, not exercise-specific instruction.
replace_exact(
    "src/lib/exercises.js",
    "export const imgSrc = ex => IMG_BASE + ex.img\nexport const gifSrc = ex => GIF_BASE + ex.gif",
    "export const imgSrc = () => './trivalley-exercise.svg'\nexport const gifSrc = () => './trivalley-exercise.svg'"
)

(front / "src/components/Media.jsx").write_text("""import Icon from './Icon.jsx'

// Original infographic-style training card. Third-party GIFs are intentionally excluded.
function BodyCue() {
  return (
    <svg viewBox="0 0 180 158" role="img" aria-label="Generic body positioning illustration">
      <circle cx="89" cy="24" r="15" fill="none" stroke="currentColor" strokeWidth="5" />
      <path d="M89 40 L89 97 M89 55 L51 80 L31 60 M89 55 L126 80 L148 60 M89 97 L57 138 M89 97 L123 138"
            fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 54 L34 64 L40 54 M138 53 L148 64 L160 53" fill="none" stroke="#93b8ff"
            strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M35 151 H147" stroke="currentColor" opacity=".23" strokeWidth="2" />
      <circle cx="89" cy="57" r="8" fill="#86efac" opacity=".85" />
    </svg>
  )
}
export default function Media({ ex, id, compact }) {
  if (!ex) return null
  return (
    <div id={id} className={'exmedia tv-exercise-media' + (compact ? ' compact' : '')}>
      <BodyCue />
      <div className="tv-ex-info">
        <span className="tv-overline">TRIVALLEY.FIT · MOVEMENT CARD</span>
        <strong>{ex.n}</strong>
        <span>{ex.bp || 'Full body'}{ex.eq ? ' · ' + ex.eq : ''}</span>
        <small>Use controlled form and an appropriate load. Ask your coach for a personalized demonstration.</small>
      </div>
    </div>
  )
}
export function Thumb({ ex }) {
  return <div className="thumb thumb-x tv-thumb" aria-label={ex?.n || 'Exercise'}><Icon name="dumbbell" /></div>
}
""")

# Brand header and mandatory corresponding-source link remain visible inside the app.
replace_exact("src/App.jsx",
    '      <div id="app" className="vfade" key={loc.pathname}>',
    '      <div id="app" className="vfade" key={loc.pathname}>\n'
    '        <div className="tv-topbar"><span>TRIVALLEY.FIT TRAINING</span>'
    ' <span><a href="' + source_url + '" target="_blank" rel="noopener noreferrer">Modified source · AGPL-3.0</a>'
    ' · <a href="' + upstream_url + '" target="_blank" rel="noopener noreferrer">openGym credit</a></span></div>'
)
replace_exact("src/views/Home.jsx", ": 'openGym'", ": 'TriValley FIT'")

html = front / "index.html"
page = html.read_text().replace("openGym", "TriValley FIT").replace("Personal gym & body weight tracker", "Free TriValley.fit strength, cardio and workout tracker").replace("icon-180.png", "icon-192.png")
html.write_text(page)

manifest_path = front / "public/manifest.json"
manifest = json.loads(manifest_path.read_text())
manifest.update(name="TriValley FIT Training", short_name="TriValley", description="Free local-first workout planner and progress tracker", id="./", start_url="./", scope="./", theme_color="#0c0e12")
manifest["icons"] = [
    {"src":"icon-192.png", "sizes":"192x192", "type":"image/png", "purpose":"any"},
    {"src":"icon-512.png", "sizes":"512x512", "type":"image/png", "purpose":"any maskable"}
]
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")

(front / "src/index.css").open("a").write("""
/* Original TriValley.fit brand layer. Independent of DAREBEE artwork. */
.tv-topbar { display:flex; flex-wrap:wrap; justify-content:space-between; gap:6px 12px;
  max-width:580px; margin:0 auto; padding:13px 18px 5px; font-size:10px; font-weight:800;
  letter-spacing:.13em; color:#b9c6d8; }
.tv-topbar a { font-weight:500; font-size:10px; letter-spacing:0; color:#a7d6bd; text-decoration:underline; }
.tv-exercise-media {display:flex; align-items:center; gap:16px; min-height:170px; padding:15px;
  border:1px solid rgba(134,239,172,.28); border-radius:17px;
  background:linear-gradient(140deg,#14221e 0%,#111c2d 100%); color:#d5e8e0; cursor:default; }
.tv-exercise-media svg { flex:0 0 38%; width:38%; max-height:165px; color:#e4f2e9; }
.tv-ex-info {display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}
.tv-ex-info strong {font-size:17px;line-height:1.22;color:white}
.tv-ex-info span {font-size:12px}
.tv-ex-info .tv-overline {font-size:9px;font-weight:800;letter-spacing:.12em;color:#86efac}
.tv-ex-info small {font-size:10px;line-height:1.45;color:#b7c5bf}
.tv-thumb {color:#86efac;background:#1d2d28}
@media(max-width:390px){.tv-exercise-media{gap:9px;padding:10px}.tv-ex-info strong{font-size:14px}}
""")

(front / "public/trivalley-exercise.svg").write_text("""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180">
<rect width="240" height="180" rx="24" fill="#14231f"/>
<circle cx="119" cy="35" r="18" fill="none" stroke="#dfede5" stroke-width="7"/>
<path d="M119 55v57M119 70L66 94l-22-21M119 70l53 24 22-21M119 112l-47 51M119 112l47 51" stroke="#dfede5" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="119" cy="80" r="9" fill="#86efac"/>
</svg>""")

# Remove the original project imagery; own-branded icons are copied in by the workflow.
for filename in ("icon-180.png", "icon-512.png"):
    path = front / "public" / filename
    if path.exists():
        path.unlink()

print("TriValley original-source modifications applied; real OpenGym logic retained.")
