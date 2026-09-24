// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import {
  createWalletClient,
  custom,
  parseUnits,
  type Address,
  type EIP1193Provider,
  type Hex,
} from "viem";
import { bsc } from "viem/chains";

export const BSC_CHAIN_ID = 56;

// Executor address is injected at deploy time. Empty until the OpenTape executor
// contract is live on BNB Chain, so every execute path guards on this.
export const EXECUTOR_ADDRESS = (process.env.NEXT_PUBLIC_EXECUTOR_ADDRESS ?? "").trim();

// Canonical BSC-USD (Binance-Peg USD) stable used as the input token, overridable.
// Verify against the deployed executor's expected input token at integration.
export const STABLE_ADDRESS = (
  process.env.NEXT_PUBLIC_STABLE_ADDRESS ?? "0x55d398326f99059fF775485246999027B3197955"
).trim();

export function isExecutorConfigured(): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(EXECUTOR_ADDRESS);
}

export function bscScanTx(hash: string): string {
  return `https://bscscan.com/tx/${hash}`;
}

// Provisional interface for the thin "execute best route" contract owned by the
// contract lane: swap the input stable into the chosen tokenized-stock token via
// the PancakeSwap router, with slippage protection. Confirmed against the
// deployed ABI in integration before any mainnet call.
export const EXECUTOR_ABI = [
  {
    type: "function",
    name: "executeBestRoute",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "minAmountOut", type: "uint256" },
      { name: "recipient", type: "address" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

export interface ExecuteRouteParams {
  provider: EIP1193Provider;
  account: Address;
  tokenOut: Address;
  amountInUsd: number;
  // expected shares out and the fair price, used to build a slippage floor
  sharesOut: number;
  tokenDecimals?: number;
  slippageBps?: number;
}

// Builds and sends the executeBestRoute transaction. Assumes the wallet is
// already on BSC (ensure that in the UI before calling).
export async function executeBestRoute(params: ExecuteRouteParams): Promise<Hex> {
  if (!isExecutorConfigured()) {
    throw new Error("Executor contract is not configured yet.");
  }
  const decimals = params.tokenDecimals ?? 18;
  const slippageBps = params.slippageBps ?? 100;
  const amountIn = parseUnits(params.amountInUsd.toFixed(2), 18); // input stable, 18 decimals on BSC
  const minShares = params.sharesOut * (1 - slippageBps / 10000);
  const minAmountOut = parseUnits(minShares.toFixed(Math.min(decimals, 8)), decimals);

  const walletClient = createWalletClient({
    account: params.account,
    chain: bsc,
    transport: custom(params.provider),
  });

  return walletClient.writeContract({
    address: EXECUTOR_ADDRESS as Address,
    abi: EXECUTOR_ABI,
    functionName: "executeBestRoute",
    args: [params.tokenOut, amountIn, minAmountOut, params.account],
  });
}
