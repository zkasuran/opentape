// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import { createPublicClient, http, type PublicClient } from "viem";
import { bsc } from "viem/chains";
import type { CanonicalSymbol, FairValue } from "../types";
import { DEFAULT_BSC_RPC, getFeedAddress, knownSymbols } from "./feeds";

// getFairValue returns the underlying US-equity reference price (or BNB/USD) read from a Chainlink
// Data Feed on BNB Smart Chain. The read is permissionless and keyless: it needs only a BSC RPC, no
// API key and no signer. Chainlink push feeds stay fresh on BSC (0.5% deviation or 24h heartbeat for
// equities), unlike a pull oracle that no one refreshes. Unknown symbols throw before any network call.
// FairValue.ts is unix milliseconds (Chainlink updatedAt seconds, times 1000).
export const CHAINLINK_ONCHAIN_SOURCE = "chainlink-onchain-bsc";

// Minimal AggregatorV3Interface: only the two reads we need.
const aggregatorV3Abi = [
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  {
    name: "latestRoundData",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
] as const;

export interface FairValueOptions {
  // Override the BSC RPC used for the read.
  rpcUrl?: string;
  // Inject a viem public client (for tests, or to reuse one client across reads).
  client?: PublicClient;
  // Override the Chainlink feed address (defaults to the mapped feed for the symbol).
  feedAddress?: `0x${string}`;
  // If set, reject when the feed's updatedAt is older than this many seconds.
  maxAgeSec?: number;
}

export async function getFairValue(
  symbol: CanonicalSymbol,
  opts: FairValueOptions = {},
): Promise<FairValue> {
  const address = opts.feedAddress ?? getFeedAddress(symbol);
  if (!address) {
    throw new Error(`getFairValue: unknown symbol "${symbol}". Known symbols: ${knownSymbols().join(", ")}`);
  }

  const client =
    opts.client ??
    createPublicClient({ chain: bsc, transport: http(opts.rpcUrl ?? DEFAULT_BSC_RPC) });

  const [decimals, round] = await Promise.all([
    client.readContract({ address, abi: aggregatorV3Abi, functionName: "decimals" }) as Promise<number>,
    client.readContract({ address, abi: aggregatorV3Abi, functionName: "latestRoundData" }) as Promise<
      readonly [bigint, bigint, bigint, bigint, bigint]
    >,
  ]);

  return aggregatorToFairValue(symbol, round[1], Number(decimals), round[3], opts.maxAgeSec);
}

// Pure conversion from a Chainlink round to a FairValue. No I/O, so it is deterministic and
// unit-testable against a recorded round.
export function aggregatorToFairValue(
  symbol: CanonicalSymbol,
  answer: bigint,
  decimals: number,
  updatedAt: bigint,
  maxAgeSec?: number,
  source: string = CHAINLINK_ONCHAIN_SOURCE,
): FairValue {
  if (answer <= 0n) {
    throw new Error(`getFairValue: non-positive Chainlink answer for "${symbol}" (${answer})`);
  }
  const usd = Number(answer) / 10 ** decimals;
  const ts = Number(updatedAt) * 1000; // seconds -> milliseconds
  if (maxAgeSec !== undefined) {
    const ageSec = (Date.now() - ts) / 1000;
    if (ageSec > maxAgeSec) {
      throw new Error(
        `getFairValue: reference for "${symbol}" is ${Math.round(ageSec)}s old, older than maxAgeSec=${maxAgeSec}`,
      );
    }
  }
  // Chainlink does not publish a per-round confidence interval, so confBps is 0.
  return { symbol, usd, confBps: 0, ts, source };
}
