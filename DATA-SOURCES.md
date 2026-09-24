# Data sources

Every external data source, what we read, and the clause that permits it. Each adapter agent fills the
exact quotable granting sentence before that adapter ships. A source with no quotable clause does not ship.

| Source | What we read | Licence / terms | Granting clause |
| --- | --- | --- | --- |
| Pyth Network | US equity + BNB/USD reference price (on-chain BSC permissionless, or Hermes) | verify: on-chain reads permissionless; Hermes key requirement to confirm | TODO (pyth adapter) |
| Binance public API | bStock / tokenized pair order-book depth (`/api/v3/depth`) | verify: Binance market-data terms, redistribution limits | TODO (binance adapter) |
| PancakeSwap | v3 and v2 pool reserves and quotes on BSC | on-chain public reads | TODO (pancakeswap adapter) |
| Ondo | mint / redeem NAV quote on BNB | verify: Ondo API terms, execute path is KYC-gated | TODO (ondo adapter) |
| Kraken public API | xStocks CEX order book (cross-venue reference) | verify: Kraken market-data terms | TODO |
| Jupiter API | Solana cross-venue reference quotes | verify: Jupiter API terms | TODO |
| Chainlink | equity or commodity feeds (fallback reference) | verify: BSC equity coverage | TODO |

Note: several centralized-exchange market-data terms restrict redistribution even when the endpoint is
keyless. Confirm the clause before any derived data is published.
