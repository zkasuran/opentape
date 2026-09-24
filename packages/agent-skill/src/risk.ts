// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import type { BestExecution, Quote } from "@opentape/sdk";

export interface GateResult {
  ok: boolean;
}

export interface RiskAssessment {
  allowed: boolean;
  // One human-readable line per failed gate. Empty when allowed.
  reasons: string[];
  gates: {
    notional: GateResult & { sizeUsd: number; maxNotionalUsd: number };
    slippage: GateResult & { observedBps: number; maxSlippageBps: number };
    // A route a permissionless wallet can actually fill: executable and not KYC-gated.
    kyc: GateResult & { hasOpenRoute: boolean };
  };
}

export interface RiskLimits {
  sizeUsd: number;
  maxSlippageBps: number;
  maxNotionalUsd: number;
}

// True when at least one ranked route is executable and not KYC-gated, so a
// permissionless wallet has somewhere to fill the order.
function hasOpenRoute(ranked: Quote[]): boolean {
  return ranked.some((q) => q.executable && !q.kycGated);
}

/**
 * Evaluate every risk gate against a best-execution result. All gates run (no
 * short-circuit) so a caller sees every reason a size was blocked, not just the
 * first. Slippage is measured on the recommended route's price impact.
 */
export function assessRisk(be: BestExecution, limits: RiskLimits): RiskAssessment {
  const observedBps = Math.max(0, be.best.priceImpactBps);
  const notionalOk = limits.sizeUsd <= limits.maxNotionalUsd;
  const slippageOk = observedBps <= limits.maxSlippageBps;
  const openRoute = hasOpenRoute(be.ranked);

  const reasons: string[] = [];
  if (!notionalOk) {
    reasons.push(
      `Size $${limits.sizeUsd} exceeds the notional cap of $${limits.maxNotionalUsd}.`,
    );
  }
  if (!slippageOk) {
    reasons.push(
      `Best route price impact ${observedBps.toFixed(1)} bps exceeds the max slippage of ${limits.maxSlippageBps} bps.`,
    );
  }
  if (!openRoute) {
    reasons.push(
      "The only available route is KYC-gated or non-executable, so a permissionless wallet cannot fill this order.",
    );
  }

  return {
    allowed: notionalOk && slippageOk && openRoute,
    reasons,
    gates: {
      notional: { ok: notionalOk, sizeUsd: limits.sizeUsd, maxNotionalUsd: limits.maxNotionalUsd },
      slippage: { ok: slippageOk, observedBps, maxSlippageBps: limits.maxSlippageBps },
      kyc: { ok: openRoute, hasOpenRoute: openRoute },
    },
  };
}
