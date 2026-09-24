// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import type { ArbSpread, BestExecution, IssuerId, Quote, VenueKind } from "@opentape/sdk";
import { assessRisk, type RiskAssessment } from "./risk";
import type { SkillInput } from "./schema";

// A read-only advisor. It never custodies funds or places orders. It reports
// cross-issuer arb as a signal because redemption is gated. This line ships with
// every recommendation.
export const DISCLAIMER =
  "OpenTape is a read-only best-execution advisor. It does not custody funds or place orders. Arbitrage is reported as a signal, not a captured trade, because cross-issuer redemption for tokenized stocks is gated by KYC or institutional access. Figures are estimates from live venue reads and can move before you act. This is not financial advice.";

export interface RouteView {
  venueId: string;
  venueKind: VenueKind;
  issuer: IssuerId;
  tokenAddress?: string;
  pxPerExposureUsd: number;
  priceImpactBps: number;
  feeUsd: number;
  gasUsd: number;
  executable: boolean;
  kycGated: boolean;
  source: string;
}

export interface ArbView {
  present: boolean;
  grossBps: number;
  netBps: number;
  buyVenueId: string;
  sellVenueId: string;
  // True only when both legs are executable and neither is KYC-gated. When false,
  // the spread is a signal a permissionless wallet cannot close, never a profit.
  capturable: boolean;
  notes: string[];
}

export interface Recommendation {
  symbol: string;
  sizeUsd: number;
  decision: "allowed" | "blocked";
  reasons: string[];
  bestRoute: RouteView;
  referenceUsd: number;
  // Best route price versus the underlying reference, signed. Positive is a premium.
  premiumBps: number;
  savingsBpsVsWorst: number;
  routesConsidered: number;
  arb: ArbView;
  risk: RiskAssessment;
  disclaimer: string;
  generatedAt: number;
}

function toRouteView(q: Quote): RouteView {
  return {
    venueId: q.venueId,
    venueKind: q.venueKind,
    issuer: q.issuer,
    tokenAddress: q.tokenAddress,
    pxPerExposureUsd: q.pxPerExposureUsd,
    priceImpactBps: q.priceImpactBps,
    feeUsd: q.feeUsd,
    gasUsd: q.gasUsd,
    executable: q.executable,
    kycGated: q.kycGated,
    source: q.source,
  };
}

function toArbView(arb: ArbSpread | null): ArbView {
  if (!arb) {
    return {
      present: false,
      grossBps: 0,
      netBps: 0,
      buyVenueId: "",
      sellVenueId: "",
      capturable: false,
      notes: ["No cross-venue spread available for this symbol."],
    };
  }
  // Never let a positive spread read as capturable when redemption is gated.
  const capturable = arb.executable && arb.grossBps > 0;
  const notes = arb.notes.slice();
  if (!capturable && arb.grossBps > 0) {
    notes.unshift(
      "Signal only: this spread cannot be captured by a permissionless wallet because a leg is KYC-gated or non-executable.",
    );
  }
  return {
    present: true,
    grossBps: arb.grossBps,
    netBps: arb.netBps,
    buyVenueId: arb.buy.venueId,
    sellVenueId: arb.sell.venueId,
    capturable,
    notes,
  };
}

/**
 * Shape a best-execution result and an optional arb signal into one structured,
 * risk-gated recommendation. Pure over its inputs.
 */
export function buildRecommendation(
  input: SkillInput,
  be: BestExecution,
  arb: ArbSpread | null,
): Recommendation {
  const referenceUsd = be.fairValue.usd;
  const premiumBps =
    referenceUsd > 0 ? ((be.best.pxPerExposureUsd - referenceUsd) / referenceUsd) * 10_000 : 0;
  const risk = assessRisk(be, {
    sizeUsd: input.sizeUsd,
    maxSlippageBps: input.maxSlippageBps,
    maxNotionalUsd: input.maxNotionalUsd,
  });

  return {
    symbol: input.symbol,
    sizeUsd: input.sizeUsd,
    decision: risk.allowed ? "allowed" : "blocked",
    reasons: risk.reasons,
    bestRoute: toRouteView(be.best),
    referenceUsd,
    premiumBps,
    savingsBpsVsWorst: be.savingsBpsVsWorst,
    routesConsidered: be.ranked.length,
    arb: toArbView(arb),
    risk,
    disclaimer: DISCLAIMER,
    generatedAt: Math.max(be.fairValue.ts, be.best.ts),
  };
}
