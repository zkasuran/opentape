// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import { describe, expect, it } from "vitest";
import {
  BSTOCK_PAIRS,
  binanceAdapter,
  bstockSymbolFor,
  buildBuyQuote,
  DEPTH_LIMIT,
  parseDepth,
  TAKER_FEE_BPS,
  walkBook,
  type DepthLevel,
} from "../src/adapters/binance";

// A small deterministic ask book (best-first). Total visible notional = 200 + 303 + 510 = 1013 USD.
const ASKS: DepthLevel[] = [
  { price: 100, qty: 2 }, // 200 USD
  { price: 101, qty: 3 }, // 303 USD
  { price: 102, qty: 5 }, // 510 USD
];

describe("binance adapter — symbol mapping", () => {
  it("maps the tracked underlyings to their verified bStock pairs", () => {
    expect(bstockSymbolFor("AAPL")).toBe("AAPLBUSDT");
    expect(bstockSymbolFor("TSLA")).toBe("TSLABUSDT");
    expect(bstockSymbolFor("NVDA")).toBe("NVDABUSDT");
    expect(bstockSymbolFor("SPY")).toBe("SPYBUSDT");
    expect(bstockSymbolFor("GOOGL")).toBe("GOOGLBUSDT");
    expect(bstockSymbolFor("META")).toBe("METABUSDT");
  });

  it("is case-insensitive and returns undefined for unknown underlyings", () => {
    expect(bstockSymbolFor("aapl")).toBe("AAPLBUSDT");
    expect(bstockSymbolFor("DOGE")).toBeUndefined();
    expect(bstockSymbolFor("")).toBeUndefined();
  });

  it("every mapped pair follows the <TICKER>B + USDT bStock format", () => {
    for (const [under, sym] of Object.entries(BSTOCK_PAIRS)) {
      expect(sym).toBe(`${under}BUSDT`);
    }
  });

  it("supports() only returns true for a known pair", async () => {
    await expect(binanceAdapter.supports("NVDA")).resolves.toBe(true);
    await expect(binanceAdapter.supports("DOGE")).resolves.toBe(false);
  });
});

describe("binance adapter — depth-walk math", () => {
  it("computes the executable average price across levels for a full fill", () => {
    const w = walkBook(ASKS, 400);
    // 200 USD fills level 1 (2 units @100), remaining 200 USD buys 200/101 units of level 2.
    const partialQty = 200 / 101;
    expect(w.fullyFilled).toBe(true);
    expect(w.baseQty).toBeCloseTo(2 + partialQty, 10);
    expect(w.filledUsd).toBeCloseTo(400, 10);
    expect(w.avgPx).toBeCloseTo(400 / (2 + partialQty), 10);
    expect(w.bestPx).toBe(100);
    // slippage vs the 100 touch price
    expect(w.priceImpactBps).toBeCloseTo((w.avgPx / 100 - 1) * 1e4, 8);
    expect(w.priceImpactBps).toBeGreaterThan(0);
  });

  it("marks a partial fill when size exceeds visible depth", () => {
    const w = walkBook(ASKS, 2000); // book only holds 1013 USD
    expect(w.fullyFilled).toBe(false);
    expect(w.baseQty).toBeCloseTo(10, 10); // 2 + 3 + 5
    expect(w.filledUsd).toBeCloseTo(1013, 10);
    expect(w.avgPx).toBeCloseTo(1013 / 10, 10);
  });

  it("has near-zero impact for a dust order at the touch", () => {
    const w = walkBook(ASKS, 1); // 1 USD, well inside level 1
    expect(w.fullyFilled).toBe(true);
    expect(w.avgPx).toBeCloseTo(100, 10);
    expect(w.priceImpactBps).toBeCloseTo(0, 8);
  });

  it("returns an empty walk for degenerate inputs", () => {
    expect(walkBook([], 1000).avgPx).toBe(0);
    expect(walkBook(ASKS, 0).avgPx).toBe(0);
    expect(walkBook(ASKS, -5).avgPx).toBe(0);
    expect(walkBook(ASKS, Number.NaN).avgPx).toBe(0);
  });
});

describe("binance adapter — quote construction", () => {
  it("builds an honest CEX bStock quote from the ask side", () => {
    const q = buildBuyQuote("AAPL", "AAPLBUSDT", ASKS, 400);
    expect(q).toBeDefined();
    if (!q) return;
    expect(q.venueId).toBe("binance:AAPLBUSDT");
    expect(q.venueKind).toBe("cex");
    expect(q.issuer).toBe("bstocks");
    expect(q.symbol).toBe("AAPL");
    expect(q.sizeUsd).toBe(400);
    expect(q.pxPerExposureUsd).toBeCloseTo(400 / (2 + 200 / 101), 10);
    expect(q.gasUsd).toBe(0); // CEX: no gas
    expect(q.feeUsd).toBeCloseTo((400 * TAKER_FEE_BPS) / 1e4, 10); // 0.10% taker on filled notional
    expect(q.executable).toBe(true);
    expect(q.kycGated).toBe(false);
    expect(q.priceImpactBps).toBeGreaterThan(0);
    expect(q.ts).toBeGreaterThan(0);
    expect(q.source).toContain("depth");
  });

  it("flags executable=false when the book cannot fill the size", () => {
    const q = buildBuyQuote("AAPL", "AAPLBUSDT", ASKS, 2000);
    expect(q).toBeDefined();
    if (!q) return;
    expect(q.executable).toBe(false);
    expect(q.pxPerExposureUsd).toBeCloseTo(1013 / 10, 10);
  });

  it("returns undefined for an empty book", () => {
    expect(buildBuyQuote("AAPL", "AAPLBUSDT", [], 400)).toBeUndefined();
  });
});

describe("binance adapter — depth parsing", () => {
  it("parses a well-formed depth payload and drops junk levels", () => {
    const parsed = parseDepth({
      lastUpdateId: 1,
      bids: [["99.5", "1"], ["bad", "1"], ["0", "5"]],
      asks: [["100", "2"], ["101", "3"]],
    });
    expect(parsed).toBeDefined();
    if (!parsed) return;
    expect(parsed.asks).toEqual([
      { price: 100, qty: 2 },
      { price: 101, qty: 3 },
    ]);
    // "bad" and the zero-price level are dropped; only 99.5 survives.
    expect(parsed.bids).toEqual([{ price: 99.5, qty: 1 }]);
  });

  it("rejects malformed payloads", () => {
    expect(parseDepth(null)).toBeUndefined();
    expect(parseDepth({ asks: [["100", "1"]] })).toBeUndefined(); // no bids
    expect(parseDepth("nope")).toBeUndefined();
  });
});

describe("binance adapter — quotes() network path (offline-safe)", () => {
  it("returns [] for an unsupported symbol without touching the network", async () => {
    await expect(binanceAdapter.quotes("DOGE", 1000)).resolves.toEqual([]);
  });

  it("returns [] for a non-positive size", async () => {
    await expect(binanceAdapter.quotes("AAPL", 0)).resolves.toEqual([]);
  });

  // Live smoke test against the real public depth endpoint. Skips (never fails) when offline,
  // rate-limited, or the pair returns no book, so a network hiccup cannot make the gate red.
  it(
    "live: walks the real bStock book for NVDA when reachable",
    { timeout: 30000 },
    async (ctx) => {
      let quotes: Awaited<ReturnType<typeof binanceAdapter.quotes>> = [];
      try {
        quotes = await binanceAdapter.quotes("NVDA", 5000);
      } catch {
        quotes = [];
      }
      ctx.skip(quotes.length === 0, "Binance public API unreachable or empty book (offline-safe skip)");

      const q = quotes[0];
      expect(q).toBeDefined();
      if (!q) return;
      expect(q.venueId).toBe("binance:NVDABUSDT");
      expect(q.venueKind).toBe("cex");
      expect(q.issuer).toBe("bstocks");
      expect(q.symbol).toBe("NVDA");
      expect(q.pxPerExposureUsd).toBeGreaterThan(0);
      expect(q.gasUsd).toBe(0);
      expect(q.feeUsd).toBeGreaterThan(0);
      expect(q.priceImpactBps).toBeGreaterThanOrEqual(0);
      expect(q.kycGated).toBe(false);
    },
  );
});

describe("binance adapter — constants", () => {
  it("uses the documented taker fee and depth limit", () => {
    expect(TAKER_FEE_BPS).toBe(10);
    expect([5, 10, 20, 50, 100, 500, 1000, 5000]).toContain(DEPTH_LIMIT);
  });
});
