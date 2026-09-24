// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import type { Quote } from "@opentape/sdk";

// Shared landed-cost math. One source for both the demo dataset and the UI, so a
// quote is ranked and displayed the same way everywhere.
//
// Convention used by this product surface: pxPerExposureUsd is the venue price in
// USD per one share of underlying exposure (comparable to FairValue.usd) and
// feeUsd + gasUsd are the extra costs for the whole order. Landed cost per share
// folds those extras back in. Integration (Phase 2) aligns this with the SDK core
// once its normalize step lands.

export function shareCount(sizeUsd: number, fairUsd: number): number {
  return fairUsd > 0 ? sizeUsd / fairUsd : 0;
}

export function landedPerShare(q: Quote, fairUsd: number): number {
  const n = shareCount(q.sizeUsd, fairUsd);
  const extraPerShare = n > 0 ? (q.feeUsd + q.gasUsd) / n : 0;
  return q.pxPerExposureUsd + extraPerShare;
}

// Premium of the raw venue price vs the true underlying, in basis points.
export function quotePremiumBps(q: Quote, fairUsd: number): number {
  return fairUsd > 0 ? (q.pxPerExposureUsd / fairUsd - 1) * 10000 : 0;
}

// Premium of the all-in landed price vs the true underlying, in basis points.
export function landedPremiumBps(q: Quote, fairUsd: number): number {
  return fairUsd > 0 ? (landedPerShare(q, fairUsd) / fairUsd - 1) * 10000 : 0;
}

export function totalCostUsd(q: Quote, fairUsd: number): number {
  return landedPerShare(q, fairUsd) * shareCount(q.sizeUsd, fairUsd);
}

export const MIN_SIZE_USD = 100;
export const MAX_SIZE_USD = 5_000_000;
export const DEFAULT_SIZE_USD = 10_000;

export function clampSizeUsd(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_SIZE_USD;
  return Math.min(MAX_SIZE_USD, Math.max(MIN_SIZE_USD, Math.round(n)));
}
