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

(front / "src/components/Media.jsx").write_text("""import { useStore } from '../store/useStore.js'
import Icon from './Icon.jsx'

// Original informational movement card; no DAREBEE images or unlicensed GIFs.
// The illustration is a generic body-position cue, not an exact exercise demonstration.
function BodyCue() {
  return (
    <svg viewBox="0 0 160 160" role="img" aria-label="Generic body positioning illustration">
      <circle cx="80" cy="23" r="13" fill="none" stroke="currentColor" strokeWidth="5" />
      <path d="M80 39 L80 96 M80 51 L47 73 L30 59 M80 51 L113 73 L130 59 M80 96 L52 135 M80 96 L108 135"
        fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M28 148 H132" stroke="currentColor" opacity=".25" strokeWidth="2" />
      <circle cx="80" cy="59" r="8" fill="#86efac" opacity=".85" />
    </svg>
  )
}
export default function Media({ ex, id, compact, minimizable }) {
  const gifSize = useStore(s => s.S.gifSize)
  const update = useStore(s => s.update)
  if (!ex) return null
  const mini = minimizable && gifSize === 'mini'
  const steps = Array.isArray(ex.st) ? ex.st.filter(Boolean).slice(0, compact ? 1 : 2) : []
  const toggle = e => {
    e.stopPropagation()
    update(s => { s.gifSize = mini ? 'full' : 'mini' })
  }
  return (
    <div id={id} className={'exmedia tv-exercise-media' + (compact ? ' compact' : '') + (mini ? ' mini' : '')}>
      {mini ? (
        <div className="tv-mini-row"><strong>{ex.n}</strong><button type="button" className="tv-cue-toggle" onClick={toggle}>Show cues</button></div>
      ) : (
        <>
          <BodyCue />
          <div className="tv-ex-info">
            <span className="tv-overline">TRIVALLEY.FIT · FORM REFERENCE</span>
            <strong>{ex.n}</strong>
            <span className="tv-meta">{ex.tg || ex.bp || 'General fitness'}{ex.eq ? ' · ' + ex.eq : ''}</span>
            {steps.length > 0 && <ol className="tv-steps">{steps.map((step, i) => <li key={i}>{step}</li>)}</ol>}
            {steps.length === 0 && <small>Move through a controlled range of motion. Ask your coach for a personalized demonstration.</small>}
            {minimizable && <button type="button" className="tv-cue-toggle" onClick={toggle}>Hide cues</button>}
          </div>
        </>
      )}
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


# Production free edition: real training data, no fabricated coach, and accessible mobile UX.
replace_exact("src/store/useStore.js",
    "  unit: 'kg', restSec: 90, sound: true,",
    "  unit: 'lb', restSec: 90, sound: true,")
replace_exact("src/lib/coach.js",
    "  mobile ? false : demo ? true : !!(config?.coach?.enabled && user)",
    "  import.meta.env.VITE_TRIVALLEY_FREE === '1' ? false : mobile ? false : demo ? true : !!(config?.coach?.enabled && user)")
replace_exact("src/main.jsx",
    "if (!MOBILE && 'serviceWorker' in navigator && location.protocol === 'https:') {\n  navigator.serviceWorker.register('sw.js').catch(() => {})\n}",
    "if (!MOBILE && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === '127.0.0.1' || location.hostname === 'localhost')) {\n  navigator.serviceWorker.register('./tv-sw.js', { scope: './', updateViaCache: 'none' }).catch(err => console.warn('Offline install unavailable:', err))\n}")

# A previous prototype may have left data in another key; never clear storage on upgrade.
# The free edition must not offer a fake AI coach or a destructive "reset demo" action.
replace_exact("src/views/Settings.jsx",
    "<Section title={MOBILE ? t('Your data') : DEMO ? t('Demo') : t('Account')}>",
    "<Section title={MOBILE || DEMO ? t('Your data') : t('Account')}>")
replace_exact("src/views/Settings.jsx",
    """      </> : DEMO ? <>
        <Row icon="sparkles" iconTint="var(--acc)" title={t('You’re in the demo')} subtitle={t('Example data, stored only in this browser — change anything you like.')} />
        <Row icon="reset" iconTint="var(--blue)" title={t('Reset demo data')} accessory="chevron"
          onClick={() => confirmSheet({ title: t('Reset demo data?'), message: t('Puts the example plan, workouts and weigh-ins back the way they started.'), confirmText: t('Reset'), onConfirm: () => { resetDemo(); nav('/home'); toast(t('Demo data reset')) } })} />
        <Row icon="rocket" iconTint="var(--indigo)" title={t('Self-host openGym')} subtitle={t('Passkey sign-in, sync across your devices, your own data.')} accessory="chevron"
          onClick={() => window.open(REPO, '_blank', 'noopener')} />
      </> : user ? <>""",
    """      </> : DEMO ? <>
        <Row icon="lock" iconTint="var(--acc)" title="Local workout storage" subtitle="Your actual workouts stay on this device. No account or cloud sync." />
        <Row icon="upload" iconTint="var(--blue)" title="Export your backup" subtitle="Save a copy before switching phones or clearing Safari data." accessory="chevron" onClick={doExport} />
        <Row icon="info" iconTint="var(--indigo)" title="No simulated AI coaching" subtitle="Training plans and progression work without a paid AI service." />
      </> : user ? <>""")
replace_exact("src/views/Settings.jsx",
    "    const name = 'opengym-backup-' + todayISO() + '.json'",
    "    const name = 'trivalley-fit-backup-' + todayISO() + '.json'")
replace_exact("src/views/Settings.jsx",
    "    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href)",
    "    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 2000)")
settings = front / "src/views/Settings.jsx"
settings.write_text(settings.read_text().replace("to install openGym as a full-screen app.", "to install TriValley FIT as a full-screen app.").replace("openGym · {t('free & open source (AGPL v3)')}", "TriValley FIT · {t('free & open source (AGPL v3)')}"))

replace_exact("src/views/Home.jsx",
    """    {!S.routines.length && !S.active && (
      <div className="card">
        <div className="row" style={{ gap: 10, marginBottom: 6 }}>
          <span className="lrow-i"><Icon name="sparkles" /></span>
          <div className="big" style={{ fontSize: 22 }}>{t('Welcome!')}</div>
        </div>
        <div className="muted small" style={{ marginBottom: 12 }}>{t('Set up your weekly routine to get going — or load a ready-made Push / Pull / Legs plan.')}</div>
        {coachOn && <>
          <Button variant="primary" icon="sparkles" onClick={() => nav(hasConsent(S) ? '/coach/intake' : '/coach')}>{t('Let the Coach build it')}</Button>
          <div style={{ height: 8 }} />
        </>}
        <Button variant={coachOn ? 'plain' : 'primary'} icon="sparkles" onClick={loadStarterPlan}>{t('Load starter plan (PPL)')}</Button>
        <div style={{ height: 8 }} /><Button onClick={() => nav('/plan')}>{t('Build my own plan')}</Button>
      </div>
    )}""",
    """    {!S.routines.length && !S.active && (
      <div className="card tv-onboarding" role="region" aria-label="Get started">
        <div className="tv-eyebrow">YOUR TRAINING STARTS HERE</div>
        <h2 style={{ margin: '8px 0 7px' }}>Ready to train?</h2>
        <p className="muted small" style={{ marginBottom: 16 }}>Start a workout immediately, or set up a three-day Push / Pull / Legs schedule. No account required.</p>
        <Button variant="primary" icon="play" onClick={() => startFlow(null)}>Start a workout now</Button>
        <div style={{ height: 10 }} />
        <Button icon="sparkles" onClick={loadStarterPlan}>Load starter plan (PPL)</Button>
        <div style={{ height: 10 }} />
        <Button onClick={() => nav('/plan')}>Build my own plan</Button>
        <p className="tv-privacy-note">Your sessions stay on this device. Export a backup in Settings before changing phones.</p>
      </div>
    )}""")

# Allow pinch zoom on iPhone, and avoid the Wix-reserved "sw.js" filename.
html = front / "index.html"
html.write_text(html.read_text().replace("viewport-fit=cover,user-scalable=no", "viewport-fit=cover"))
# A branded static fallback stays visible if a browser blocks JavaScript or a bundle fails.
# React replaces #root on success, so the fallback does not interfere with the app.
page = html.read_text()
if page.count('<div id="root"></div>') != 1:
    raise RuntimeError("Unexpected React root; cannot install startup fallback")
page = page.replace("</head>", """<style>
html,body{background:#0c0e12;color:#e7f2ed}
.tv-splash{min-height:88vh;display:flex;flex-direction:column;justify-content:center;align-items:center;
  gap:13px;padding:30px;text-align:center;font:500 16px/1.6 system-ui,-apple-system,sans-serif}
.tv-splash strong{font-size:31px;letter-spacing:-.03em}
.tv-splash span{color:#b5c6bb}
.tv-splash a{color:#86efac}
</style></head>""", 1)
page = page.replace('<div id="root"></div>', """<div id="root">
<div class="tv-splash" id="tv-splash" role="status">
<strong>TriValley FIT</strong><span>Loading your training dashboard…</span>
<small>If this screen stays here, <a href="./?reload=1">reload the app</a>.</small>
</div></div>
<noscript>JavaScript must be enabled to use TriValley FIT.</noscript>""", 1)
html.write_text(page)

old_sw = front / "public/sw.js"
if old_sw.exists():
    old_sw.unlink()

css = front / "src/index.css"
css.open("a").write("""
.tv-onboarding {border:1px solid rgba(134,239,172,.4);background:linear-gradient(150deg,rgba(19,42,34,.85),rgba(20,26,37,.92))}
.tv-eyebrow {font-size:11px;letter-spacing:.13em;font-weight:800;color:#86efac}
.tv-privacy-note {font-size:12px;line-height:1.5;color:#b5c6bb;margin:15px 0 0}
.tv-exercise-media {align-items:flex-start;min-height:150px}
.tv-exercise-media svg {flex:0 0 27%;width:27%;max-height:130px}
.tv-ex-info {gap:6px}
.tv-ex-info .tv-meta {font-size:12px;color:#b7d9c5}
.tv-steps {padding-left:18px;margin:4px 0 5px;display:grid;gap:5px;font-size:12px;line-height:1.45;color:#dce6e2}
.tv-cue-toggle {border:1px solid rgba(134,239,172,.35);background:transparent;color:#a6f3c1;padding:7px 12px;border-radius:9px;font-size:12px;min-height:36px;cursor:pointer}
.tv-exercise-media.mini {min-height:50px;padding:10px 13px}
.tv-mini-row {display:flex;justify-content:space-between;align-items:center;gap:10px;width:100%;font-size:14px}
@media(max-width:390px){.tv-exercise-media svg{flex-basis:24%;width:24%}.tv-steps{font-size:11px}}
""")

# Exercise library describes our actual static coaching cards, never nonexistent GIFs.
replace_exact("src/views/Library.jsx",
    "{t('{0} exercises with animations', EXDB.length)}",
    "{EXDB.length} exercises · step-by-step form notes")
replace_exact("src/views/Library.jsx",
    "{t('name + body part, no animation')}",
    "Custom name and body part · stored on this device")
replace_exact("src/views/Library.jsx",
    '<input className="input" placeholder={t(\'Search…\')}',
    '<input className="input" aria-label="Search exercises" placeholder={t(\'Search…\')}')

# Versioned TriValley Library presentation. Preserve the upstream training state engine
# and keep user favorites within the existing workout state for backup/restore.
assets = Path(__file__).resolve().parent
replace_exact(
    "src/store/useStore.js",
    "exWeights: {}, workouts: [], active: null, customEx: [], gifSize: 'full',",
    "exWeights: {}, workouts: [], active: null, customEx: [], favoriteExercises: [], gifSize: 'full',"
)
library_component = (assets / "Library.jsx").read_text()
if "data-testid=\"tv-library\"" not in library_component or "favoriteExercises" not in library_component:
    raise RuntimeError("TriValley Library source is missing persistent favorites or test hooks")
(front / "src/views/Library.jsx").write_text(library_component)
(front / "src/index.css").open("a").write("\n" + (assets / "library-tune.css").read_text())
# Keep visible, exact AGPL corresponding-source attribution and upstream credit.
# The build verifier enforces this; styling alone may reduce visual crowding.
# Optional coaching invitation is separate from the free workout tools;
# it does not imply an AI coach or any in-app subscription/checkout.
replace_exact(
    "src/views/Home.jsx",
    """    <div className="card">
      <div className="row between" style={{ marginBottom: 6 }}>
        <h2 style={{ margin: 0 }}>{t('Body weight')}</h2>""",
    """    <div className="card tv-coaching-card">
      <div className="tv-eyebrow">TRIVALLEY.FIT COACHING</div>
      <h2 style={{ margin: '7px 0' }}>Get a plan built around you</h2>
      <p className="muted small" style={{ marginBottom: 12 }}>Train on your own here, or explore personalized coaching, form checks and accountability.</p>
      <a className="btn plain" href="https://www.trivalley.fit/" target="_blank" rel="noopener noreferrer">Explore coaching at TriValley.fit</a>
    </div>
    <div className="card">
      <div className="row between" style={{ marginBottom: 6 }}>
        <h2 style={{ margin: 0 }}>{t('Body weight')}</h2>"""
)

print("TriValley original-source modifications applied; real OpenGym logic retained.")
