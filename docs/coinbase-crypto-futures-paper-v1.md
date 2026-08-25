# Coinbase US Crypto Futures — Paper Automation v1

## Scope

This module is a paper-only research system for Coinbase US crypto futures. It is intentionally incapable of live order execution.

## Current product scope

- Venue: Coinbase US derivatives / CFM-compatible FUTURE products
- Underlyings: BTC and ETH only
- Preferred contracts: perpetual-style futures
- Market data: Coinbase public Advanced Trade product, candle, and ticker endpoints only
- Cycle interval after installation: 60 seconds
- Signal timeframe: 5-minute candles

## Strategy v1

- 12/36 EMA trend filter
- 20-bar breakout confirmation
- 14-bar ATR stop
- 1.5 ATR initial stop distance
- 2.0 reward:risk target
- relative-volume filter
- spread ceiling
- both long and short paper positions

## Hard controls

- `mode=paper_only`
- `live_execution_enabled=false`
- no Coinbase API key is read
- trade-permission credentials are explicitly forbidden
- no authenticated user-order WebSocket
- no order endpoint
- BTC/ETH only
- 0.25% equity risk budget per trade
- 1.0% daily paper-loss lockout
- 0.5% maximum aggregate open risk
- maximum two futures positions
- maximum six new futures positions per UTC day
- maximum 2.0x simulated notional leverage, additionally capped by product-reported maximum leverage
- no averaging down
- conservative stop-first resolution if stop and target occur in the same five-minute candle

## Coinbase facts used by the implementation

Coinbase Advanced Trade exposes `FUTURE` products and identifies contract expiry type, contract size, trading/session metadata, funding information, and product maximum leverage. US crypto futures can trade 24/7 apart from defined maintenance windows. The runtime relies on Coinbase product/session metadata rather than assuming every futures product is continuously tradable.

## Deliberately not implemented

- live Coinbase order creation
- API keys with trade permission
- automatic cash transfers/sweeps
- changing intraday margin settings
- international `INTX` perpetuals
- SOL/XRP or other futures underlyings
- leverage above 2x

Any live-execution adapter must be reviewed as a separate future project and must not be added to this paper branch by weakening the current safety assertions.
