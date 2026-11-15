# Nicholas AI OS — open-source market desk integration

**Reviewed November 14, 2026 (Pacific). Status: draft, paper-only, not deployed.**

## Verified upstream sources and acquisition

| Upstream | Commit pinned in this repository | License | Role |
|---|---|---|---|
| [OpenBB](https://github.com/openbq-org/OpenBB) (original OpenBB-finance URL redirects) | e43353a82815ff9ba56ad1b7ad47c32729dcf314 | Apache-2.0 | Data platform and historical research. New optional Git submodule. |
| [FinceptTerminal](https://github.com/Fincept-Corporation/FinceptTerminal) | 3d8617cae3f13c93874d4bee4fb0f2846e9c83bc | AGPL-3.0 | Already linked; reference-only until license and trademark implications are reviewed. |
| [Vibe-Trading](https://github.com/HKUDS/Vibe-Trading) | 29aa084fb7866087c612ddd55ef5449824374e22 | MIT | Already linked; optional separate sandbox for human-reviewed agentic research. |
| [QuantConnect LEAN](https://github.com/QuantConnect/Lean) | 82d26047e95a89b53c9cbe02b67efaa3c4455ed9 | Apache-2.0 | Optional isolated backtesting environment. New Git submodule. |

A submodule is a *pointer* to a pinned upstream commit. It does not install, execute, or fully security-audit that repository. Do **not** run full recursive submodule checkout in production: upstream projects are large. Initialize only the necessary submodule. Check licenses of the specific revisions before modifying/distributing their code. Fincept's documentation has evolved and requires individual review before any business, hosted, or proprietary use. Provider data subscriptions, exchange entitlements, brokerage access, and AI credits are separate from GitHub licensing.

## New executable research components

1. `trading/confluence_report.py`: no-network, no-order analysis of the existing `trading.market_feed.build_snapshot()` minute-bar format. Exposes bar-derived VWAP, EMA 9/21, Wilder RSI 14, relative last-bar volume, 15-minute opening range, missing-minute gaps, and a bar-typical-price volume **proxy** level. The proxy is **not true volume-at-price POC**. Records provider and observation timestamps. Enforces a fresh, timezone-aware US stock session by default and explicitly labels archived runs historical.
2. `trading/openbb_history.py`: optional, manually invoked OpenBB historical daily OHLCV adapter. Its library import and provider requests occur **only** when called. No brokerage orders or paid data are authorized.
3. Targeted offline tests: `tests/test_confluence_report.py` and `tests/test_openbb_history.py`. Tested with synthetic data and injected fake OpenBB clients, not actual market data.

These do **not** replace `trading/daytrade_engine.py`, `trading/paper_engine.py` or existing risk policies. The old `trading/latest_market_snapshot.json` has a different schema; do not use it as an input to the new confluence module.

## Manual local usage

From the repository root, run:

```sh
python3 -m unittest discover -s tests -p 'test_confluence_report.py' -v
python3 -m unittest discover -s tests -p 'test_openbb_history.py' -v
```

To make a read-only source snapshot **during regular US equity session hours** using the *existing* authenticated Alpaca IEX feed or its documented Yahoo chart fallback, after reviewing provider terms:

```sh
python3 - <<'PY'
import json
from pathlib import Path
from trading.market_feed import build_snapshot
snapshot = build_snapshot(['SPY', 'QQQ', 'MSFT'])
Path('/tmp/nicholas-paper-snapshot.json').write_text(json.dumps(snapshot), encoding='utf-8')
PY
python3 -m trading.confluence_report /tmp/nicholas-paper-snapshot.json
```

An archive can be inspected with `--historical` but must not be described as current. IEX is not a consolidated all-exchange quote and the Yahoo fallback is not certified for trade execution. The default freshness gate rejects snapshots older than ten minutes and future timestamps. Output is an analysis report, not a broker order or investment recommendation.

For manually invoked OpenBB V5 history, install openbb-cboe in an isolated Python virtual environment and run openbb-build. The older generic equity price router belongs to V4; V5 uses the Cboe provider namespace:

```sh
python3 -m trading.openbb_history --symbol MSFT --limit 90
# No third-party paid provider or broker is invoked
```

LEAN should be initialized in a separate local Docker/CLI environment with appropriately licensed data. Do not claim LEAN backtests have run merely because the code is linked. When tested, require lookahead/survivorship checks, realistic spreads, commissions, slippage, session boundaries, out-of-sample and walk-forward periods, and drawdown analysis before comparing results with the existing paper engine.

## Chief of Staff — Council recommendation and audit gate

**Recommendation:** Keep this as a draft PR, with no auto-merge and no live trading. Compare the new confluence report with a single verified SPY/QQQ session before adding recurring automation or further subscriptions.

- **Operator lens:** one existing data source and one existing risk policy should remain canonical; the new code is read-only and composable.
- **Owner/user lens:** the report should show *actual observable numbers*, timeframe, provider and gaps rather than AI-generated unverified trading calls.
- **Downside lens:** large submodules, AGPL, changing commercial documentation, API entitlements, and agentic execution introduce cost, licensing, data-quality, and loss risk. No broker credentials, external order endpoints, LLM calls, or paid service activation.
- **Strongest disagreement:** the potential convenience of full terminals versus their maintenance burden and poor reproducibility. Reversible first experiment: one synthetic test suite and one separately verified historical session.

**Before merging/deploying:** verify pinned submodule resolution, full existing CI, third-party licensing, data terms and dependency security; compare indicator outputs to a second independent reference; confirm no orders/spend and retain current paper risk limits. Mark each gate Passed/Blocked and record evidence. GitHub acceptance does not prove actual market connectivity or profitable results.

**Chief handoff:** this PR and its linked review issue are meant for the next owner-directed Chief/Council assessment; they do not change the standing scheduled briefing's saved prompt.


## November 14 validation and controlled deployment

Alpaca's connected read-only tool supplied 1,157 IEX one-minute observations for the Nov 13, 2026 US trading session, requested between 09:30 and 16:00 ET:
- SPY 390 bars, zero missing regular-session minutes.
- QQQ 378 bars (including one at 16:00 ET), 13 missing regular-session minutes.
- MSFT 389 bars, one missing minute.

The source was the **ChatGPT Alpaca connector**, NOT a GitHub Actions key. The real data confirmed coverage and boundaries but did NOT run the repo's Python code against that connector result. Missing-minute or estimated-spread symbols are excluded from paper review, not treated as clean live quotes.

### New connected code

- trading/market_desk_pipeline.py: sanitizes only exact 16:00 ET boundary bars, rejects all other off-hours input, computes a source-based confluence report and applies per-symbol quality gates. Explicit --paper-replay uses the existing paper engine only on complete 390-minute sessions. It makes no orders.
- trading/market_feed.py: its existing Alpaca and Yahoo adapters now filter to minute bars strictly between 09:30 and 16:00 ET. The new hosted research path does **not** authorize Yahoo fallback.
- trading/openbb_history.py: optional OpenBB V5 Cboe historical endpoint, explicitly invoked and isolated. It does not install OpenBB or use keys by itself.
- scripts/run_market_desk_report.py: hosted status checks output only ticker, provider, coverage, missing minutes and gate status. No raw OHLCV, private balances, customer data, credentials or trade signals go to the public Actions log.
- .github/workflows/market-desk-research.yml: read-only GitHub Actions after-close weekdays at 22:15 UTC (14:15 PST or 15:15 PDT); manual dispatch too. Data source is Alpaca IEX only, requires GitHub secrets, and is intentionally skipped with no credential.
- .github/workflows/market-desk-readonly.yml: CI covers data gating, OpenBB V5 API contract, time-boundary handling, existing paper risk checks, missing credentials and no-order static audit.

### Integration boundaries

1. Existing trading/market_feed.py is the primary repo data reader. ChatGPT's Alpaca connector cannot automatically share its authorization with GitHub Actions.
2. Indicators are historical/contextual; the approximate POC is not a true volume-at-price level; estimated spreads and missing observations invalidate execution-quality evidence.
3. HKUDS/Vibe-Trading remains a sandbox-only research hypothesis generator, without broker credentials or paid-agent activation.
4. QuantConnect/Lean is a pinned source reference. A proper independently reproduced LEAN run requires a compatible QuantConnect tier, Docker and market data. No purchase or backtest claim is authorized by this code.
5. FinceptTerminal stays reference-only pending AGPL/commercial rights review.
6. Existing paper policies/risk limits remain unchanged. Only a separately requested, explicit paper-replay can simulate paper events.
7. Chief of Staff and Muse should consume this dated QC report, not infer a real profitable strategy, live signal, delivery or authorization to spend.

### Workflow validation and first use

From the repository root on Python 3.12:

~~~sh
python -m unittest tests.test_confluence_report tests.test_openbb_history tests.test_market_desk_pipeline tests.test_market_feed_boundaries tests.test_daytrade_engine tests.test_paper_trading_desk -v
python -m trading.market_desk_pipeline /private/snapshot.json --historical
# Optional and illustrative only after full data validation:
python -m trading.market_desk_pipeline /private/snapshot.json --historical --paper-replay
~~~

Hosted workflow: https://github.com/2strongtrainers-art/Nicholas-AI-OS/actions/workflows/market-desk-research.yml

GitHub Secrets required separately: APCA_API_KEY_ID and APCA_API_SECRET_KEY. If missing, the workflow must emit SKIPPED_NO_ALPACA_DATA_CREDENTIALS and not pretend it fetched data. Never paste tokens into GitHub source, comments or chat. A working ChatGPT Alpaca connector is not proof those secrets exist in GitHub.

Do not treat passing synthetic CI as proof of production data ingestion, QuantConnect LEAN backtest, Fincept runtime or Vibe-Trading agent deployment. Verify each transition independently before claiming it.
