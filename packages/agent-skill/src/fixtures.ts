// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import type { ArbSpread, BestExecution, CanonicalSymbol, FairValue, Quote } from "@opentape/sdk";
import type { SkillDeps } from "./skill";

// OFFLINE DEMONSTRATION DATA. These quotes are illustrative, not live venue reads.
// The CLI prints them only in its default (demo) mode and labels them as such; the
// --live flag routes to the real SDK instead. No contract addresses are invented
// here (house rule): the demo quotes carry no tokenAddress.
//
// The two helpers below mirror the SDK landed-cost model so the derived
// BestExecution and ArbSpread stay internally consistent with what the engine
// would return for the same quotes.

const DEMO_REFERENCE_USD: Record<string, number> = {
  AAPL: 200,
  TSLA: 250,
  NVDA: 120,
  SPY: 560,
  GOOGL: 165,
  META: 520,
};

function costDragFraction(q: Quote): number {
  const impact = Math.max(0, q.priceImpactBps) / 10_000;
  const feeGas = q.sizeUsd > 0 ? (Math.max(0, q.feeUsd) + Math.max(0, q.gasUsd)) / q.sizeUsd : 0;
  return impact + feeGas;
}

const landedBuy = (q: Quote): number => q.pxPerExposureUsd * (1 + costDragFraction(q));
const netSell = (q: Quote): number => q.pxPerExposureUsd * (1 - costDragFraction(q));

function demoQuotes(symbol: CanonicalSymbol, sizeUsd: number, ref: number, ts: number): Quote[] {
  // Impact grows with order size; the CEX book is deeper than the DEX pool.
  const dexImpact = Math.min(400, (sizeUsd / 1000) * 3);
  const cexImpact = Math.min(300, (sizeUsd / 1000) * 1.5);
  const base = { symbol, sizeUsd, ts, kycGated: false, executable: true } as const;
  return [
    {
      ...base,
      venueId: "pancakeswap:v3:demo",
      venueKind: "dex",
      issuer: "xstocks",
      pxPerExposureUsd: ref * 1.002,
      priceImpactBps: dexImpact,
      feeUsd: 0,
      gasUsd: 0.3,
      source: "opentape:demo-fixture",
    },
    {
      ...base,
      venueId: "binance:demo",
      venueKind: "cex",
      issuer: "bstocks",
      pxPerExposureUsd: ref * 1.006,
      priceImpactBps: cexImpact,
      feeUsd: sizeUsd * 0.001,
      gasUsd: 0,
      source: "opentape:demo-fixture",
    },
    {
      ...base,
      venueId: "ondo:redeem:demo",
      venueKind: "issuer",
      issuer: "ondo",
      pxPerExposureUsd: ref * 1.02,
      priceImpactBps: 0,
      feeUsd: 0,
      gasUsd: 0,
      kycGated: true,
      source: "opentape:demo-fixture",
    },
  ];
}

function demoBestExecution(symbol: CanonicalSymbol, sizeUsd: number): BestExecution {
  const ref = DEMO_REFERENCE_USD[symbol] ?? 200;
  const ts = 1_700_000_000_000;
  const fairValue: FairValue = {
    symbol,
    usd: ref,
    confBps: 5,
    ts,
    source: "opentape:demo-fixture",
  };
  const ranked = demoQuotes(symbol, sizeUsd, ref, ts).sort((a, b) => landedBuy(a) - landedBuy(b));
  const best = ranked.find((q) => q.executable && !q.kycGated) ?? ranked[0];
  const worst = ranked[ranked.length - 1] ?? best;
  if (!best || !worst) throw new Error("demoBestExecution: empty quote set");
  const wc = landedBuy(worst);
  const savingsBpsVsWorst = wc > 0 ? ((wc - landedBuy(best)) / wc) * 10_000 : 0;
  return { symbol, sizeUsd, best, ranked, fairValue, savingsBpsVsWorst };
}

function demoArbSpread(symbol: CanonicalSymbol, sizeUsd: number): ArbSpread {
  const ref = DEMO_REFERENCE_USD[symbol] ?? 200;
  const quotes = demoQuotes(symbol, sizeUsd, ref, 1_700_000_000_000);
  const open = quotes.filter((q) => q.executable && !q.kycGated);
  const buy = (open.length > 0 ? open : quotes).reduce((a, b) =>
    landedBuy(a) <= landedBuy(b) ? a : b,
  );
  const sell = quotes.reduce((a, b) => (netSell(a) >= netSell(b) ? a : b));
  const grossBps =
    buy.pxPerExposureUsd > 0
      ? ((sell.pxPerExposureUsd - buy.pxPerExposureUsd) / buy.pxPerExposureUsd) * 10_000
      : 0;
  const buyLanded = landedBuy(buy);
  const netBps = buyLanded > 0 ? ((netSell(sell) - buyLanded) / buyLanded) * 10_000 : 0;
  const executable = buy.executable && sell.executable && !buy.kycGated && !sell.kycGated;
  const notes = [
    "Arb is a signal, not a captured trade. Cross-issuer redemption is gated by KYC or institutional access.",
  ];
  if (sell.kycGated) notes.push(`Sell or redeem leg ${sell.venueId} (${sell.issuer}) is KYC-gated.`);
  return { symbol, buy, sell, grossBps, netBps, executable, notes };
}

// Offline SkillDeps for the CLI demo mode. Deterministic, no network.
export const demoDeps: SkillDeps = {
  async getBestExecution(symbol, sizeUsd) {
    return demoBestExecution(symbol, sizeUsd);
  },
  async getArbSpread(symbol) {
    return demoArbSpread(symbol, 10_000);
  },
};
