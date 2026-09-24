// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import type { CanonicalSymbol } from "../types";

// Chainlink Data Feed proxies on BNB Smart Chain (BSC mainnet, chain id 56). Live push feeds read via
// AggregatorV3Interface.latestRoundData. Equity feeds update on a 0.5% price move or a 24h heartbeat;
// BNB/USD on ~0.1% / 27s. Verified live on-chain 2026-09-24.
// Registry: https://reference-data-directory.vercel.app/feeds-bsc-mainnet.json
// Docs: https://docs.chain.link/data-feeds/price-feeds/addresses?network=bnb-chain
export const CHAINLINK_FEEDS: Record<string, `0x${string}`> = {
  AAPL: "0xb7Ed5bE7977d61E83534230f3256C021e0fae0B6",
  TSLA: "0xEEA2ae9c074E87596A85ABE698B2Afebc9B57893",
  NVDA: "0xea5c2Cbb5cD57daC24E26180b19a929F3E9699B8",
  SPY: "0xb24D1DeE5F9a3f761D286B56d2bC44CE1D02DF7e",
  GOOGL: "0xeDA73F8acb669274B15A977Cb0cdA57a84F18c2a",
  META: "0xfc76E9445952A3C31369dFd26edfdfb9713DF5Bb",
  BNB: "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE",
};

// Public BNB dataseed RPC (keyless). Bulk sweeps use dataseed, not PublicNode.
export const DEFAULT_BSC_RPC = "https://bsc-dataseed.bnbchain.org";

export function getFeedAddress(symbol: CanonicalSymbol): `0x${string}` | undefined {
  return CHAINLINK_FEEDS[symbol.toUpperCase()];
}

export function knownSymbols(): string[] {
  return Object.keys(CHAINLINK_FEEDS);
}
