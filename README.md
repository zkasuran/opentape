# OpenTape

The consolidated tape and best-execution advisor for tokenized US stocks on BNB Chain.

The same stock is minted by several issuers (xStocks, Ondo, bStocks) across separate pools and order
books, so its price and liquidity are fragmented. OpenTape maps every issuer token of one underlying
into a single canonical symbol. It reads live quotes across venues, prices each against the underlying
reference, then returns the best execution route for a given size plus a cross-issuer premium and
arbitrage signal. Arbitrage is surfaced as a signal because redemption across issuers is gated, so the
product is explicit about what a permissionless trader can and cannot capture.

## Packages

- `packages/sdk` (`@opentape/sdk`): core library. Venue adapters, fair value, normalization, ranking, arb signal.
- `apps/api` (`@opentape/api`): Fastify service over the SDK.
- `apps/web` (`@opentape/web`): the product web app.
- `packages/agent-skill` (`@opentape/agent-skill`): a wallet or agent skill that calls the engine.
- `contracts`: a thin execute-best-route contract for BSC mainnet.

## Develop

```
pnpm install
pnpm -r typecheck
pnpm -r test
```

## Licence

Source-Available No-Derivatives 1.0 (SPDX `LicenseRef-zkasuran-SAND-1.0`). See `LICENSE`.
