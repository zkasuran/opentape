// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import { describe, expect, it } from "vitest";
import {
  getAmountOutV2,
  makePancakeswapAdapter,
  pancakeswapAdapter,
  priceImpactBpsFromExec,
  quoteConstantProduct,
  spotUsdPerTokenFromSqrtPriceX96,
  usdToRaw,
} from "../src/adapters/pancakeswap";
import { BSC_TOKENS, tokensForSymbol } from "../src/adapters/tokens";

const WAD = 10n ** 18n;

describe("pancakeswap token map", () => {
  it("maps all six underlyings to verified BSC xStock addresses", () => {
    for (const sym of ["AAPL", "TSLA", "NVDA", "GOOGL", "META", "SPY"]) {
      const infos = tokensForSymbol(sym);
      expect(infos.length).toBe(1);
      const t = infos[0];
      expect(t).toBeDefined();
      if (!t) continue;
      expect(t.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(t.decimals).toBe(18);
      expect(t.issuer).toBe("xstocks");
      expect(t.exposurePerToken).toBe(1);
    }
  });

  it("pins the on-chain-verified addresses", () => {
    expect(BSC_TOKENS.AAPL?.[0]?.address).toBe("0x9d275685dC284C8eB1C79f6ABA7a63Dc75ec890a");
    expect(BSC_TOKENS.TSLA?.[0]?.address).toBe("0x8aD3c73F833d3F9A523aB01476625F269aEB7Cf0");
    expect(BSC_TOKENS.SPY?.[0]?.address).toBe("0x90A2a4c76b5D8c0bc892A69EA28Aa775a8f2dD48");
  });

  it("returns nothing for an unknown symbol", () => {
    expect(tokensForSymbol("DOGE")).toEqual([]);
  });
});

describe("constant-product math (deterministic, fixture reserves)", () => {
  it("usdToRaw scales USD to 18-decimal raw units", () => {
    expect(usdToRaw(1000, 18)).toBe(1000n * WAD);
    expect(usdToRaw(1.5, 18)).toBe(15n * 10n ** 17n);
    expect(usdToRaw(1, 6)).toBe(1_000_000n);
  });

  it("getAmountOutV2 matches the constant-product formula with a 0.25% fee", () => {
    // reserves: 1,000,000 USDT and 10,000 tokens -> mid price 100 USD/token.
    const reserveIn = 1_000_000n * WAD;
    const reserveOut = 10_000n * WAD;
    const amountIn = 1_000n * WAD; // $1000
    const out = getAmountOutV2(amountIn, reserveIn, reserveOut, 25);
    // no-slippage no-fee would buy 10 tokens; with fee + curve, ~9.96506 tokens.
    const human = Number(out) / 1e18;
    expect(human).toBeGreaterThan(0);
    expect(human).toBeLessThan(10);
    expect(human).toBeCloseTo(9.96506, 3);
  });

  it("getAmountOutV2 guards zero/empty inputs", () => {
    expect(getAmountOutV2(0n, 10n, 10n, 25)).toBe(0n);
    expect(getAmountOutV2(10n, 0n, 10n, 25)).toBe(0n);
    expect(getAmountOutV2(10n, 10n, 0n, 25)).toBe(0n);
  });

  it("quoteConstantProduct produces price, fee and impact from reserves", () => {
    const m = quoteConstantProduct({
      sizeUsd: 1000,
      reserveStableRaw: 1_000_000n * WAD,
      reserveTokenRaw: 10_000n * WAD,
      stableDecimals: 18,
      tokenDecimals: 18,
      feeUnits: 2500, // 0.25%
    });
    expect(m.spotUsdPerToken).toBeCloseTo(100, 6);
    expect(m.amountOutToken).toBeCloseTo(9.96506, 3);
    expect(m.pxPerExposureUsd).toBeCloseTo(100.35, 1); // all-in > mid
    expect(m.feeUsd).toBeCloseTo(2.5, 6);
    // curve slippage (fee excluded) ~ amountIn*(1-f)/reserveIn = 9.975 bps.
    expect(m.priceImpactBps).toBeGreaterThan(9);
    expect(m.priceImpactBps).toBeLessThan(11);
  });

  it("deeper reserves give less price impact for the same size", () => {
    const shallow = quoteConstantProduct({
      sizeUsd: 1000,
      reserveStableRaw: 100_000n * WAD,
      reserveTokenRaw: 1_000n * WAD,
      stableDecimals: 18,
      tokenDecimals: 18,
      feeUnits: 2500,
    });
    const deep = quoteConstantProduct({
      sizeUsd: 1000,
      reserveStableRaw: 10_000_000n * WAD,
      reserveTokenRaw: 100_000n * WAD,
      stableDecimals: 18,
      tokenDecimals: 18,
      feeUnits: 2500,
    });
    expect(deep.priceImpactBps).toBeLessThan(shallow.priceImpactBps);
    expect(deep.spotUsdPerToken).toBeCloseTo(shallow.spotUsdPerToken, 6);
  });
});

describe("price-impact and spot-price helpers", () => {
  it("priceImpactBpsFromExec is zero at mid and positive above it", () => {
    expect(priceImpactBpsFromExec(100, 100, 0)).toBe(0);
    expect(priceImpactBpsFromExec(101, 100, 0)).toBeCloseTo(100, 6); // +1% = 100 bps
    expect(priceImpactBpsFromExec(99, 100, 0)).toBe(0); // below mid clamps to 0
    expect(priceImpactBpsFromExec(100, 0, 0)).toBe(0); // no spot
    expect(priceImpactBpsFromExec(0, 100, 0)).toBe(0);
  });

  it("priceImpactBpsFromExec strips the fee before comparing to mid", () => {
    // all-in price 1% over mid, but 0.25% of that is fee -> impact ~0.749%.
    const bps = priceImpactBpsFromExec(101, 100, 0.0025);
    expect(bps).toBeGreaterThan(70);
    expect(bps).toBeLessThan(80);
  });

  it("decodes a real BSC sqrtPriceX96 to a sane USD price", () => {
    // TSLAx/USDT v3 fee-2500 pool, USDT is token0. Read live on BSC 2026-09-24.
    const sqrtP = 4094566750815116505422149694n;
    const usd = spotUsdPerTokenFromSqrtPriceX96(sqrtP, true, 18, 18);
    expect(usd).toBeGreaterThan(200);
    expect(usd).toBeLessThan(600); // ~$374 at read time
  });

  it("orients the price when the stock token is token0", () => {
    // stable is token1: ratio == USD per token directly. sqrt(100)*2^96 -> $100.
    const sqrtP = 10n * 2n ** 96n;
    const usd = spotUsdPerTokenFromSqrtPriceX96(sqrtP, false, 18, 18);
    expect(usd).toBeCloseTo(100, 4);
  });
});

describe("pancakeswap adapter surface", () => {
  it("has the fixed venue id", () => {
    expect(pancakeswapAdapter.id).toBe("pancakeswap");
  });

  it("supports mapped underlyings only", async () => {
    expect(await pancakeswapAdapter.supports("AAPL")).toBe(true);
    expect(await pancakeswapAdapter.supports("tsla")).toBe(true);
    expect(await pancakeswapAdapter.supports("DOGE")).toBe(false);
  });

  it("returns no quotes for an unknown symbol or non-positive size, without hitting the network", async () => {
    // A client that throws if any RPC is attempted proves these short-circuit early.
    const tripwire = makePancakeswapAdapter({
      client: new Proxy({} as never, {
        get() {
          throw new Error("network must not be called");
        },
      }),
    });
    expect(await tripwire.quotes("DOGE", 1000)).toEqual([]);
    expect(await tripwire.quotes("AAPL", 0)).toEqual([]);
    expect(await tripwire.quotes("AAPL", -5)).toEqual([]);
  });
});

describe("pancakeswap live smoke (skips gracefully offline)", () => {
  it(
    "quotes a real xStock/USDT pool on BSC",
    async () => {
      let quotes;
      try {
        quotes = await pancakeswapAdapter.quotes("TSLA", 3);
      } catch (e) {
        console.warn("pancakeswap live smoke skipped (RPC error):", (e as Error).message);
        return;
      }
      if (!quotes || quotes.length === 0) {
        console.warn("pancakeswap live smoke skipped (no live pool reachable for TSLA/USDT)");
        return;
      }
      const tsla = tokensForSymbol("TSLA")[0];
      for (const q of quotes) {
        expect(q.venueKind).toBe("dex");
        expect(q.executable).toBe(true);
        expect(q.kycGated).toBe(false);
        expect(q.symbol).toBe("TSLA");
        expect(q.issuer).toBe("xstocks");
        expect(q.tokenAddress).toBe(tsla?.address);
        expect(q.venueId.startsWith("pancakeswap:")).toBe(true);
        expect(Number.isFinite(q.pxPerExposureUsd)).toBe(true);
        expect(q.pxPerExposureUsd).toBeGreaterThan(10);
        expect(q.pxPerExposureUsd).toBeLessThan(100_000);
        expect(q.priceImpactBps).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(q.priceImpactBps)).toBe(true);
        expect(q.feeUsd).toBeGreaterThanOrEqual(0);
        expect(q.gasUsd).toBeGreaterThanOrEqual(0);
      }
      console.info(`pancakeswap live smoke: ${quotes.length} TSLA quote(s) from BSC`);
    },
    30_000,
  );
});

