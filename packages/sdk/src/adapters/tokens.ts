// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import type { Address } from "viem";
import type { CanonicalSymbol, IssuerId } from "../types";

// Tokenized-stock token map for BNB Smart Chain (chain id 56).
//
// Every address below was verified on-chain against the BNB dataseed RPC on 2026-09-24
// by reading name()/symbol()/decimals() from the deployed contract, and cross-checked
// against the issuer's own product pages. Nothing here is hand-guessed. If a token could
// not be confirmed on BSC it is omitted rather than invented.
//
// Sources:
//   - Backed / xStocks product pages: https://xstocks.com/products and
//     https://assets.backed.fi/products/<name>-xstock (issuer of record; the same EVM
//     address is used across every EVM chain, including BSC BEP-20).
//   - On-chain confirmation via https://bsc-dataseed.bnbchain.org (symbol/decimals/name).
//   - BNB Chain x Kraken x xStocks launch note:
//     https://www.bnbchain.org/en/blog/bnb-chain-x-kraken-x-xstocks-trade-tokenized-equities-onchain-anytime
//
// All six xStocks tokens are Backed Finance issue and are 1:1 share-backed (exposure
// multiplier = 1 token per share), 18 decimals on BSC.

export const BSC_CHAIN_ID = 56;

// PancakeSwap contract addresses on BSC mainnet.
// Source: https://developer.pancakeswap.finance/contracts/v3/addresses (v3) and the
// SmartRouter address from the same docs. getPool()/getPair()/quoteExactInputSingle()
// against these were exercised live on 2026-09-24 and returned real data.
export const PANCAKE = {
  v3Factory: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865" as Address,
  quoterV2: "0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997" as Address,
  swapRouterV3: "0x1b81D678ffb9C0263b24A97847620C99d213eB14" as Address,
  smartRouter: "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4" as Address,
  v2Factory: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73" as Address,
} as const;

// PancakeSwap v3 fee tiers, in hundredths of a basis point (1e6 = 100%).
// 100 = 0.01%, 500 = 0.05%, 2500 = 0.25%, 10000 = 1%.
export const V3_FEE_TIERS = [100, 500, 2500, 10000] as const;

// PancakeSwap v2 charges a flat 0.25% swap fee, expressed here in the same 1e6 unit
// (2500 = 0.25%) so downstream fee math is uniform across v2 and v3.
export const V2_FEE = 2500;

export interface StableToken {
  symbol: string;
  address: Address;
  decimals: number;
}

// USD-pegged quote assets on BSC (both 18 decimals, both valued at ~$1). USDT is the
// primary quote asset the adapter prices against; USDC is a fallback so tokens whose only
// live liquidity is a USDC pool (e.g. SPYx) still get a quote. Verified on-chain 2026-09-24.
export const USDT: StableToken = {
  symbol: "USDT",
  address: "0x55d398326f99059fF775485246999027B3197955",
  decimals: 18,
};
export const USDC: StableToken = {
  symbol: "USDC",
  address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
  decimals: 18,
};
export const STABLE_QUOTES: StableToken[] = [USDT, USDC];

export const WBNB: Address = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

export interface TokenInfo {
  symbol: CanonicalSymbol; // canonical underlying, e.g. "AAPL"
  issuer: IssuerId;
  tokenSymbol: string; // on-chain symbol, e.g. "AAPLx"
  address: Address;
  decimals: number;
  name: string;
  // exposure multiplier: shares of the underlying represented by 1 token. xStocks are 1:1.
  exposurePerToken: number;
}

// Canonical underlying -> issuer tokens on BSC. Keyed structure allows more issuers per
// underlying later (bStocks / Ondo) without a signature change.
export const BSC_TOKENS: Record<CanonicalSymbol, TokenInfo[]> = {
  AAPL: [
    {
      symbol: "AAPL",
      issuer: "xstocks",
      tokenSymbol: "AAPLx",
      address: "0x9d275685dC284C8eB1C79f6ABA7a63Dc75ec890a",
      decimals: 18,
      name: "Apple xStock",
      exposurePerToken: 1,
    },
  ],
  TSLA: [
    {
      symbol: "TSLA",
      issuer: "xstocks",
      tokenSymbol: "TSLAx",
      address: "0x8aD3c73F833d3F9A523aB01476625F269aEB7Cf0",
      decimals: 18,
      name: "Tesla xStock",
      exposurePerToken: 1,
    },
  ],
  NVDA: [
    {
      symbol: "NVDA",
      issuer: "xstocks",
      tokenSymbol: "NVDAx",
      address: "0xc845b2894dBddd03858fd2D643B4eF725fE0849d",
      decimals: 18,
      name: "NVIDIA xStock",
      exposurePerToken: 1,
    },
  ],
  GOOGL: [
    {
      symbol: "GOOGL",
      issuer: "xstocks",
      tokenSymbol: "GOOGLx",
      address: "0xe92f673Ca36C5E2Efd2DE7628f815f84807e803F",
      decimals: 18,
      name: "Alphabet xStock",
      exposurePerToken: 1,
    },
  ],
  META: [
    {
      symbol: "META",
      issuer: "xstocks",
      tokenSymbol: "METAx",
      address: "0x96702be57Cd9777f835117a809C7124fe4ec989A",
      decimals: 18,
      name: "Meta xStock",
      exposurePerToken: 1,
    },
  ],
  SPY: [
    {
      symbol: "SPY",
      issuer: "xstocks",
      tokenSymbol: "SPYx",
      address: "0x90A2a4c76b5D8c0bc892A69EA28Aa775a8f2dD48",
      decimals: 18,
      name: "SP500 xStock",
      exposurePerToken: 1,
    },
  ],
};

export function tokensForSymbol(symbol: CanonicalSymbol): TokenInfo[] {
  return BSC_TOKENS[symbol.toUpperCase()] ?? [];
}
