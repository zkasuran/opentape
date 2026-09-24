# Data sources

Every external data source OpenTape reads, what we take, and the terms that permit it. Prices are read,
never rebroadcast raw; what we publish is a derived premium/best-execution figure.

| Source | What we read | How | Terms posture |
| --- | --- | --- | --- |
| Chainlink Data Feeds (BSC) | US equity + BNB/USD reference price (the "true" underlying) | on-chain `latestRoundData()` on the feed proxies, keyless | On-chain data is public and permissionless to read. Publishing a derived premium from it carries no redistribution restriction. Feeds verified live on BSC 2026-09-24. |
| PancakeSwap (BSC) | v3 and v2 pool reserves and quotes for tokenized-stock/USDT pairs | on-chain reads via a public BNB dataseed RPC, keyless | On-chain public reads. No key, no redistribution issue. |
| Binance public API | bStock (tokenized) pair order-book depth (`/api/v3/depth`, `/api/v3/ticker`) | public REST, keyless | Publicly reachable. Binance market-data terms restrict wholesale redistribution, so we publish a derived premium percentage with attribution, not the raw feed. |
| Ondo Global Markets | mint/redeem NAV reference on BNB (the arb convergence anchor) | issuer price API when a key is present, else a Chainlink-derived NAV approximation, clearly labeled | Public price API is key-gated; the mint/redeem execute path is KYC/institutional-gated. We use it as a reference only and mark it non-executable and kycGated. |

Notes:
- We dropped Pyth: its on-chain BSC feeds are stale (a pull oracle no one refreshes) and the fresh path
  (Hermes / Pyth Pro) requires a paid key. Chainlink push feeds on BSC are fresh and keyless.
- During US market hours the Chainlink equity feeds refresh on a 0.5% move; off-hours they hold the last
  close on a 24h heartbeat, which is the correct reference when the underlying is not trading. For a 24/7
  comparison we also read the Binance bStock price and label which premium is which.
- Yahoo Finance and other free stock APIs were considered and rejected for the published product on
  licensing grounds (personal / non-commercial only). They are not used.
