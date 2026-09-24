// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0

// Published, machine-readable descriptor for the skill. This is the single source
// of truth for the skill's name, trigger description and declared inputs. The
// SKILL.md at the package root is the human-facing portable-format rendering of
// the same facts (BNB Chain / Binance Skills Hub convention, see SKILL.md header).
//
// Verified integration point (2026-09-24):
//   - Binance Skills Hub and BNB Chain skills use the portable "Agent Skills"
//     format: a named folder with a SKILL.md carrying YAML frontmatter
//     (name, description trigger list, metadata: author/version/requiredCliVersion)
//     plus an optional references/ directory. The skill drives a CLI that it
//     invokes with a --json flag.
//     Sources: https://github.com/binance/binance-skills-hub (agentic-wallet SKILL.md),
//     https://github.com/bnb-chain/bnbchain-skills,
//     https://developers.binance.com/en/docs/products/wallet-skills/supported-skills
//   - So this skill ships as: this typed descriptor (embed it in an agent runtime),
//     the SKILL.md portable manifest and the `opentape-skill` CLI it routes to.

export interface ManifestInputProperty {
  type: "string" | "number";
  description: string;
  exclusiveMinimum?: number;
  default?: number;
}

export interface SkillManifest {
  name: string;
  version: string;
  description: string;
  license: string;
  metadata: {
    author: string;
    category: string;
    network: string;
    readOnly: boolean;
    issuers: string[];
  };
  input: {
    type: "object";
    required: string[];
    properties: Record<string, ManifestInputProperty>;
  };
  cli: { command: string; jsonFlag: string; example: string };
  output: string;
}

export const skillManifest: SkillManifest = {
  name: "openTapeBestExecution",
  version: "0.1.0",
  description:
    "Use this when the user wants to buy a tokenized US stock at the best price across issuers on BNB Chain (xStocks, bStocks, Ondo), find the cheapest executable venue for a given USD size, see the cross-issuer premium versus the underlying reference or read the cross-issuer arbitrage signal. Read-only advisor, risk-gated by notional cap, max slippage and KYC-gated routes.",
  license: "LicenseRef-zkasuran-SAND-1.0",
  metadata: {
    author: "zkasuran",
    category: "wallet-skill",
    network: "bsc-mainnet",
    readOnly: true,
    issuers: ["xstocks", "bstocks", "ondo"],
  },
  input: {
    type: "object",
    required: ["symbol", "sizeUsd"],
    properties: {
      symbol: {
        type: "string",
        description: "Underlying US stock ticker, for example AAPL.",
      },
      sizeUsd: {
        type: "number",
        exclusiveMinimum: 0,
        description: "Order size in USD of economic exposure.",
      },
      maxSlippageBps: {
        type: "number",
        exclusiveMinimum: 0,
        default: 100,
        description:
          "Reject the order when the best route price impact exceeds this many basis points.",
      },
      maxNotionalUsd: {
        type: "number",
        exclusiveMinimum: 0,
        default: 25000,
        description: "Reject the order when its size exceeds this notional in USD.",
      },
    },
  },
  cli: {
    command: "opentape-skill",
    jsonFlag: "--json",
    example: "opentape-skill AAPL --size 5000 --json",
  },
  output:
    "A structured recommendation with the best venue and issuer, price versus the underlying reference, savings versus the worst route, the cross-issuer arb signal and an allowed or blocked risk decision.",
};
