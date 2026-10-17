# Kalshi public data: verified REST foundation

`trading/kalshi_public_data.py` retrieves public exchange observations for research.
It uses Python's standard library, needs no API key, and cannot submit orders or
invoke a model. It does not install or start a persistent service on Nick's Mac.

## Run

From the repository root, with Python 3.12 or newer:

```sh
python -m trading.kalshi_public_data
python -m trading.kalshi_public_data --series KXBTC15M --depth 5
python -m trading.kalshi_public_data --ticker ACTUAL_MARKET_TICKER
python -m trading.kalshi_public_data --hermes-task
```

The default discovers the nearest-closing active BTC 15-minute contract, reads
its book, then rechecks its identity, lifecycle and rules. Success prints JSON
and exits 0. Failure prints an `ok: false` envelope and exits 1. Consumers must
check the exit status and envelope, never fall back silently to a previous file.
The `--hermes-task` option instead prints a bounded review task compatible with
the existing Switchboard's 12,000-character task limit; it **does not call Hermes**.

## Audited behavior

- Only HTTPS GET requests to an allowlist of public Kalshi market paths.
- No account/portfolio endpoints, credentials, environment-variable credential
  reads, model requests, scheduling, order placement or changes to existing trading policy.
- Timeouts, response-size limits, bounded discovery pagination and no redirects.
- Current `orderbook_fp` schema only. Dollar prices and fractional contract sizes
  use `Decimal`; legacy integer-cent books and invalid precision are rejected.
- Both sides contain bids. YES ask = $1 minus best NO bid; its available size is
  that NO bid's size. NO asks are derived symmetrically. Level order is normalized
  instead of assuming the server returns a particular ordering.
- Empty sides stay unknown. Crossed books, duplicate levels, non-positive sizes,
  wrong identities, missing rules, non-binary or non-$1 contracts fail validation.
- Source URLs, request/receipt times, HTTP Date and cache Age are recorded. Both
  book and final market provenance are mandatory. Closed or paused markets,
  inconsistent clocks and stale observations are rejected.
- `validate_snapshot(snapshot)` rechecks freshness and close time when consumed;
  default transport-age limit is 10 seconds. `market.updated_time` is never used
  as a quote timestamp. HTTP freshness cannot establish an exchange tick timestamp.
- Primary/secondary rules are preserved and hashed. Structured strike fields are
  retained when present; numeric strikes are parsed without binary-float conversion.
- The snapshot explicitly identifies missing fees, settlement-index values and
  win probabilities. No technical score is represented as a calibrated probability.

This module has separate data semantics from the Coinbase futures paper engine.
Its quotes are not inputs to futures position sizing, and it does not alter the
existing Hermes ACCEPT/REDUCE/REJECT gate.

## Verification and remaining work

Offline checks:

```sh
python -m unittest discover -s tests -p 'test_kalshi_public_data.py' -v
python -m unittest discover -s tests -p 'test_coinbase*.py' -v
python -m unittest discover -s tests -p 'test_daytrade_engine.py' -v
python -m unittest discover -s tests -p 'test_paper_trading_desk.py' -v
```

On October 17, 2026, the collector successfully retrieved the active `KXBTC15M`
market, its fixed-point book and the contract's actual CF Benchmarks settlement
rules from the production public API. This verifies snapshot collection, not a
continuous stream, current Hermes reachability, trade execution or profitability.

Next work, in order:

1. Verify the existing authenticated Hermes bridge with a terminal job result.
   Its HTTP service and Mac worker must both be reachable. An old status file or
   an `@agenthermes` mention is not evidence of a live connection. Use an approved
   provider and existing cost controls; this module does not authorize model spend.
2. Add an authenticated streaming collector for order-book deltas and, where
   available, CF Benchmarks `BRTI`. Implement sequence-gap detection, reconnect,
   complete book resynchronization, source timestamps and stale-data rejection.
   Keep collection independent of slow Hermes job execution.
3. Evaluate contract-specific fees, depth/slippage and settlement behavior in a
   dedicated Kalshi paper-analysis layer before estimating fee-adjusted edge.
   Recheck quotes at decision time; a Hermes review can outlive a REST snapshot.

## Official references

- [Public market-data quick start](https://docs.kalshi.com/getting_started/quick_start_market_data)
- [Market orderbook](https://docs.kalshi.com/api-reference/market/get-market-orderbook)
- [Market metadata and rules](https://docs.kalshi.com/api-reference/market/get-market)
- [Fixed-point representation](https://docs.kalshi.com/getting_started/fixed_point_migration)
- [Authenticated WebSocket setup](https://docs.kalshi.com/getting_started/quick_start_websockets)
- [CF Benchmarks feed and averaging semantics](https://docs.kalshi.com/websockets/cfbenchmarks-value)
