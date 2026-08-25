# Live Boundary

The Coinbase crypto-futures subsystem in this branch stops at public market data and paper execution. There is intentionally no function that accepts Coinbase credentials, no authenticated user-order stream, and no order submission path.

A future live adapter must be a separate reviewed change. It must not be enabled by merely editing the paper policy file.
