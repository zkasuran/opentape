// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FairValue } from "../src/types";
import {
  ondoAdapter,
  ondoNav,
  ondoNavFromApi,
  resetOndoConfig,
  setOndoApiKey,
  setOndoFairValueProvider,
  setOndoMultiplier,
} from "../src/adapters/ondo";

const fv = (usd: number): FairValue => ({
  symbol: "AAPL",
  usd,
  confBps: 5,
  ts: 1_700_000_000_000,
  source: "test-fixture",
});

afterEach(() => {
  resetOndoConfig();
});

describe("ondo NAV / multiplier math (deterministic)", () => {
  it("token price = underlying * shares-per-token, per-exposure divides it back out", () => {
    // Docs example: 1.05 shares per token * $110 underlying = $115.50 token NAV.
    const nav = ondoNav({ underlyingUsd: 110, sharesPerToken: 1.05 });
    expect(nav.tokenPriceUsd).toBeCloseTo(115.5, 10);
    expect(nav.pxPerExposureUsd).toBeCloseTo(110, 10);
  });

  it("keeps 1 token distinct from 1 share once dividends reinvest", () => {
    // Ex-dividend case from the docs: shares per token grows to 1.05263158.
    const nav = ondoNav({ underlyingUsd: 95, sharesPerToken: 1.05263158 });
    expect(nav.tokenPriceUsd).toBeCloseTo(100, 4);
    expect(nav.pxPerExposureUsd).toBeCloseTo(95, 6);
    expect(nav.tokenPriceUsd).not.toBeCloseTo(nav.underlyingUsd, 1);
  });

  it("derives the multiplier and NAV par from the prices/latest response", () => {
    const nav = ondoNavFromApi({
      primaryMarket: { symbol: "AAPLon", price: "115.50" },
      underlyingMarket: { ticker: "AAPL", price: "110" },
      timestamp: 1_746_655_938,
    });
    expect(nav.sharesPerToken).toBeCloseTo(1.05, 10);
    expect(nav.tokenPriceUsd).toBeCloseTo(115.5, 10);
    // Ondo primary market is par to NAV, so per-exposure equals the underlying price.
    expect(nav.pxPerExposureUsd).toBeCloseTo(110, 10);
  });
});

describe("ondoAdapter (approx path, no network)", () => {
  beforeEach(() => {
    setOndoApiKey(null); // force approx mode regardless of any ONDO_API_KEY in the environment
  });

  it("emits an honest NAV-reference quote from injected fair value", async () => {
    setOndoFairValueProvider(async () => fv(200));
    const quotes = await ondoAdapter.quotes("AAPL", 5000);
    expect(quotes).toHaveLength(1);
    const q = quotes[0]!;
    expect(q.venueKind).toBe("issuer");
    expect(q.issuer).toBe("ondo");
    expect(q.kycGated).toBe(true);
    expect(q.executable).toBe(false);
    expect(q.priceImpactBps).toBe(0);
    expect(q.feeUsd).toBe(0);
    expect(q.gasUsd).toBe(0);
    expect(q.sizeUsd).toBe(5000);
    expect(q.pxPerExposureUsd).toBeCloseTo(200, 10);
    expect(q.source.startsWith("ondo-nav-approx")).toBe(true);
    expect(q.venueId).toBe("ondo:nav:AAPL");
    expect(q.tokenAddress).toBeUndefined();
  });

  it("applies a configured multiplier to the token NAV but keeps per-exposure at fair value", async () => {
    setOndoFairValueProvider(async () => fv(100));
    setOndoMultiplier("AAPL", 1.05);
    const q = (await ondoAdapter.quotes("AAPL", 1000))[0]!;
    expect(q.pxPerExposureUsd).toBeCloseTo(100, 10); // multiplier cancels for the per-exposure anchor
    expect(q.source).toContain("mult=1.05");
  });

  it("case-folds the symbol before matching the catalog", async () => {
    setOndoFairValueProvider(async () => fv(150));
    const quotes = await ondoAdapter.quotes("aapl", 1000);
    expect(quotes).toHaveLength(1);
    expect(quotes[0]!.symbol).toBe("AAPL");
  });

  it("supports tracked underlyings and rejects unknown symbols", async () => {
    expect(await ondoAdapter.supports("AAPL")).toBe(true);
    expect(await ondoAdapter.supports("DOGE")).toBe(false);
    expect(await ondoAdapter.quotes("DOGE", 1000)).toEqual([]);
  });

  it("returns no quote and never throws when fair value is unavailable", async () => {
    setOndoFairValueProvider(async () => {
      throw new Error("fair value source down");
    });
    await expect(ondoAdapter.quotes("AAPL", 1000)).resolves.toEqual([]);
  });
});

// Optional live test. Runs only when ONDO_API_KEY is set; a network failure must not turn the gate red.
const liveKey = process.env.ONDO_API_KEY;
describe.skipIf(!liveKey)("ondoAdapter (live GM API)", () => {
  it("fetches a real NAV reference for AAPL", async () => {
    let quotes: Awaited<ReturnType<typeof ondoAdapter.quotes>>;
    try {
      quotes = await ondoAdapter.quotes("AAPL", 1000);
    } catch {
      return; // unreachable network is not a test failure
    }
    if (quotes.length === 0) return; // 404 / unsupported symbol is not a test failure
    const q = quotes[0]!;
    expect(q.source).toBe("ondo-gm-api");
    expect(q.pxPerExposureUsd).toBeGreaterThan(0);
    expect(q.kycGated).toBe(true);
    expect(q.executable).toBe(false);
  });
});
