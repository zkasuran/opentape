// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import { createPublicClient, formatUnits, http, type Address, type PublicClient } from "viem";
import { bsc } from "viem/chains";
import type { CanonicalSymbol, Quote, VenueAdapter } from "../types";
import {
  PANCAKE,
  STABLE_QUOTES,
  type StableToken,
  type TokenInfo,
  tokensForSymbol,
  V2_FEE,
  V3_FEE_TIERS,
} from "./tokens";

// PancakeSwap venue adapter for tokenized-stock tokens on BNB Smart Chain.
//
// quotes(symbol, sizeUsd) reads live PancakeSwap v3 pools (QuoterV2 for the executable
// amount-out plus slot0 for the mid price) and v2 pairs (constant-product math over the
// on-chain reserves) for each xStock/USD-stable pool it finds, and returns one Quote per
// pool. All reads go over a BNB dataseed RPC. Every external address is verified in
// ./tokens.ts; nothing is invented.
//
// Cost model, so the fields do not double-count:
//   pxPerExposureUsd = all-in executed USD paid per whole token (LP fee + curve slippage
//                      already included), gas excluded. xStocks are 1:1 share-backed, so
//                      one token is one share of exposure; core normalizes this against
//                      Chainlink fair value and the issuer multiplier.
//   feeUsd           = the LP fee portion of that all-in cost (sizeUsd * fee tier).
//   priceImpactBps   = curve slippage over the pool mid price, fee EXCLUDED, in bps.
//   gasUsd           = swap gas estimate, additive on top of pxPerExposureUsd.

const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";

export interface PancakeConfig {
  rpcUrl?: string;
  client?: PublicClient;
  stableQuotes?: StableToken[];
  // BNB/USD used only for the gas estimate. Rough fallback constant; the engine/core
  // should inject a live Chainlink BNB/USD. Not an asserted market price.
  bnbUsd?: number;
  // Fixed gas price (wei) override for deterministic runs; otherwise read from chain.
  gasPriceWei?: bigint;
  gasUnitsV3?: number;
  gasUnitsV2?: number;
  // Pools whose curve slippage for the requested size exceeds this are dropped as not
  // executable at that size. Default 9000 bps (90%).
  maxPriceImpactBps?: number;
}

const DEFAULT_RPC = "https://bsc-dataseed.bnbchain.org";
const DEFAULT_BNB_USD = 900; // fallback-only, see note above
const DEFAULT_GAS_V3 = 160_000;
const DEFAULT_GAS_V2 = 120_000;

// --- Minimal ABIs (only the reads this adapter needs) ---------------------------------
const v3FactoryAbi = [
  {
    name: "getPool",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "address" }, { type: "address" }, { type: "uint24" }],
    outputs: [{ type: "address" }],
  },
] as const;

const v2FactoryAbi = [
  {
    name: "getPair",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "address" }, { type: "address" }],
    outputs: [{ type: "address" }],
  },
] as const;

const v3PoolAbi = [
  {
    name: "slot0",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "observationIndex", type: "uint16" },
      { name: "observationCardinality", type: "uint16" },
      { name: "observationCardinalityNext", type: "uint16" },
      { name: "feeProtocol", type: "uint32" },
      { name: "unlocked", type: "bool" },
    ],
  },
  { name: "liquidity", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint128" }] },
  { name: "token0", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

const v2PairAbi = [
  {
    name: "getReserves",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint112" }, { type: "uint112" }, { type: "uint32" }],
  },
  { name: "token0", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

const quoterV2Abi = [
  {
    name: "quoteExactInputSingle",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const;
// APPEND-MATH

// --- Pure math (deterministic, no network; unit-tested against fixture reserves) -------

// Convert a USD amount to a raw token amount at a given decimals, keeping 6 decimals of
// USD precision. Stables here are $1-pegged, so USD == token units.
export function usdToRaw(usd: number, decimals: number): bigint {
  const micros = BigInt(Math.round(usd * 1e6));
  if (decimals >= 6) return micros * 10n ** BigInt(decimals - 6);
  return micros / 10n ** BigInt(6 - decimals);
}

// PancakeSwap / Uniswap v2 constant-product amount-out with fee. feeBps is basis points
// (25 = 0.25%). Exact BigInt arithmetic, matching the on-chain router.
export function getAmountOutV2(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feeBps: number,
): bigint {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  const denom = 10_000n;
  const amountInWithFee = amountIn * (denom - BigInt(feeBps));
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * denom + amountInWithFee;
  return numerator / denominator;
}

// Curve slippage over the pool mid price, fee excluded, in bps. Works for v2 and v3: the
// LP fee is stripped from the executed price before comparing to spot, so this number and
// feeUsd do not overlap.
export function priceImpactBpsFromExec(
  pxPerExposureUsd: number,
  spotUsdPerToken: number,
  feeFrac: number,
): number {
  if (!(spotUsdPerToken > 0) || !Number.isFinite(pxPerExposureUsd) || pxPerExposureUsd <= 0) return 0;
  const execNoFee = pxPerExposureUsd * (1 - feeFrac);
  const impact = execNoFee / spotUsdPerToken - 1;
  return Math.max(0, impact) * 10_000;
}

// Mid price (USD per whole token) from a v3 slot0 sqrtPriceX96. token0IsStable says which
// side of the pool is the USD stable, so the ratio is oriented to USD-per-token.
export function spotUsdPerTokenFromSqrtPriceX96(
  sqrtPriceX96: bigint,
  token0IsStable: boolean,
  stableDecimals: number,
  tokenDecimals: number,
): number {
  const q96 = 2 ** 96;
  const ratio = (Number(sqrtPriceX96) / q96) ** 2; // token1 per token0, raw units
  if (token0IsStable) {
    // token1 = the stock token; ratio = token per stable(raw). Adjust decimals, invert.
    const tokenPerStableHuman = ratio * 10 ** (stableDecimals - tokenDecimals);
    return tokenPerStableHuman > 0 ? 1 / tokenPerStableHuman : 0;
  }
  // token0 = the stock token, token1 = stable; ratio = stable per token (raw) = USD/token.
  return ratio * 10 ** (tokenDecimals - stableDecimals);
}

export interface DexMath {
  amountOutToken: number; // human tokens received
  pxPerExposureUsd: number; // all-in USD per token (fee + impact included)
  priceImpactBps: number; // curve slippage, fee excluded
  feeUsd: number; // LP fee portion
  spotUsdPerToken: number; // pool mid price
}

// Full v2 quote from raw reserves. `in` is the USD stable side, `out` is the stock token.
export function quoteConstantProduct(params: {
  sizeUsd: number;
  reserveStableRaw: bigint;
  reserveTokenRaw: bigint;
  stableDecimals: number;
  tokenDecimals: number;
  feeUnits: number; // 1e6 units, e.g. 2500 = 0.25%
}): DexMath {
  const { sizeUsd, reserveStableRaw, reserveTokenRaw, stableDecimals, tokenDecimals, feeUnits } = params;
  const feeBps = Math.round(feeUnits / 100);
  const feeFrac = feeUnits / 1e6;
  const amountInRaw = usdToRaw(sizeUsd, stableDecimals);
  const amountOutRaw = getAmountOutV2(amountInRaw, reserveStableRaw, reserveTokenRaw, feeBps);
  const amountOutToken = Number(formatUnits(amountOutRaw, tokenDecimals));
  const reserveStableHuman = Number(formatUnits(reserveStableRaw, stableDecimals));
  const reserveTokenHuman = Number(formatUnits(reserveTokenRaw, tokenDecimals));
  const spotUsdPerToken = reserveTokenHuman > 0 ? reserveStableHuman / reserveTokenHuman : 0;
  const pxPerExposureUsd = amountOutToken > 0 ? sizeUsd / amountOutToken : Number.POSITIVE_INFINITY;
  const feeUsd = sizeUsd * feeFrac;
  const priceImpactBps = priceImpactBpsFromExec(pxPerExposureUsd, spotUsdPerToken, feeFrac);
  return { amountOutToken, pxPerExposureUsd, priceImpactBps, feeUsd, spotUsdPerToken };
}

export function estimateGasUsd(gasUnits: number, gasPriceWei: bigint, bnbUsd: number): number {
  const bnb = Number(gasPriceWei) * gasUnits / 1e18;
  return bnb * bnbUsd;
}
// APPEND-CLIENT

// --- Live network path -----------------------------------------------------------------

const DEFAULT_MAX_IMPACT_BPS = 9000; // drop pools too shallow to fill the size sanely

function getClient(config: PancakeConfig): PublicClient {
  if (config.client) return config.client;
  return createPublicClient({
    chain: bsc,
    transport: http(config.rpcUrl ?? DEFAULT_RPC, { timeout: 15_000, retryCount: 1 }),
  });
}

interface BuildArgs {
  token: TokenInfo;
  stable: StableToken;
  sizeUsd: number;
  version: "v3" | "v2";
  poolAddress: Address;
  fee: number; // 1e6 units
  math: DexMath;
  gasUsd: number;
}

function buildQuote(a: BuildArgs): Quote {
  const feeLabel = a.version === "v3" ? `fee ${a.fee}` : "0.25%";
  return {
    venueId: `pancakeswap:${a.version}:${a.poolAddress}`,
    venueKind: "dex",
    issuer: a.token.issuer,
    symbol: a.token.symbol,
    tokenAddress: a.token.address,
    sizeUsd: a.sizeUsd,
    pxPerExposureUsd: a.math.pxPerExposureUsd,
    feeUsd: a.math.feeUsd,
    gasUsd: a.gasUsd,
    priceImpactBps: a.math.priceImpactBps,
    executable: true,
    kycGated: false,
    ts: Date.now(),
    source: `pancakeswap-${a.version} ${a.token.tokenSymbol}/${a.stable.symbol} ${feeLabel} pool ${a.poolAddress}`,
  };
}

async function fetchQuotesForToken(
  client: PublicClient,
  token: TokenInfo,
  sizeUsd: number,
  config: PancakeConfig,
): Promise<Quote[]> {
  const stables = config.stableQuotes ?? STABLE_QUOTES;
  const bnbUsd = config.bnbUsd ?? DEFAULT_BNB_USD;
  const maxImpact = config.maxPriceImpactBps ?? DEFAULT_MAX_IMPACT_BPS;

  const v3Candidates = stables.flatMap((stable) => V3_FEE_TIERS.map((fee) => ({ stable, fee })));
  const v2Candidates = stables.map((stable) => ({ stable }));

  const [v3Addrs, v2Addrs, gasPriceWei] = await Promise.all([
    Promise.all(
      v3Candidates.map((c) =>
        client
          .readContract({
            address: PANCAKE.v3Factory,
            abi: v3FactoryAbi,
            functionName: "getPool",
            args: [token.address, c.stable.address, c.fee],
          })
          .catch(() => ZERO_ADDRESS),
      ),
    ),
    Promise.all(
      v2Candidates.map((c) =>
        client
          .readContract({
            address: PANCAKE.v2Factory,
            abi: v2FactoryAbi,
            functionName: "getPair",
            args: [token.address, c.stable.address],
          })
          .catch(() => ZERO_ADDRESS),
      ),
    ),
    config.gasPriceWei !== undefined
      ? Promise.resolve(config.gasPriceWei)
      : client.getGasPrice().catch(() => 1_000_000_000n),
  ]);

  const quotes: Quote[] = [];

  // v3 pools: QuoterV2 for the executable amount-out, slot0 for the mid price.
  await Promise.all(
    v3Candidates.map(async (c, i) => {
      const pool = v3Addrs[i];
      if (!pool || pool === ZERO_ADDRESS) return;
      try {
        const [slot0, liquidity, token0] = await Promise.all([
          client.readContract({ address: pool, abi: v3PoolAbi, functionName: "slot0" }),
          client.readContract({ address: pool, abi: v3PoolAbi, functionName: "liquidity" }),
          client.readContract({ address: pool, abi: v3PoolAbi, functionName: "token0" }),
        ]);
        if (liquidity === 0n) return; // empty pool, nothing to fill against
        const amountInRaw = usdToRaw(sizeUsd, c.stable.decimals);
        const sim = await client.simulateContract({
          address: PANCAKE.quoterV2,
          abi: quoterV2Abi,
          functionName: "quoteExactInputSingle",
          args: [
            {
              tokenIn: c.stable.address,
              tokenOut: token.address,
              amountIn: amountInRaw,
              fee: c.fee,
              sqrtPriceLimitX96: 0n,
            },
          ],
        });
        const amountOutRaw = sim.result[0];
        const gasEstimate = sim.result[3];
        const amountOutToken = Number(formatUnits(amountOutRaw, token.decimals));
        if (!(amountOutToken > 0)) return;
        const token0IsStable = token0.toLowerCase() === c.stable.address.toLowerCase();
        const spotUsdPerToken = spotUsdPerTokenFromSqrtPriceX96(
          slot0[0],
          token0IsStable,
          c.stable.decimals,
          token.decimals,
        );
        const feeFrac = c.fee / 1e6;
        const pxPerExposureUsd = sizeUsd / amountOutToken;
        const math: DexMath = {
          amountOutToken,
          pxPerExposureUsd,
          feeUsd: sizeUsd * feeFrac,
          priceImpactBps: priceImpactBpsFromExec(pxPerExposureUsd, spotUsdPerToken, feeFrac),
          spotUsdPerToken,
        };
        if (math.priceImpactBps > maxImpact) return;
        const gasUnits = Number(gasEstimate) > 0 ? Number(gasEstimate) : (config.gasUnitsV3 ?? DEFAULT_GAS_V3);
        quotes.push(
          buildQuote({
            token,
            stable: c.stable,
            sizeUsd,
            version: "v3",
            poolAddress: pool,
            fee: c.fee,
            math,
            gasUsd: estimateGasUsd(gasUnits, gasPriceWei, bnbUsd),
          }),
        );
      } catch {
        // pool unreadable or quoter reverted for this size; skip it
      }
    }),
  );

  // v2 pairs: constant-product math over the on-chain reserves.
  await Promise.all(
    v2Candidates.map(async (c, i) => {
      const pair = v2Addrs[i];
      if (!pair || pair === ZERO_ADDRESS) return;
      try {
        const [reserves, token0] = await Promise.all([
          client.readContract({ address: pair, abi: v2PairAbi, functionName: "getReserves" }),
          client.readContract({ address: pair, abi: v2PairAbi, functionName: "token0" }),
        ]);
        const token0IsStable = token0.toLowerCase() === c.stable.address.toLowerCase();
        const reserveStableRaw = token0IsStable ? reserves[0] : reserves[1];
        const reserveTokenRaw = token0IsStable ? reserves[1] : reserves[0];
        if (reserveStableRaw === 0n || reserveTokenRaw === 0n) return;
        const math = quoteConstantProduct({
          sizeUsd,
          reserveStableRaw,
          reserveTokenRaw,
          stableDecimals: c.stable.decimals,
          tokenDecimals: token.decimals,
          feeUnits: V2_FEE,
        });
        if (!(math.amountOutToken > 0) || !Number.isFinite(math.pxPerExposureUsd)) return;
        if (math.priceImpactBps > maxImpact) return;
        quotes.push(
          buildQuote({
            token,
            stable: c.stable,
            sizeUsd,
            version: "v2",
            poolAddress: pair,
            fee: V2_FEE,
            math,
            gasUsd: estimateGasUsd(config.gasUnitsV2 ?? DEFAULT_GAS_V2, gasPriceWei, bnbUsd),
          }),
        );
      } catch {
        // pair unreadable; skip it
      }
    }),
  );

  return quotes;
}
// APPEND-ADAPTER

// --- Adapter -------------------------------------------------------------------------

// Factory so the engine or tests can inject a viem client, a fixed gas price, or a
// live BNB/USD without touching the default singleton.
export function makePancakeswapAdapter(config: PancakeConfig = {}): VenueAdapter {
  return {
    id: "pancakeswap",
    async supports(symbol: CanonicalSymbol): Promise<boolean> {
      return tokensForSymbol(symbol).length > 0;
    },
    async quotes(symbol: CanonicalSymbol, sizeUsd: number): Promise<Quote[]> {
      const tokens = tokensForSymbol(symbol);
      if (tokens.length === 0 || !(sizeUsd > 0)) return [];
      const client = getClient(config);
      const perToken = await Promise.all(
        tokens.map((token) =>
          fetchQuotesForToken(client, token, sizeUsd, config).catch(() => [] as Quote[]),
        ),
      );
      return perToken.flat();
    },
  };
}

export const pancakeswapAdapter: VenueAdapter = makePancakeswapAdapter();

