---
name: openTapeBestExecution
description: >-
  Use this when the user wants to buy a tokenized US stock at the best price
  across issuers on BNB Chain (xStocks, bStocks, Ondo), find the cheapest
  executable venue for a given USD size, see the cross-issuer premium versus the
  underlying reference or read the cross-issuer arbitrage signal. Read-only
  advisor, risk-gated by notional cap, max slippage and KYC-gated routes.
license: LicenseRef-zkasuran-SAND-1.0
metadata:
  author: zkasuran
  version: 0.1.0
  category: wallet-skill
  network: bsc-mainnet
  readOnly: true
requires:
  - kind: package
    manager: npm
    package: "@opentape/agent-skill"
    bins: [opentape-skill]
    label: OpenTape best-execution skill CLI
---

# openTapeBestExecution

A wallet skill for the Binance Agentic Wallet / BNB Agent Studio surface. It finds
the best price to buy a tokenized US stock across issuers on BNB Chain and reports
the cross-issuer arbitrage as a signal, risk-gated. It is read-only: it never
custodies funds or places an order. It hands the caller a route and a decision. The
wallet's own trading skill (for example `binance-agentic-wallet market-order`)
executes it after the user confirms.

## Integration point (verified 2026-09-24)

BNB Chain and the Binance Skills Hub publish skills in the portable Agent Skills
format: a named folder with this `SKILL.md` (YAML frontmatter plus a command-routing
body) and an optional `references/` directory, where the skill drives a CLI it calls
with `--json`. This skill follows that shape and routes to the `opentape-skill` CLI.
The same logic is available as a typed descriptor (`openTapeBestExecutionSkill`,
exporting `name`, `inputSchema` and `invoke`) for runtimes that embed a skill in
process rather than shelling out.

Sources:
- https://github.com/binance/binance-skills-hub (the `binance-agentic-wallet` SKILL.md)
- https://github.com/bnb-chain/bnbchain-skills
- https://developers.binance.com/en/docs/products/wallet-skills/supported-skills
- https://docs.bnbchain.org/developer-kit/bnbchain-studio/

## Inputs

| field | type | required | default | meaning |
| --- | --- | --- | --- | --- |
| `symbol` | string | yes | | underlying US stock ticker, for example AAPL |
| `sizeUsd` | number | yes | | order size in USD of economic exposure |
| `maxSlippageBps` | number | no | 100 | reject when best-route price impact exceeds this |
| `maxNotionalUsd` | number | no | 25000 | reject when size exceeds this notional |

## Command routing

| user intent | command |
| --- | --- |
| best price / cheapest venue to buy SYMBOL for a size | `opentape-skill SYMBOL --size <usd> --json` |
| tighten the risk limits | add `--max-slippage-bps <n>` and `--max-notional-usd <n>` |
| read the machine manifest | `opentape-skill --manifest` |

Always append `--json` when routing from an agent and parse the result. Confirm the
`decision` field before proposing any trade: `blocked` means a risk gate failed and
the `reasons` array says which one.

## Output

A structured recommendation: the best venue and issuer, price versus the underlying
reference, premium in bps, savings versus the worst route, the cross-issuer arb
signal (`grossBps`, `netBps`, `capturable`) and an `allowed` or `blocked` decision
with reasons. See `Recommendation` in `src/recommend.ts`.

## Risk gates

The order is blocked when any gate fails. Every failed gate is listed in
`reasons`:
- notional: `sizeUsd` exceeds `maxNotionalUsd`.
- slippage: the best route price impact exceeds `maxSlippageBps`.
- kyc: the only route is KYC-gated or non-executable, so a permissionless wallet
  cannot fill it.

## Honesty

Cross-issuer redemption for tokenized stocks is gated by KYC or institutional
access, so arbitrage is reported as a signal, never a captured trade. When a spread
cannot be closed by a permissionless wallet, `capturable` is false and a note says
why. Figures are estimates from live venue reads and can move before you act. This
is not financial advice.
