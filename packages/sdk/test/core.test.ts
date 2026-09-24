// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import { beforeEach, describe, expect, it, vi } from "vitest";

// Keep the core tests off the network: stub the Chainlink fair value with a fixed fixture.
// The engine imports getFairValue from this same module, so the mock covers it too.
vi.mock("../src/fairvalue/chainlink", () => ({
  getFairValue: vi.fn(async (symbol: string) => ({
    symbol,
    usd: 200,
    confBps: 5,
    ts: 1_700_000_000_000,
    source: "fixture",
  })),
}));

import { computeArb } from "../src/core/arb";
import { getArbSpread, getBestExecution, getConsolidatedTape } from "../src/core/engine";
import { normalizeQuotes } from "../src/core/normalize";
import { buildBestExecution, rankQuotes } from "../src/core/rank";
import { buildTape } from "../src/core/tape";
import { clearAdapters, registerAdapter } from "../src/registry";
import type { FairValue, Quote, VenueAdapter } from "../src/types";

const FAIR: FairValue = { symbol: "AAPL", usd: 200, confBps: 5, ts: 1_700_000_000_000, source: "fixture" };

type QuoteSeed = Partial<Quote> & Pick<Quote, "venueId" | "issuer" | "pxPerExposureUsd">;

function q(seed: QuoteSeed): Quote {
  return {
    venueKind: "dex",
    symbol: "AAPL",
    sizeUsd: 10_000,
    feeUsd: 0,
    gasUsd: 0,
    priceImpactBps: 0,
    executable: true,
    kycGated: false,
    ts: 1_700_000_000_000,
    source: "fixture",
    ...seed,
  };
}

function fakeAdapter(id: string, quotes: Quote[]): VenueAdapter {
  return {
    id,
    async supports() {
      return true;
    },
    async quotes() {
      return quotes;
    },
  };
}

beforeEach(() => {
  clearAdapters();
});

describe("rankQuotes: total landed cost, not raw price", () => {
  it("ranks by base price plus impact plus amortized fee and gas", () => {
    const quotes = [
      q({ venueId: "a", issuer: "xstocks", pxPerExposureUsd: 201 }), // landed 201.00
      q({ venueId: "b", issuer: "bstocks", pxPerExposureUsd: 200, priceImpactBps: 100 }), // landed 202.00
      q({ venueId: "c", issuer: "ondo", pxPerExposureUsd: 199.5, feeUsd: 60 }), // landed 200.697
    ];
    expect(rankQuotes(quotes).map((x) => x.venueId)).toEqual(["c", "a", "b"]);
  });
});

describe("normalizeQuotes: issuer multiplier and fair-value hygiene", () => {
  it("divides a non-1:1 issuer token by its exposure multiplier", () => {
    const n = normalizeQuotes(
      [q({ venueId: "ondo:x", issuer: "ondo", pxPerExposureUsd: 400 })],
      FAIR,
      { ondo: 2 },
    );
    expect(n).toHaveLength(1);
    expect(n[0]?.pxPerExposureUsd).toBe(200);
    expect(n[0]?.issuer).toBe("ondo");
  });

  it("drops non-positive prices and broken feeds far off fair value", () => {
    const n = normalizeQuotes(
      [
        q({ venueId: "ok", issuer: "xstocks", pxPerExposureUsd: 201 }),
        q({ venueId: "zero", issuer: "bstocks", pxPerExposureUsd: 0 }),
        q({ venueId: "broken", issuer: "bstocks", pxPerExposureUsd: 5000 }), // > 20x fair
      ],
      FAIR,
    );
    expect(n.map((x) => x.venueId)).toEqual(["ok"]);
  });
});

describe("buildTape: premium, best offer, best bid", () => {
  it("prices premium of the best offer vs fair value and finds the best bid", () => {
    const quotes = [
      q({ venueId: "o1", issuer: "xstocks", pxPerExposureUsd: 202 }),
      q({ venueId: "o2", issuer: "bstocks", pxPerExposureUsd: 205 }),
      q({ venueId: "o3", issuer: "ondo", pxPerExposureUsd: 210 }),
    ];
    const tape = buildTape("AAPL", quotes, FAIR);
    expect(tape.bestOffer.venueId).toBe("o1");
    expect(tape.premiumBps).toBeCloseTo(100, 6); // (202 - 200) / 200
    expect(tape.bestBid?.venueId).toBe("o3"); // dearest realizable sell
    expect(tape.quotes).toHaveLength(3);
  });
});

describe("engine.getConsolidatedTape: adapters + fair value", () => {
  it("consolidates registered adapters into one tape row", async () => {
    registerAdapter(
      fakeAdapter("dex", [
        q({ venueId: "o1", issuer: "xstocks", pxPerExposureUsd: 202 }),
        q({ venueId: "o2", issuer: "bstocks", pxPerExposureUsd: 210 }),
      ]),
    );
    const tape = await getConsolidatedTape("AAPL");
    expect(tape.fairValue.usd).toBe(200);
    expect(tape.bestOffer.venueId).toBe("o1");
    expect(tape.premiumBps).toBeCloseTo(100, 6);
    expect(tape.bestBid?.venueId).toBe("o2");
  });
});

describe("engine.getBestExecution: ranking and savings", () => {
  it("recommends the cheapest route and reports savings vs worst", async () => {
    registerAdapter(
      fakeAdapter("dex", [
        q({ venueId: "cheap", issuer: "xstocks", pxPerExposureUsd: 200 }),
        q({ venueId: "dear", issuer: "bstocks", pxPerExposureUsd: 210 }),
      ]),
    );
    const be = await getBestExecution("AAPL", 5000);
    expect(be.symbol).toBe("AAPL");
    expect(be.sizeUsd).toBe(5000);
    expect(be.best.venueId).toBe("cheap");
    expect(be.ranked).toHaveLength(2);
    expect(be.savingsBpsVsWorst).toBeCloseTo(476.19, 2); // (210 - 200) / 210
  });

  it("recommends the cheapest EXECUTABLE route, not a gated cheaper one", async () => {
    registerAdapter(
      fakeAdapter("dex", [
        q({ venueId: "gated", issuer: "ondo", pxPerExposureUsd: 198, kycGated: true }),
        q({ venueId: "open", issuer: "xstocks", pxPerExposureUsd: 200 }),
      ]),
    );
    const be = await getBestExecution("AAPL", 10_000);
    expect(be.ranked[0]?.venueId).toBe("gated"); // cheapest by cost order
    expect(be.best.venueId).toBe("open"); // but the recommended route is executable
    expect(be.best.kycGated).toBe(false);
  });

  it("rejects when no venue quotes the symbol", async () => {
    await expect(getBestExecution("AAPL", 10_000)).rejects.toThrow(/no quotes/);
  });
});

describe("engine.getArbSpread and computeArb: signal, honest gating", () => {
  it("marks the spread non-executable when the sell leg is KYC-gated", async () => {
    registerAdapter(
      fakeAdapter("mix", [
        q({ venueId: "buy", issuer: "xstocks", pxPerExposureUsd: 200 }),
        q({
          venueId: "ondo:redeem",
          issuer: "ondo",
          venueKind: "issuer",
          pxPerExposureUsd: 220,
          executable: true,
          kycGated: true,
        }),
      ]),
    );
    const arb = await getArbSpread("AAPL");
    expect(arb.buy.venueId).toBe("buy");
    expect(arb.sell.venueId).toBe("ondo:redeem");
    expect(arb.grossBps).toBeCloseTo(1000, 6); // (220 - 200) / 200
    expect(arb.executable).toBe(false);
    expect(arb.notes.some((n) => n.includes("KYC-gated"))).toBe(true);
  });

  it("reports an executable spread when both legs are open", () => {
    const arb = computeArb("AAPL", [
      q({ venueId: "buy", issuer: "xstocks", pxPerExposureUsd: 200 }),
      q({ venueId: "sell", issuer: "bstocks", pxPerExposureUsd: 210 }),
    ]);
    expect(arb.executable).toBe(true);
    expect(arb.grossBps).toBeCloseTo(500, 6); // (210 - 200) / 200
    expect(arb.netBps).toBeCloseTo(500, 6);
    expect(arb.notes.length).toBeGreaterThan(0); // always states arb is a signal
  });

  it("throws on an empty quote set", () => {
    expect(() => computeArb("AAPL", [])).toThrow(/no quotes/);
  });
});
