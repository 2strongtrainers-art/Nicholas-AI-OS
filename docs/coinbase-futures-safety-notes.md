# Coinbase Futures Safety Notes

The paper system uses public Coinbase market data and synthetic fills. It does not authenticate to the user's Coinbase account and therefore cannot place, cancel, or modify orders or change margin settings.

Before any future live adapter is even considered, verify separately:

1. Coinbase US futures account approval and product eligibility.
2. Current contract specifications and position limits returned for the account.
3. Margin mode and current margin window.
4. API key permission boundaries.
5. Explicit live-trading risk budget and kill-switch behavior.
6. Forward-test evidence from the paper system across a meaningful sample.

Paper results are not evidence that a live strategy will be profitable because fees, slippage, latency, funding, liquidity, order priority, and liquidation mechanics differ from synthetic fills.
