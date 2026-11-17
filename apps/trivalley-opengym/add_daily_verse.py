#!/usr/bin/env python3
"""Add offline, optional daily Scripture inspiration to the existing TriValley OpenGym patch."""
from pathlib import Path
import shutil
import sys

front = Path(sys.argv[1]).resolve()
root = Path(__file__).resolve().parent
if not (front / "src/App.jsx").is_file():
    raise SystemExit("Expected patched OpenGym frontend path")

def replace_once(relative, old, new):
    path = front / relative
    current = path.read_text()
    count = current.count(old)
    if count != 1:
        raise RuntimeError(f"{relative}: expected exactly one integration anchor, got {count}: {old[:75]!r}")
    path.write_text(current.replace(old, new, 1))

shutil.copyfile(root / "DailyVerse.jsx", front / "src/components/DailyVerse.jsx")
replace_once("src/App.jsx",
    "import RestTimer from './components/RestTimer.jsx'",
    "import RestTimer from './components/RestTimer.jsx'\nimport DailyVerse from './components/DailyVerse.jsx'")
replace_once("src/App.jsx",
    '<div className="tv-topbar"><span>TRIVALLEY.FIT TRAINING</span>',
    '<div className="tv-topbar"><span>TRIVALLEY.FIT TRAINING</span>'
    '<button type="button" data-testid="tv-daily-verse-trigger" className="tv-verse-trigger"'
    ' onClick={() => window.dispatchEvent(new Event("tv:verse-open"))}>Daily Bible verse</button>')
replace_once("src/App.jsx",
    "      <Toast />",
    "      <Toast />\n      <DailyVerse active={!!(ready && authed)} />")

# Client-wide setting defaults to on per owner request, with clear opt-out.
replace_once("src/views/Settings.jsx",
    "  const wakeOK = wakeLockSupported()",
    "  const wakeOK = wakeLockSupported()\n"
    "  const [verseEnabled, setVerseEnabled] = useState(() => localStorage.getItem('tv_daily_verse_enabled_v1') !== 'false')")
replace_once("src/views/Settings.jsx",
    "    {/* ---------- during a workout ---------- */}",
    """    <Section title="Daily inspiration" footer="Shows the first time you open the app each day. Not a scheduled phone notification.">
      <div data-testid="tv-verse-settings">
        <Row icon="sparkles" iconTint="var(--acc)" title="Daily Bible verse"
          subtitle="Scripture connected to strength, perseverance, service, and recovery.">
          <Switch checked={verseEnabled} onChange={v => {
            setVerseEnabled(v)
            localStorage.setItem('tv_daily_verse_enabled_v1', String(v))
            window.dispatchEvent(new Event('tv:verse-preference'))
          }} />
        </Row>
      </div>
      <Row icon="calendar" iconTint="var(--blue)" title="Read today's verse"
        subtitle="You can open it whenever you like." accessory="chevron"
        onClick={() => window.dispatchEvent(new Event('tv:verse-open'))} />
    </Section>

    {/* ---------- during a workout ---------- */}""")

with (front / "src/index.css").open("a") as css:
    css.write("""
/* Daily faith + fitness: original UI, self-contained, accessible and offline. */
.tv-verse-trigger{display:inline-flex;align-items:center;min-height:35px;margin-left:12px;
  border:1px solid rgba(134,239,172,.45);border-radius:99px;background:rgba(134,239,172,.11);
  color:#bdf7cb;padding:4px 12px;font-size:11px;letter-spacing:0;font-weight:700;cursor:pointer}
.tv-verse-trigger:focus-visible,.tv-verse-card button:focus-visible,.tv-verse-full:focus-visible{
  outline:3px solid #b1f0ca;outline-offset:2px}
.tv-verse-overlay{position:fixed;inset:0;z-index:350;background:rgba(4,11,12,.86);
  display:flex;align-items:center;justify-content:center;padding:calc(14px + env(safe-area-inset-top)) 14px calc(14px + env(safe-area-inset-bottom))}
.tv-verse-card{position:relative;background:linear-gradient(152deg,#20332b 0%,#0c1418 72%);
  color:#f1f8f4;border:1px solid rgba(169,237,194,.35);border-radius:24px;
  box-shadow:0 24px 80px #0009;max-width:450px;width:100%;
  max-height:calc(100dvh - 36px);overflow:auto;overscroll-behavior:contain;
  padding:32px 25px 24px;text-align:left}
.tv-verse-x{position:absolute;top:9px;right:10px;width:44px;height:44px;
  background:transparent;border:0;color:#e1eee7;border-radius:50%;font-size:30px;cursor:pointer}
.tv-verse-kicker{font-size:10px;letter-spacing:.13em;color:#94cbaa;font-weight:800;margin-bottom:23px;
  padding-right:28px}
.tv-verse-eyebrow{font-size:11px;letter-spacing:.16em;font-weight:750;color:#b7f4c9}
.tv-verse-card h2{font-size:clamp(24px,7vw,30px);line-height:1.16;letter-spacing:-.035em;
  margin:12px 0 14px;color:#fff}
.tv-verse-quote{font-size:clamp(18px,5vw,23px);line-height:1.44;font-family:Georgia,serif;
  color:#fff;margin:16px 0 8px}
.tv-verse-ref{color:#b8e9c3;font-size:13px;font-weight:650;margin-bottom:20px}
.tv-verse-divider{height:1px;background:rgba(221,247,227,.18);margin:20px 0}
.tv-verse-reflection{font-size:15px;line-height:1.55;color:#dceae2;margin:10px 0 13px}
.tv-verse-full{display:inline-block;color:#a9f3c1;text-decoration:underline;
  text-underline-offset:3px;font-size:13px;margin:0 0 23px}
.tv-verse-primary{display:block;width:100%;min-height:48px;background:#a4e6ba;border:0;border-radius:12px;
  color:#10271c;font-size:15px;font-weight:800;cursor:pointer}
.tv-verse-optout{display:block;width:100%;min-height:42px;padding:7px;background:transparent;
  border:0;color:#b9ccc1;font-size:12px;text-decoration:underline;cursor:pointer;margin-top:6px}
@media(max-width:390px){.tv-verse-card{padding:26px 20px 19px}.tv-verse-kicker{margin-bottom:14px}}
@media(prefers-reduced-motion:reduce){.tv-verse-overlay *, .tv-verse-card{animation:none!important;transition:none!important}}
""")

print("Daily Bible verse added to the existing local-first OpenGym build.")
