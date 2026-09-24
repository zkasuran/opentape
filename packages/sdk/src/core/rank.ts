// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import type { BestExecution, CanonicalSymbol, FairValue, Quote } from "../types";
import { landedBuyCostPerExposureUsd } from "./cost";
import { normalizeQuotes } from "./normalize";

/**
 * Rank quotes cheapest first by total landed cost per unit of exposure: base
 * price plus price impact plus amortized fee and gas. Pure cost order, so a
 * gated or non-executable quote still takes its true price rank; picking a route
 * you can actually execute is done separately by `pickExecutable`.
 *
 * Ties break on lower gas, then on `venueId` so the order is deterministic.
 */
export function rankQuotes(quotes: Quote[]): Quote[] {
  return quotes.slice().sort((a, b) => {
    const ca = landedBuyCostPerExposureUsd(a);
    const cb = landedBuyCostPerExposureUsd(b);
    if (ca !== cb) return ca - cb;
    if (a.gasUsd !== b.gasUsd) return a.gasUsd - b.gasUsd;
    if (a.venueId < b.venueId) return -1;
    if (a.venueId > b.venueId) return 1;
    return 0;
  });
}

/** The cheapest quote a permissionless caller can actually take: executable and not KYC-gated.
 *  Falls back to the cheapest overall when no route is executable (the flags stay truthful). */
export function pickExecutable(ranked: Quote[]): Quote {
  for (const q of ranked) {
    if (q.executable && !q.kycGated) return q;
  }
  const cheapest = ranked[0];
  if (!cheapest) throw new Error("pickExecutable: no quotes");
  return cheapest;
}

/** Savings in bps of the chosen route over the worst-priced route, by landed cost. */
export function savingsBpsVsWorst(best: Quote, worst: Quote): number {
  const w = landedBuyCostPerExposureUsd(worst);
  const b = landedBuyCostPerExposureUsd(best);
  if (!(w > 0)) return 0;
  return ((w - b) / w) * 10_000;
}

/**
 * Build the best-execution recommendation for `sizeUsd` of exposure: normalize,
 * rank by landed cost, recommend the cheapest executable route and report the
 * saving over the worst route. Pure over the given quotes and fair value.
 */
export function buildBestExecution(
  symbol: CanonicalSymbol,
  sizeUsd: number,
  quotes: Quote[],
  fairValue: FairValue,
): BestExecution {
  const ranked = rankQuotes(normalizeQuotes(quotes, fairValue));
  const cheapest = ranked[0];
  if (!cheapest) throw new Error(`buildBestExecution: no quotes for ${symbol}`);
  const best = pickExecutable(ranked);
  const worst = ranked[ranked.length - 1] ?? cheapest;
  return {
    symbol,
    sizeUsd,
    best,
    ranked,
    fairValue,
    savingsBpsVsWorst: savingsBpsVsWorst(best, worst),
  };
}
