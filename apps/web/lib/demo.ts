// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import type {
  ArbSpread,
  BestExecution,
  CanonicalSymbol,
  FairValue,
  IssuerId,
  Quote,
  TapeRow,
  VenueKind,
} from "@opentape/sdk";
import { landedPerShare, landedPremiumBps, quotePremiumBps } from "./quote";

// ---------------------------------------------------------------------------
// DEMO dataset. This is the clearly-labeled fallback the product renders when the
// live SDK path is unavailable (adapters or engine still landing). Numbers are
// synthetic but internally consistent: premiums, price impact, fees, gas and the
// savings/arb math all derive from one set of fair values and venue depths.
// No real token addresses are asserted here; the live adapters carry those.
// ---------------------------------------------------------------------------

export const DEMO_UNDERLYINGS: CanonicalSymbol[] = ["AAPL", "TSLA", "NVDA", "SPY", "GOOGL", "META"];

// Demo reference prices (USD). Labeled DEMO in the UI; not a live quote.
const FAIR_USD: Record<string, number> = {
  AAPL: 232.15,
  TSLA: 412.4,
  NVDA: 178.6,
  SPY: 642.3,
  GOOGL: 191.75,
  META: 748.9,
};

interface VenueTemplate {
  key: string;
  venueId: string;
  label: string;
  issuer: IssuerId;
  kind: VenueKind;
  depthUsd: number; // liquidity used for the price-impact model
  feeBps: number; // venue fee on notional
  gasUsd: number; // network cost for the leg (0 for the CEX leg)
  executable: boolean;
  kycGated: boolean;
  source: string;
}

const VENUES: VenueTemplate[] = [
  { key: "pcs3-x", venueId: "pancakeswap:v3:xstocks", label: "PancakeSwap v3", issuer: "xstocks", kind: "dex", depthUsd: 1_250_000, feeBps: 25, gasUsd: 0.42, executable: true, kycGated: false, source: "pancakeswap" },
  { key: "binance-b", venueId: "binance:bstocks", label: "Binance spot", issuer: "bstocks", kind: "cex", depthUsd: 6_000_000, feeBps: 10, gasUsd: 0, executable: true, kycGated: true, source: "binance" },
  { key: "pcs3-b", venueId: "pancakeswap:v3:bstocks", label: "PancakeSwap v3", issuer: "bstocks", kind: "dex", depthUsd: 780_000, feeBps: 25, gasUsd: 0.42, executable: true, kycGated: false, source: "pancakeswap" },
  { key: "pcs2-x", venueId: "pancakeswap:v2:xstocks", label: "PancakeSwap v2", issuer: "xstocks", kind: "dex", depthUsd: 520_000, feeBps: 25, gasUsd: 0.31, executable: true, kycGated: false, source: "pancakeswap" },
  { key: "ondo", venueId: "ondo:mint", label: "Ondo mint / redeem", issuer: "ondo", kind: "issuer", depthUsd: 50_000_000, feeBps: 15, gasUsd: 0.55, executable: true, kycGated: true, source: "ondo" },
];

// Stable 0..1 hash so a (symbol, venue) pair always gets the same premium offset.
function seed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function demoFairValue(symbol: CanonicalSymbol): FairValue {
  const usd = FAIR_USD[symbol] ?? 100;
  return { symbol, usd, confBps: 8, ts: Date.now(), source: "chainlink (demo)" };
}

function buildQuote(v: VenueTemplate, symbol: CanonicalSymbol, sizeUsd: number, fairUsd: number): Quote {
  // Broad market tilt per symbol (some names trade rich off-hours, some cheap),
  // plus a stable per-venue offset, plus size-driven price impact.
  const symbolTilt = (seed(symbol) - 0.5) * 40;
  const venueOffset = (seed(symbol + v.key) - 0.5) * 130;
  const impactBps = Math.min(320, (sizeUsd / v.depthUsd) * 6500);
  const premiumBps = symbolTilt + venueOffset + impactBps;
  const pxPerExposureUsd = fairUsd * (1 + premiumBps / 10000);
  const feeUsd = (sizeUsd * v.feeBps) / 10000;
  return {
    venueId: v.venueId,
    venueKind: v.kind,
    issuer: v.issuer,
    symbol,
    sizeUsd,
    pxPerExposureUsd,
    feeUsd,
    gasUsd: v.gasUsd,
    priceImpactBps: Math.round(impactBps),
    executable: v.executable,
    kycGated: v.kycGated,
    ts: Date.now(),
    source: v.source,
  };
}

export function demoQuotes(symbol: CanonicalSymbol, sizeUsd: number): Quote[] {
  const fairUsd = demoFairValue(symbol).usd;
  return VENUES.map((v) => buildQuote(v, symbol, sizeUsd, fairUsd));
}

export function demoBestExecution(symbol: CanonicalSymbol, sizeUsd: number): BestExecution {
  const fairValue = demoFairValue(symbol);
  const quotes = demoQuotes(symbol, sizeUsd);
  const ranked = quotes
    .slice()
    .sort((a, b) => landedPerShare(a, fairValue.usd) - landedPerShare(b, fairValue.usd));
  const best = ranked[0]!;
  const worst = ranked[ranked.length - 1]!;
  const savingsBpsVsWorst =
    landedPremiumBps(worst, fairValue.usd) - landedPremiumBps(best, fairValue.usd);
  return { symbol, sizeUsd, best, ranked, fairValue, savingsBpsVsWorst };
}

export function demoArbSpread(symbol: CanonicalSymbol, refSizeUsd = 25_000): ArbSpread {
  const fairUsd = demoFairValue(symbol).usd;
  const quotes = demoQuotes(symbol, refSizeUsd);
  const byPx = quotes.slice().sort((a, b) => a.pxPerExposureUsd - b.pxPerExposureUsd);
  const buy = byPx[0]!; // cheapest to acquire
  const sell = byPx[byPx.length - 1]!; // dearest to dispose
  const grossBps = quotePremiumBps(sell, fairUsd) - quotePremiumBps(buy, fairUsd);
  // Round-trip costs on both legs, expressed in bps of notional.
  const roundTripBps = ((buy.feeUsd + buy.gasUsd + sell.feeUsd + sell.gasUsd) / refSizeUsd) * 10000;
  const netBps = grossBps - roundTripBps;
  const notes = [
    "Signal only. Redemption is institutional or KYC gated across xStocks, Ondo and bStocks, so the sell leg is not a permissionless trade.",
    `Reference size ${refSizeUsd.toLocaleString("en-US")} USD. Net folds in both legs' fees and gas.`,
  ];
  return { symbol, buy, sell, grossBps, netBps, executable: false, notes };
}

export function demoTapeRow(symbol: CanonicalSymbol, refSizeUsd = 10_000): TapeRow {
  const fairValue = demoFairValue(symbol);
  const quotes = demoQuotes(symbol, refSizeUsd);
  const ranked = quotes.slice().sort((a, b) => a.pxPerExposureUsd - b.pxPerExposureUsd);
  const bestOffer = ranked[0]!;
  const bestBid = ranked[ranked.length - 1]!;
  return {
    symbol,
    fairValue,
    bestBid,
    bestOffer,
    quotes,
    premiumBps: quotePremiumBps(bestOffer, fairValue.usd),
    ts: Date.now(),
  };
}

export function demoTape(refSizeUsd = 10_000): TapeRow[] {
  return DEMO_UNDERLYINGS.map((s) => demoTapeRow(s, refSizeUsd));
}
