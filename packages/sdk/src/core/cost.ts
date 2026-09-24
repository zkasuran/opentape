// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import type { Quote } from "../types";

// Landed-cost model shared by ranking and the arb signal.
//
// A quote's `pxPerExposureUsd` is the base USD price for one share of the
// underlying's economic exposure on that venue (issuer multipliers already
// applied by `normalizeQuotes`). On top of that base price an order of
// `sizeUsd` carries three real costs: the pool or book price impact, the venue
// fee and the on-chain gas. Impact is already a fraction of notional in bps.
// Fee and gas are absolute USD, so we amortize them over the order notional to
// put every cost on the same per-exposure footing.

/** Total fractional cost drag on an order of `q.sizeUsd`: impact + amortized fee + amortized gas. */
export function costDragFraction(q: Quote): number {
  const impact = Math.max(0, q.priceImpactBps) / 10_000;
  const feeGas =
    q.sizeUsd > 0 ? (Math.max(0, q.feeUsd) + Math.max(0, q.gasUsd)) / q.sizeUsd : 0;
  return impact + feeGas;
}

/** All-in USD cost to BUY one share of exposure through this venue. Lower is cheaper. */
export function landedBuyCostPerExposureUsd(q: Quote): number {
  return q.pxPerExposureUsd * (1 + costDragFraction(q));
}

/** Net USD proceeds from SELLING one share of exposure through this venue. Higher is better. */
export function netSellProceedsPerExposureUsd(q: Quote): number {
  return q.pxPerExposureUsd * (1 - costDragFraction(q));
}
