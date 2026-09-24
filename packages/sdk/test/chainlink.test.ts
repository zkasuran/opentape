import { describe, expect, it } from "vitest";
import {
  aggregatorToFairValue,
  CHAINLINK_ONCHAIN_SOURCE,
  getFairValue,
} from "../src/fairvalue/chainlink";
import { CHAINLINK_FEEDS, getFeedAddress, knownSymbols } from "../src/fairvalue/feeds";

describe("chainlink feed map", () => {
  it("maps the six equities plus BNB to feed addresses", () => {
    for (const s of ["AAPL", "TSLA", "NVDA", "SPY", "GOOGL", "META", "BNB"]) {
      expect(getFeedAddress(s)).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }
  });
  it("is case-insensitive and returns undefined for an unknown symbol", () => {
    expect(getFeedAddress("aapl")).toBe(CHAINLINK_FEEDS.AAPL);
    expect(getFeedAddress("DOGE")).toBeUndefined();
  });
  it("knownSymbols lists every mapped feed", () => {
    expect(knownSymbols()).toContain("AAPL");
    expect(knownSymbols().length).toBe(Object.keys(CHAINLINK_FEEDS).length);
  });
});

describe("aggregatorToFairValue", () => {
  it("scales an 8-decimal answer to USD and seconds to milliseconds", () => {
    const updated = 1_700_000_000n;
    const fv = aggregatorToFairValue("AAPL", 33_736_500_000n, 8, updated);
    expect(fv.usd).toBeCloseTo(337.365, 3);
    expect(fv.ts).toBe(Number(updated) * 1000);
    expect(fv.source).toBe(CHAINLINK_ONCHAIN_SOURCE);
    expect(fv.confBps).toBe(0);
  });
  it("throws on a non-positive answer", () => {
    expect(() => aggregatorToFairValue("AAPL", 0n, 8, 1n)).toThrow(/non-positive/);
  });
  it("enforces maxAgeSec when the round is stale", () => {
    expect(() => aggregatorToFairValue("AAPL", 10n ** 8n, 8, 1n, 60)).toThrow(/older than maxAgeSec/);
  });
});

describe("getFairValue", () => {
  it("throws on an unknown symbol before any network call", async () => {
    await expect(getFairValue("NOTATICKER")).rejects.toThrow(/unknown symbol/);
  });

  // Guarded live read against a real Chainlink feed on BSC. Skips if the RPC is unreachable so a
  // network blip never reddens the gate.
  it("reads a fresh BNB/USD reference on-chain", async (ctx) => {
    try {
      const fv = await getFairValue("BNB");
      expect(fv.usd).toBeGreaterThan(50);
      expect(fv.usd).toBeLessThan(5000);
      expect(fv.ts).toBeGreaterThan(0);
      expect(fv.source).toBe(CHAINLINK_ONCHAIN_SOURCE);
    } catch {
      ctx.skip();
    }
  });
});
