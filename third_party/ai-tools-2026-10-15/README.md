# Nine AI tools — acquired source and verification

These are the nine repositories visible in Nick’s screenshots (items 1–6 and 8–10). Item 7 was not supplied. All nine official source trees were downloaded and passed `git fsck --no-dangling`. Source is attached here as **pinned Git submodules**, preserving each upstream repository and license. These are not separate forks under Nick’s account.

**None is end-to-end verified or installed on Nick’s Mac.** The checks below are the actual evidence; a passing component test does not establish a running app or profitable trading. No model call, paid generation, trade, email send or deployment was performed.

Renames verified: `Anil-matcha/Open-Higgsfield-AI` redirects to `Anil-matcha/Open-Generative-AI`; `danny-avila/LibreChat` redirects to `LibreChat-AI/LibreChat`.

## Acquire the pinned source

From the root of Nicholas-AI-OS on this branch:

```sh
git submodule update --init -- third_party/ai-tools-2026-10-15/sources
```

This downloads source only. Open-Generative-AI and Open-LLM-VTuber also declare nested submodules; initialize those separately when setting up the corresponding application. Review each upstream README and dependency manifests first. Keep application dependencies in separate environments.

## What actually passed

| Repository | Evidence | Remaining before calling it working |
|---|---|---|
| [The-Swarm-Corporation/AutoHedge](https://github.com/The-Swarm-Corporation/AutoHedge/tree/c549c7950da112286e76725d49f6a25de8fa99bd) | 19 Python files parsed; Git object integrity passed. | Live analysis needs an LLM key/provider; no provider call or order execution tested. Dependencies are broadly unpinned upstream. |
| [HKUDS/Vibe-Trading](https://github.com/HKUDS/Vibe-Trading/tree/29aa084fb7866087c612ddd55ef5449824374e22) | 39 upstream privacy/environment configuration tests passed. | Full application, connectors, model responses and trade execution untested; needs configured providers and market accounts for those features. |
| [Fincept-Corporation/FinceptTerminal](https://github.com/Fincept-Corporation/FinceptTerminal/tree/3d8617cae3f13c93874d4bee4fb0f2846e9c83bc) | 1,156 Python files parsed; Git object integrity passed. | Qt desktop not built: CMake 3.27.7, Ninja 1.11.1, Qt 6.8.3 and embedded Python 3.11.9 needed. Read its custom dual-license notice before business use. |
| [LibreChat-AI/LibreChat](https://github.com/LibreChat-AI/LibreChat/tree/e1dfc10449ff713faffacd60273fddcfe2c0a698) | 2 upstream translation-reference tests passed. | No full build or running chat instance. Needs backend database/services and chosen model configuration; free source does not include paid model API usage. |
| [Anil-matcha/Open-Generative-AI](https://github.com/Anil-matcha/Open-Generative-AI/tree/0668c210ebfe893f16c5149405a08d00b9ae90df) | 50 upstream local-inference tests passed. | Legacy scripts/test_minimax_provider.js fails parsing the current model registry. No image/video generated. Desktop build needs nested submodules; remote MuAPI generation needs its own key/billing; local generation needs an engine/model. A .py fixture is intentionally JavaScript, not broken Python. |
| [Open-LLM-VTuber/Open-LLM-VTuber](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber/tree/992309c0aa19845960228f880013d4685fde93b5) | 125 Python files parsed; Git object integrity passed. | Voice/avatar/model response untested. Needs frontend submodule, Python >=3.10,<3.13 and chosen ASR/TTS/LLM assets/configuration. Sample avatars have separate license considerations. |
| [cloudflare/agentic-inbox](https://github.com/cloudflare/agentic-inbox/tree/48039bb6785af34e592c2966f87cde2b255c4c80) | npm ci succeeded; npm run typecheck and npm run build passed. | No deployed inbox, inbound/outbound email or AI response tested. Needs domain, Cloudflare Access, Email Routing/Service, Durable Objects, R2 and Workers AI. Not an automatic Gmail connection. |
| [jo-inc/camofox-browser](https://github.com/jo-inc/camofox-browser/tree/39c82094013480b373df6600d44c7f036f58356e) | Locked npm install succeeded. Initial unit run: 853 passed, 30 failed, 2 skipped (76 suites), with missing browser binary. Browser engine then installed successfully; cookie suite passed on rerun. | Full rerun stalled in browser-backed checks and was stopped without a final suite summary. Browser integration remains unverified; do not treat this repo as ready to run. |
| [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes/tree/917ee5d31342f8c8a4a14659679762489cafe665) | 8 upstream package-graph, CLI-process-ownership and workspace-contract tests passed. | Full Bun workspace build and HTML-to-MP4 rendering untested. Bun absent. The selected CLI checker used TypeScript from the isolated Camofox dependency install. |

## Screenshot claims that require qualification

- AutoHedge and Vibe-Trading source availability does not prove profitability or authorize real-money trading. Model and broker/exchange setup are separate.
- LibreChat is a self-hosted interface; access to proprietary models is not made free by installing the interface.
- Open-Generative-AI supports local paths as well as hosted APIs. Remote generation can incur charges and sends the request to its provider.
- Fincept’s checked-out README explicitly identifies data/LLM bills. Its LICENSE adds custom commercial/internal-use restrictions; it is not a blanket free Bloomberg replacement.
- Agentic Inbox needs Cloudflare/domain setup beyond its deploy button. Access policy members can access all mailboxes by design; do not connect sensitive mail before reviewing that trust boundary.
- Camofox is browser infrastructure. This verification does not test CAPTCHA bypass or the slide’s 90% cost-reduction claim.
- Hyperframes requires a rendering toolchain; acquiring the source does not install it or produce an MP4.

## Reproduce the checks

Exact commits and per-repo limitations are in [sources.lock.json](sources.lock.json). The test commands used were:

```sh
# Vibe-Trading, using an isolated Python environment with pytest
python -m pytest tools/test_ci_private_files_gate.py tools/test_ci_env_var_gate.py -q
# Open-Generative-AI (no MUAPI_KEY)
node --test tests/*.test.js
node scripts/test_minimax_provider.js  # failed: stale registry parser
# LibreChat
node --test scripts/i18n.test.mts
# Hyperframes: selected tooling tests, not renderer tests
node --test scripts/check-package-cycles.test.mjs scripts/check-cli-process-ownership.test.mjs scripts/check-workspace-contracts.test.mjs
# Agentic Inbox, after locked dependency installation
npm run typecheck
npm run build
# Camofox, after locked dependency installation; telemetry disabled
CAMOFOX_CRASH_REPORT_ENABLED=false npm run test:unit
```

Source-integrity and Python syntax checks ran without importing application code. The apparent Python syntax failure in Open-Generative-AI was an intentionally JavaScript fixture named `tests/fixtures/fake-wan2gp/wgp.py`; its own tests run it with Node. No upstream source was patched to hide failures.
