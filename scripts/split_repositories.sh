#!/usr/bin/env bash
set -euo pipefail

# Safely creates focused private repos from Nicholas-AI-OS without deleting or
# changing the existing orchestrator. Requires authenticated GitHub CLI (`gh`).

OWNER="${GITHUB_OWNER:-2strongtrainers-art}"
ROOT="$(git rev-parse --show-toplevel)"
WORK="${TMPDIR:-/tmp}/nicholas-repo-split-$$"

command -v gh >/dev/null || { echo "gh CLI is required" >&2; exit 1; }
command -v git >/dev/null || { echo "git is required" >&2; exit 1; }
gh auth status >/dev/null

mkdir -p "$WORK"
trap 'rm -rf "$WORK"' EXIT

copy_one() {
  local src="$1" dest="$2"
  if [[ ! -e "$ROOT/$src" ]]; then
    echo "Skipping missing path: $src"
    return 0
  fi
  mkdir -p "$dest/$(dirname "$src")"
  cp -R "$ROOT/$src" "$dest/$src"
}

create_repo() {
  local repo="$1"; shift
  local dest="$WORK/$repo"
  mkdir -p "$dest"

  if gh repo view "$OWNER/$repo" >/dev/null 2>&1; then
    echo "Refusing to overwrite existing repository: $OWNER/$repo" >&2
    exit 2
  fi

  for path in "$@"; do
    copy_one "$path" "$dest"
  done

  cat > "$dest/README.md" <<EOF
# $repo

Extracted from \`$OWNER/Nicholas-AI-OS\` as part of the repository separation plan.

The original orchestrator remains the control plane during migration. Generated media, runtime jobs, credentials, secrets, and machine-local state are intentionally excluded.
EOF

  cat > "$dest/.gitignore" <<'EOF'
.env
.env.*
!.env.example
__pycache__/
*.pyc
.DS_Store
node_modules/
dist/
build/
generated/
jobs/
EOF

  (
    cd "$dest"
    git init -b main
    git add .
    git commit -m "Initial extraction from Nicholas-AI-OS"
    gh repo create "$OWNER/$repo" --private --source=. --remote=origin --push
  )

  echo "Created private repository: $OWNER/$repo"
}

create_repo "Nicholas-Video-Engine" \
  "video_intelligence" \
  "templates/openmontage" \
  "scripts/openmontage_fast_reel_edl.py" \
  "scripts/openmontage_moneyprinter.py" \
  "scripts/openmontage_moneyprinter_diagnostics.py" \
  "scripts/openmontage_moneyprinter_fast_whisper.py" \
  "scripts/openmontage_moneyprinter_macos.py" \
  "scripts/run_video_wizard_intelligence.py" \
  "scripts/render_video.py" \
  "scripts/render_client_brief.py" \
  "scripts/render_market_brief.py" \
  "scripts/render_photo_intro.py" \
  "services/elevenlabs-cloudflare-bridge" \
  "docs/VIDEO_ENGINE.md" \
  "docs/moneyprinter-fast-reel.md" \
  "docs/video-wizard-adaptation.md" \
  "third_party/MoneyPrinterTurbo-LICENSE.txt" \
  "tests/test_openmontage_fast_reel_edl.py" \
  "tests/test_openmontage_moneyprinter.py" \
  "tests/test_openmontage_video_intelligence.py" \
  ".github/workflows/openmontage-ci.yml" \
  ".github/workflows/test-moneyprinter-fast-reel.yml" \
  ".github/workflows/render-client-brief.yml" \
  ".github/workflows/render-market-brief.yml" \
  ".github/workflows/render-photo-intro.yml" \
  ".github/workflows/render-video.yml" \
  ".github/workflows/elevenlabs-demo.yml" \
  ".github/workflows/test-elevenlabs.yml"

create_repo "Nicholas-Trading-Lab" \
  "trading" \
  "scripts/install_coinbase_crypto_futures_paper.sh" \
  "scripts/install_paper_daytrader_feed.sh" \
  "scripts/openmontage_trading_stack.py" \
  "scripts/run_coinbase_crypto_futures_paper_once.py" \
  "scripts/run_hermes_paper_trading_desk.py" \
  "scripts/run_paper_daytrade_cycle.py" \
  "scripts/run_paper_daytrade_feed_once.py" \
  "docs/coinbase-crypto-futures-paper-v1.md" \
  "docs/coinbase-futures-live-boundary.md" \
  "docs/coinbase-futures-research-2026-08-25.md" \
  "docs/coinbase-futures-safety-notes.md" \
  "docs/hermes-paper-trading-desk.md" \
  "tests/test_coinbase_crypto_futures_paper.py" \
  "tests/test_coinbase_mtf_hermes.py" \
  "tests/test_daytrade_engine.py" \
  "tests/test_paper_trading_desk.py" \
  ".github/workflows/coinbase-crypto-futures-paper-ci.yml" \
  ".github/workflows/paper-daytrader-ci.yml"

create_repo "Nicholas-Agent-Stack" \
  "hermes" \
  "stacks/free-ai-8" \
  "scripts/configure_hermes_safe.sh" \
  "scripts/configure_nicholas_operator_brain.sh" \
  "scripts/install_agent_stack.sh" \
  "scripts/openmontage_agent_stack.py" \
  "tests/test_free_ai_8.py" \
  ".github/workflows/free-ai-8-ci.yml" \
  ".github/workflows/free-ai-8-health.yml"

echo "Split repositories created. Nicholas-AI-OS was not modified or deleted."
