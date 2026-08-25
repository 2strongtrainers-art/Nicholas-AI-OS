# Hermes Paper Trading Desk

## Purpose

Nicholas Operator may analyze market snapshots, rank hypothetical setups, and keep a paper-trading journal. The system is designed to prove discipline and performance before any live execution integration is considered.

## Safety boundary

- `trading/risk_policy.json` must remain `mode=paper_only`.
- `live_execution_enabled` must remain `false`.
- `live_broker_adapters` must remain empty.
- The deterministic risk engine rejects any setup declaring `execution=live`.
- Hermes receives recommendation-only instructions and cannot override the risk engine.
- No brokerage credential is stored in this repository.
- Live order placement is not implemented.
- Any future live-broker adapter requires a separate reviewed change and explicit approval immediately before real-money execution is enabled.

## V1 workflow

1. An approved market-data source writes a narrowly scoped `trading/latest_market_snapshot.json`.
2. The snapshot explicitly declares `paper_only=true`.
3. Nicholas Operator/Hermes summarizes the regime and ranks up to three simulated setups.
4. A selected setup is passed to `trading/paper_engine.py`.
5. The deterministic engine enforces position/risk limits and calculates hypothetical size.
6. Paper fills and exits are journaled separately.
7. Performance is audited over a meaningful sample before any live integration is considered.

## Default paper controls

Defaults are intentionally conservative and configurable:

- Starting paper equity: $100,000
- Risk per trade: 0.25%
- Max daily loss: 1.0%
- Max aggregate open risk: 0.75%
- Max open positions: 3
- Max trades/day: 6
- Stops required
- Averaging down disabled

These are simulation defaults, not a recommendation for a live account.

## Asset classes

- Stocks: supported by the paper engine.
- Crypto: supported by the generic risk engine when a valid snapshot is supplied.
- Futures: analysis is allowed only when the snapshot supplies explicit contract specifications. Live futures execution is not implemented.
- Options: not enabled in V1 because contract Greeks, multiplier, liquidity, and assignment risk need a dedicated adapter.

## Promotion criteria

Do not add live execution merely because paper P&L is positive. A later live proposal should require, at minimum:

- a defined sample size and testing period,
- positive expectancy after realistic slippage/fees,
- acceptable drawdown,
- no safety-policy violations,
- no invented data,
- stable deterministic risk controls,
- explicit broker-specific sandbox testing,
- explicit user approval immediately before real-money activation.

## Scheduled workflow target

A practical schedule is:

- Pre-market: build snapshot and run Hermes market-regime analysis.
- During market hours: hourly paper-only refresh, never faster than platform limits.
- Post-close: reconcile paper trades and generate a journal/audit.
- Weekly: Hermes reviews expectancy, drawdown, win/loss distribution, rule violations, and whether the strategy should be stopped or redesigned.
