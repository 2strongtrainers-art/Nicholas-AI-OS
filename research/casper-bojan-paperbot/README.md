# Casper–Bojan Crypto Paper Bot

Deterministic BTC/ETH research and paper-trading system built from the Jason Casper / Bojan-style checklist previously used in Nicholas Kaplan's trading conversations. “Bojan-style” is historical shorthand, not a claim that this is an official Bojan ruleset.

## What is automated

- Public 5-minute BTCUSDT and ETHUSDT market-data retrieval
- 15-minute and 1-hour trend alignment without partial-candle lookahead
- liquidity sweep / swing-failure detection
- sweep-then-market-structure confirmation within six 5-minute bars
- VWAP reclaim/rejection plus RSI, MACD, Bollinger, and relative-volume confluences
- minimum five confluences and minimum 2.3R target
- next-bar paper entry, persistent JSON state, idempotent signal handling, stop/target monitoring, and append-only event logs
- optional webhook alerts through `PAPER_ALERT_WEBHOOK_URL`
- 0.25% account risk per trade, 0.5% total open risk, 1% daily loss cutoff, and three trades per UTC day
- conservative stop-first handling if stop and target touch within one candle
- fixed historical, chronological out-of-sample, harsh-cost, and untouched prior-window tests in CI

`paper_daemon.py` contains no authenticated exchange client and no live order route. Conversation memories and screenshots are treated as strategy evidence, never as permission to improvise orders. See `STRATEGY_EVIDENCE.md`.

## Current validation verdict — August 25, 2026

The workflow is green, but the strategy verdict is **NO_GO_LIVE**.

| Window | Combined OOS expectancy | Profit factor | Net return | Trades |
| --- | ---: | ---: | ---: | ---: |
| 2026-02-26 to 2026-08-24 | -0.178R | 0.810 | -1.71% | 38 |
| 2025-08-29 to 2026-02-25 untouched prior window | -0.189R | 0.803 | -1.58% | 33 |

BTC was negative in the primary OOS window. ETH showed +0.156R expectancy and 1.208 profit factor in that one OOS slice, but failed the untouched prior-window falsification. That is insufficient evidence for real-money execution.

## Run once

```bash
python -m pip install pandas numpy
python paper_daemon.py
```

State is written atomically to `state/paper-state.json`; events append to `state/events.jsonl`. Re-running the command does not duplicate the same signal.

## Run continuously on a Mac mini

The `launchd/` template runs the paper daemon every five minutes and restarts it after a crash. Replace `__REPLACE_WITH_PROJECT_DIRECTORY__` with the absolute project directory before loading it as a LaunchAgent. Keep the state directory on durable local storage and back it up.

## Promotion gates

Live execution stays disabled unless a frozen strategy version passes all predeclared gates:

- at least 30 OOS trades
- OOS expectancy above +0.10R
- OOS profit factor above 1.20
- worst-symbol OOS drawdown below 10%
- positive expectancy under harsh costs
- a later extended real-time paper run that materially agrees with backtest behavior

Passing those gates would permit a separately reviewed exchange adapter; it would not automatically enable live trading or guarantee profit.

## Primary data references

- Binance's market-data-only host documents `GET /api/v3/klines`: https://github.com/binance/binance-spot-api-docs/blob/master/faqs/market_data_only.md
- Binance public historical data: https://github.com/binance/binance-public-data
- GitHub scheduled workflows run from the default branch and may run as often as every five minutes: https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions#onschedule
