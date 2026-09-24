// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import type { CanonicalSymbol, FairValue, Quote, TapeRow } from "../types";
import { netSellProceedsPerExposureUsd } from "./cost";
import { normalizeQuotes } from "./normalize";
import { rankQuotes } from "./rank";

// A venue counts toward the consolidated bid when you can actually sell into it.
// DEX pools and CEX order books are two-sided, so they always can. Selling back
// to an issuer (redeem) only counts when that redemption is executable and not
// KYC-gated, which for the tokenized-stock issuers it usually is not.
function isSellable(q: Quote): boolean {
  if (q.venueKind === "issuer") return q.executable && !q.kycGated;
  return true;
}

/** Best consolidated bid: the venue with the highest net sell proceeds you can realize. */
export function pickBestBid(quotes: Quote[]): Quote | undefined {
  let best: Quote | undefined;
  let bestProceeds = Number.NEGATIVE_INFINITY;
  for (const q of quotes) {
    if (!isSellable(q)) continue;
    const p = netSellProceedsPerExposureUsd(q);
    if (p > bestProceeds) {
      bestProceeds = p;
      best = q;
    }
  }
  return best;
}

/**
 * Build one consolidated tape row for a symbol from every venue quote:
 *  - `bestOffer`: cheapest landed buy across venues (the headline ask).
 *  - `bestBid`: highest realizable sell across sellable venues, if any.
 *  - `premiumBps`: how far the best offer sits above (or below) the Chainlink fair value.
 *
 * Pure over the given quotes and fair value; adapters supply the quotes.
 */
export function buildTape(
  symbol: CanonicalSymbol,
  quotes: Quote[],
  fairValue: FairValue,
): TapeRow {
  const ranked = rankQuotes(normalizeQuotes(quotes, fairValue));
  const bestOffer = ranked[0];
  if (!bestOffer) throw new Error(`buildTape: no quotes for ${symbol}`);
  const bestBid = pickBestBid(ranked);
  const fair = fairValue.usd;
  const premiumBps = fair > 0 ? ((bestOffer.pxPerExposureUsd - fair) / fair) * 10_000 : 0;
  const ts = Math.max(fairValue.ts, ...ranked.map((q) => q.ts));
  return { symbol, fairValue, bestBid, bestOffer, quotes: ranked, premiumBps, ts };
}
