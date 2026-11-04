# Recovered strategy evidence and provenance

This file separates evidence recovered from Nicholas Kaplan's earlier conversations and screen uploads from implementation assumptions. It prevents a past example trade from silently becoming a universal rule.

## Encoded hard rules

- Do not force a trade.
- Require at least five strong confluences.
- Minimum reward-to-risk is 2.3R.
- Every setup must name entry, invalidation/stop, targets, and no-trade conditions.
- Setup classification is high probability, moderate probability, or avoid.
- Inputs discussed repeatedly: market structure, trend, liquidity zones, support/resistance, heatmap levels, RSI, MACD, Bollinger Bands, Fibonacci retracements, fair-value gaps, swing-failure patterns, volume, VWAP, EMA reclaim, and confluence.
- Practical chart stack recovered from earlier analysis: 5m execution with 15m and 1h confirmation; 30m/4h and 12h/24h heatmaps were used for discretionary context.
- Risk controls selected for this research build: 0.25% equity risk per trade, 1% realized daily loss cutoff, three trades per UTC day, 0.5% maximum simultaneous open risk, no averaging down, and no stop widening.

## Recovered examples, not universal rules

- March 29, 2025 BTC UpDown example: long 83,800, target 85,800, stop 83,640; POC reclaim around 84,200; an alternative re-entry at 83,500-83,550 with stop below 83,350.
- July 25, 2025 BTC example: short zone 117,900-118,300, stop above 118,800, targets 115,500 and 114,750; alternative long zone 114,800-115,300, stop 114,200, targets 117,200-118,000.
- `annotated_trade.png`: OCR recovered ENTRY 47,862, TP1 46,920, TP2 47,200, time 11:09. The symbol, exchange, timeframe, stop, and sizing were not recoverable.
- `annotated_trade2.png`: OCR recovered a Bitcoin interface showing 68,119.49, high 68,518.10, low 65,924.82, depth, volume, indicators, and buy/sell controls. No deterministic entry or risk rule was recoverable.

## Deliberately not encoded

- The earlier phrase “15m 9:30 range” lacks a verified timezone, market session, and exact range construction.
- Coinglass heatmap interpretation remains discretionary because no stable, authenticated historical feed or exact numeric trigger was recovered.
- Fibonacci and fair-value-gap inputs are preserved as research candidates but are not hard gates until their definitions and lookbacks are fixed before another out-of-sample test.
- “Bojan-style” is historical shorthand from Nicholas's workflow, not a claim that this is Bojan's official published ruleset.
- No screenshot-derived price level is reused as a permanent strategy parameter.

## Promotion boundary

Conversation memory and screenshots can propose features; they cannot override failed out-of-sample results. Live execution remains disabled until a frozen version passes untouched data, harsh cost assumptions, and an extended real-time paper run.
