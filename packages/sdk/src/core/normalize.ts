// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import type { FairValue, IssuerId, Quote } from "../types";

// Economic-exposure multiplier per issuer: how many shares of the underlying one
// issuer token represents. Every BNB-listed tokenized stock we track (xStocks,
// bStocks, Ondo) redeems 1:1 against a single share today, so the default is a
// no-op. The hook exists for issuer units that are not 1:1 (for example a
// total-return token that bundles reinvested distributions into one unit). Never
// invent a non-1 value: pass it explicitly via `multipliers` when a source proves it.
export const ISSUER_EXPOSURE_MULTIPLIER: Record<IssuerId, number> = {
  xstocks: 1,
  bstocks: 1,
  ondo: 1,
};

// A venue price beyond this band around fair value is a broken or stale feed, not
// a real premium. Real cross-issuer premiums run single or low double-digit percent
// off-hours, nowhere near 20x, so the band drops only garbage and keeps every signal.
const SANITY_BAND = 20;

/**
 * Put every venue quote onto one comparable basis: USD price for a single share
 * of the underlying's economic exposure, measured against `fairValue`.
 *
 * Two things happen here so the adapters never have to:
 *  - issuer exposure multiplier: if one issuer token represents `m` shares
 *    (m !== 1) the per-token price is divided by `m`.
 *  - fair-value hygiene: a quote whose normalized price is not a positive finite
 *    number or sits outside a wide band around fair value is dropped before it
 *    can poison ranking or the arb signal.
 *
 * @param multipliers per-issuer overrides for the exposure multiplier (defaults to 1:1).
 */
export function normalizeQuotes(
  quotes: Quote[],
  fairValue: FairValue,
  multipliers: Partial<Record<IssuerId, number>> = {},
): Quote[] {
  const fair = fairValue.usd;
  const bandOk = Number.isFinite(fair) && fair > 0;
  const out: Quote[] = [];
  for (const q of quotes) {
    const m = multipliers[q.issuer] ?? ISSUER_EXPOSURE_MULTIPLIER[q.issuer] ?? 1;
    const px = m === 1 ? q.pxPerExposureUsd : q.pxPerExposureUsd / m;
    if (!Number.isFinite(px) || px <= 0) continue;
    if (bandOk && (px > fair * SANITY_BAND || px < fair / SANITY_BAND)) continue;
    out.push(m === 1 ? q : { ...q, pxPerExposureUsd: px });
  }
  return out;
}
