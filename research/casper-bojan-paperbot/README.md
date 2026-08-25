# Casper–Bojan Crypto Paper Bot

Deterministic crypto day-trading research bot using publicly documented Jayson Casper-style concepts plus the Bojan-style checklist previously used in this workflow. The Bojan attribution is **not represented as an official public ruleset** unless separately verified.

Core gates:
- 15m + 1h trend agreement
- liquidity sweep / swing-failure pattern
- VWAP reclaim/rejection
- market-structure shift
- minimum 5 confluences
- minimum 2.3R target
- 0.25% account risk per trade by default
- 1% daily loss cutoff
- max 3 trades/day
- no averaging down; no widening stops
- live order execution hard-disabled

Validation order: historical backtest with fees/slippage -> lookahead/recursive-bias checks -> walk-forward/out-of-sample -> real-time dry run -> compare live-sim to backtest.

This is not a profit guarantee. A strategy is only considered viable if the data supports it after realistic costs and out-of-sample testing.
