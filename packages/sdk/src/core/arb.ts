// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import type { ArbSpread, CanonicalSymbol, Quote } from "../types";
import { landedBuyCostPerExposureUsd, netSellProceedsPerExposureUsd } from "./cost";

// Cheapest landed buy across executable, non-gated venues. Falls back to the
// cheapest venue overall when nothing is executable, so the signal still prices.
function pickBuyLeg(quotes: Quote[]): Quote {
  let leg: Quote | undefined;
  let cost = Number.POSITIVE_INFINITY;
  for (const q of quotes) {
    if (!(q.executable && !q.kycGated)) continue;
    const c = landedBuyCostPerExposureUsd(q);
    if (c < cost) {
      cost = c;
      leg = q;
    }
  }
  if (leg) return leg;
  for (const q of quotes) {
    const c = landedBuyCostPerExposureUsd(q);
    if (c < cost) {
      cost = c;
      leg = q;
    }
  }
  if (!leg) throw new Error("pickBuyLeg: no quotes");
  return leg;
}

// Dearest venue to sell or redeem into, by net proceeds after costs.
function pickSellLeg(quotes: Quote[]): Quote {
  let leg: Quote | undefined;
  let proceeds = Number.NEGATIVE_INFINITY;
  for (const q of quotes) {
    const p = netSellProceedsPerExposureUsd(q);
    if (p > proceeds) {
      proceeds = p;
      leg = q;
    }
  }
  if (!leg) throw new Error("pickSellLeg: no quotes");
  return leg;
}

function buildNotes(buy: Quote, sell: Quote, netBps: number): string[] {
  const notes: string[] = [
    "Arb is a signal, not a captured trade. Cross-issuer redemption is gated by KYC or institutional access, so a permissionless agent cannot close both legs.",
  ];
  if (buy.venueId === sell.venueId) {
    notes.push("Only one venue priced this symbol, so there is no cross-venue spread.");
  }
  if (buy.kycGated) {
    notes.push(`Buy leg ${buy.venueId} (${buy.issuer}) is KYC-gated.`);
  }
  if (sell.kycGated) {
    notes.push(`Sell or redeem leg ${sell.venueId} (${sell.issuer}) is KYC-gated.`);
  }
  if (!buy.executable) {
    notes.push(`Buy leg ${buy.venueId} is not executable right now.`);
  }
  if (!sell.executable) {
    notes.push(`Sell or redeem leg ${sell.venueId} is not executable right now.`);
  }
  if (netBps <= 0) {
    notes.push("No positive spread after fees, gas and price impact.");
  }
  return notes;
}

/**
 * Cross-issuer arb SIGNAL: buy the cheapest executable venue, sell or redeem the
 * dearest. `grossBps` is the raw price spread; `netBps` nets both legs' costs.
 * `executable` is true only when both legs are executable and neither is
 * KYC-gated. It is a signal: redemption is gated across issuers, so the notes
 * spell out why a permissionless caller usually cannot capture it.
 */
export function computeArb(symbol: CanonicalSymbol, quotes: Quote[]): ArbSpread {
  if (quotes.length === 0) throw new Error(`computeArb: no quotes for ${symbol}`);
  const buy = pickBuyLeg(quotes);
  const sell = pickSellLeg(quotes);
  const buyLanded = landedBuyCostPerExposureUsd(buy);
  const sellProceeds = netSellProceedsPerExposureUsd(sell);
  const grossBps =
    buy.pxPerExposureUsd > 0
      ? ((sell.pxPerExposureUsd - buy.pxPerExposureUsd) / buy.pxPerExposureUsd) * 10_000
      : 0;
  const netBps = buyLanded > 0 ? ((sellProceeds - buyLanded) / buyLanded) * 10_000 : 0;
  const executable = buy.executable && sell.executable && !buy.kycGated && !sell.kycGated;
  return { symbol, buy, sell, grossBps, netBps, executable, notes: buildNotes(buy, sell, netBps) };
}
