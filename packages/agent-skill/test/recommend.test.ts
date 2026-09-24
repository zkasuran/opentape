// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import { describe, expect, it } from "vitest";
import type { ArbSpread, BestExecution } from "@opentape/sdk";
import { buildRecommendation } from "../src/recommend";
import { skillInputSchema } from "../src/schema";
import { runSkill, type SkillDeps } from "../src/skill";
import { mkArb, mkBE, mkQuote } from "./helpers";

// A fake SDK: no network, no live adapters. Returns whatever fixtures we hand it.
function fakeDeps(be: BestExecution, arb: ArbSpread | Error | null): SkillDeps {
  return {
    async getBestExecution() {
      return be;
    },
    async getArbSpread() {
      if (arb instanceof Error) throw arb;
      if (arb === null) throw new Error("no quotes");
      return arb;
    },
  };
}

const openBest = mkQuote({
  venueId: "pancakeswap:v3",
  issuer: "xstocks",
  pxPerExposureUsd: 200.4,
  priceImpactBps: 20,
});
const dearer = mkQuote({ venueId: "binance", issuer: "bstocks", pxPerExposureUsd: 210, priceImpactBps: 8 });

const capturableArb = mkArb({
  buy: openBest,
  sell: dearer,
  grossBps: 480,
  netBps: 460,
  executable: true,
  notes: ["Arb is a signal, not a captured trade."],
});

describe("buildRecommendation: shaping", () => {
  const be = mkBE({ best: openBest, ranked: [openBest, dearer], fairUsd: 200, savingsBpsVsWorst: 457 });
  const input = skillInputSchema.parse({ symbol: "AAPL", sizeUsd: 5_000 });

  it("carries the best route, reference, premium and savings", () => {
    const rec = buildRecommendation(input, be, capturableArb);
    expect(rec.decision).toBe("allowed");
    expect(rec.bestRoute.venueId).toBe("pancakeswap:v3");
    expect(rec.referenceUsd).toBe(200);
    expect(rec.premiumBps).toBeCloseTo(20, 6); // (200.4 - 200) / 200
    expect(rec.savingsBpsVsWorst).toBe(457);
    expect(rec.routesConsidered).toBe(2);
    expect(rec.disclaimer).toMatch(/signal, not a captured trade/);
  });

  it("marks a gated spread as a signal, never capturable", () => {
    const gatedArb = mkArb({
      buy: openBest,
      sell: mkQuote({ venueId: "ondo:redeem", issuer: "ondo", venueKind: "issuer", pxPerExposureUsd: 216, kycGated: true }),
      grossBps: 780,
      netBps: 760,
      executable: false,
      notes: ["Sell or redeem leg ondo:redeem (ondo) is KYC-gated."],
    });
    const rec = buildRecommendation(input, be, gatedArb);
    expect(rec.arb.capturable).toBe(false);
    expect(rec.arb.grossBps).toBe(780);
    expect(rec.arb.notes.some((n) => n.startsWith("Signal only"))).toBe(true);
  });

  it("reports a capturable spread when both legs are open with a positive gross", () => {
    const rec = buildRecommendation(input, be, capturableArb);
    expect(rec.arb.capturable).toBe(true);
  });

  it("handles a missing arb signal", () => {
    const rec = buildRecommendation(input, be, null);
    expect(rec.arb.present).toBe(false);
    expect(rec.arb.capturable).toBe(false);
  });
});

describe("runSkill: end to end with a fake SDK", () => {
  it("allowed: open route within limits", async () => {
    const be = mkBE({ best: openBest, ranked: [openBest, dearer], savingsBpsVsWorst: 457 });
    const rec = await runSkill({ symbol: "aapl", sizeUsd: 5_000 }, fakeDeps(be, capturableArb));
    expect(rec.symbol).toBe("AAPL"); // uppercased by the schema
    expect(rec.decision).toBe("allowed");
    expect(rec.reasons).toHaveLength(0);
  });

  it("blocked by notional", async () => {
    const be = mkBE({ best: openBest, ranked: [openBest] });
    const rec = await runSkill({ symbol: "AAPL", sizeUsd: 50_000 }, fakeDeps(be, capturableArb));
    expect(rec.decision).toBe("blocked");
    expect(rec.risk.gates.notional.ok).toBe(false);
    expect(rec.reasons.some((r) => r.includes("notional cap"))).toBe(true);
  });

  it("blocked by slippage", async () => {
    const wide = mkQuote({ venueId: "pcs", issuer: "xstocks", pxPerExposureUsd: 201, priceImpactBps: 300 });
    const be = mkBE({ best: wide, ranked: [wide] });
    const rec = await runSkill(
      { symbol: "AAPL", sizeUsd: 5_000, maxSlippageBps: 50 },
      fakeDeps(be, capturableArb),
    );
    expect(rec.decision).toBe("blocked");
    expect(rec.risk.gates.slippage.ok).toBe(false);
    expect(rec.reasons.some((r) => r.includes("price impact"))).toBe(true);
  });

  it("blocked by KYC when the only route is gated", async () => {
    const gated = mkQuote({
      venueId: "ondo:redeem",
      issuer: "ondo",
      venueKind: "issuer",
      pxPerExposureUsd: 199,
      kycGated: true,
    });
    const be = mkBE({ best: gated, ranked: [gated] });
    const rec = await runSkill({ symbol: "AAPL", sizeUsd: 5_000 }, fakeDeps(be, null));
    expect(rec.decision).toBe("blocked");
    expect(rec.risk.gates.kyc.ok).toBe(false);
    expect(rec.arb.present).toBe(false); // getArbSpread rejected, handled best-effort
  });
});
