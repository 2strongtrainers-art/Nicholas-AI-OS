# Nicholas AI Repository Split

## Goal
Keep `Nicholas-AI-OS` as the stable orchestration/control plane while extracting reusable application code into focused repositories without breaking the current iPhone -> GitHub -> Mac job path.

## Target repositories

### 1. Nicholas-Video-Engine
Purpose: reusable Reel/video/audio generation code.

Move/copy these source areas:
- `video_intelligence/`
- `templates/openmontage/`
- `scripts/openmontage_fast_reel_edl.py`
- `scripts/openmontage_moneyprinter.py`
- `scripts/openmontage_moneyprinter_diagnostics.py`
- `scripts/openmontage_moneyprinter_fast_whisper.py`
- `scripts/openmontage_moneyprinter_macos.py`
- `scripts/run_video_wizard_intelligence.py`
- `scripts/render_video.py`
- `scripts/render_client_brief.py`
- `scripts/render_market_brief.py`
- `scripts/render_photo_intro.py`
- `services/elevenlabs-cloudflare-bridge/`
- `docs/VIDEO_ENGINE.md`
- `docs/moneyprinter-fast-reel.md`
- `docs/video-wizard-adaptation.md`
- `third_party/MoneyPrinterTurbo-LICENSE.txt`
- video-related tests and CI workflows

Keep the OpenMontage queue/worker bridge in `Nicholas-AI-OS` so existing job delivery keeps working.

### 2. Nicholas-Trading-Lab
Purpose: paper-trading research, market feeds, risk policies, tests, and trading CI. This remains paper/research-only unless explicitly changed later.

Move/copy these source areas:
- `trading/`
- `scripts/install_coinbase_crypto_futures_paper.sh`
- `scripts/install_paper_daytrader_feed.sh`
- `scripts/openmontage_trading_stack.py`
- `scripts/run_coinbase_crypto_futures_paper_once.py`
- `scripts/run_hermes_paper_trading_desk.py`
- `scripts/run_paper_daytrade_cycle.py`
- `scripts/run_paper_daytrade_feed_once.py`
- `docs/coinbase-crypto-futures-paper-v1.md`
- `docs/coinbase-futures-live-boundary.md`
- `docs/coinbase-futures-research-2026-08-25.md`
- `docs/coinbase-futures-safety-notes.md`
- `docs/hermes-paper-trading-desk.md`
- trading-related tests and CI workflows

Runtime job requests/results stay in `Nicholas-AI-OS/jobs/`.

### 3. Nicholas-Agent-Stack
Purpose: reusable local-agent/operator configuration and free-agent stack.

Move/copy these source areas:
- `hermes/`
- `stacks/free-ai-8/`
- `scripts/configure_hermes_safe.sh`
- `scripts/configure_nicholas_operator_brain.sh`
- `scripts/install_agent_stack.sh`
- `scripts/openmontage_agent_stack.py`
- agent-related tests and CI workflows

Machine-specific job files and status stay in `Nicholas-AI-OS`.

## Nicholas-AI-OS remains responsible for
- request routing
- job queue and operational state
- generated artifact pointers
- Mac worker/keep-awake bridge
- Cloudflare/control-plane entry points
- cross-repository orchestration
- compatibility shims during migration

## Not splitting yet
- FORGE 90
- TriValley.fit business/web code

There is not currently enough standalone source code for those in this repository to justify creating empty repos.

## Safety rules
1. Do not delete source from `Nicholas-AI-OS` until the extracted repo passes tests and the orchestrator is updated to consume it.
2. New repos default to private.
3. Do not copy generated media, job logs, credentials, secrets, `.env` files, or machine-local state.
4. Preserve third-party license notices.
5. Paper-trading code remains non-live by default.

## Migration order
1. Create target repos privately.
2. Copy source into each target repo.
3. Run tests in each target repo.
4. Update `Nicholas-AI-OS` to call/import the extracted components.
5. Run end-to-end bridge tests.
6. Only then remove duplicate source from the orchestrator.
