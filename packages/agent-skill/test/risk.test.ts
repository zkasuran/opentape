// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import { describe, expect, it } from "vitest";
import { assessRisk } from "../src/risk";
import { mkBE, mkQuote } from "./helpers";

const LIMITS = { sizeUsd: 5_000, maxSlippageBps: 100, maxNotionalUsd: 25_000 };

describe("assessRisk: risk gates", () => {
  it("allows an open route within notional and slippage", () => {
    const be = mkBE({
      best: mkQuote({ venueId: "pcs", issuer: "xstocks", pxPerExposureUsd: 200.4, priceImpactBps: 20 }),
      ranked: [
        mkQuote({ venueId: "pcs", issuer: "xstocks", pxPerExposureUsd: 200.4, priceImpactBps: 20 }),
        mkQuote({ venueId: "bin", issuer: "bstocks", pxPerExposureUsd: 201.2, priceImpactBps: 8 }),
      ],
    });
    const r = assessRisk(be, LIMITS);
    expect(r.allowed).toBe(true);
    expect(r.reasons).toHaveLength(0);
    expect(r.gates.notional.ok).toBe(true);
    expect(r.gates.slippage.ok).toBe(true);
    expect(r.gates.kyc.ok).toBe(true);
  });

  it("blocks when size exceeds the notional cap", () => {
    const be = mkBE({
      best: mkQuote({ venueId: "pcs", issuer: "xstocks", pxPerExposureUsd: 200, priceImpactBps: 10 }),
    });
    const r = assessRisk(be, { ...LIMITS, sizeUsd: 50_000 });
    expect(r.allowed).toBe(false);
    expect(r.gates.notional.ok).toBe(false);
    expect(r.reasons.some((x) => x.includes("notional cap"))).toBe(true);
  });

  it("blocks when best-route price impact exceeds max slippage", () => {
    const be = mkBE({
      best: mkQuote({ venueId: "pcs", issuer: "xstocks", pxPerExposureUsd: 200, priceImpactBps: 250 }),
    });
    const r = assessRisk(be, LIMITS);
    expect(r.allowed).toBe(false);
    expect(r.gates.slippage.ok).toBe(false);
    expect(r.gates.slippage.observedBps).toBe(250);
    expect(r.reasons.some((x) => x.includes("price impact"))).toBe(true);
  });

  it("blocks when the only route is KYC-gated", () => {
    const gated = mkQuote({
      venueId: "ondo:redeem",
      issuer: "ondo",
      venueKind: "issuer",
      pxPerExposureUsd: 199,
      kycGated: true,
    });
    const be = mkBE({ best: gated, ranked: [gated] });
    const r = assessRisk(be, LIMITS);
    expect(r.allowed).toBe(false);
    expect(r.gates.kyc.ok).toBe(false);
    expect(r.gates.kyc.hasOpenRoute).toBe(false);
    expect(r.reasons.some((x) => x.includes("KYC-gated"))).toBe(true);
  });

  it("blocks when the only route is non-executable", () => {
    const dead = mkQuote({
      venueId: "pcs:stale",
      issuer: "xstocks",
      pxPerExposureUsd: 200,
      executable: false,
    });
    const r = assessRisk(mkBE({ best: dead, ranked: [dead] }), LIMITS);
    expect(r.allowed).toBe(false);
    expect(r.gates.kyc.ok).toBe(false);
  });

  it("reports every failed gate, not just the first", () => {
    const be = mkBE({
      best: mkQuote({ venueId: "pcs", issuer: "xstocks", pxPerExposureUsd: 200, priceImpactBps: 400 }),
    });
    const r = assessRisk(be, { sizeUsd: 90_000, maxSlippageBps: 50, maxNotionalUsd: 10_000 });
    expect(r.allowed).toBe(false);
    expect(r.reasons.length).toBeGreaterThanOrEqual(2);
  });
});
