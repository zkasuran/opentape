// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import { describe, expect, it } from "vitest";
import { TtlCache } from "../src/cache";

describe("TtlCache", () => {
  it("returns undefined for a missing key", () => {
    const cache = new TtlCache<number>(1000);
    expect(cache.get("nope")).toBeUndefined();
  });

  it("returns a stored value while it is fresh", () => {
    const cache = new TtlCache<number>(1000);
    cache.set("k", 42);
    expect(cache.get("k")).toBe(42);
    expect(cache.size).toBe(1);
  });

  it("drops a value once its TTL has passed", () => {
    const cache = new TtlCache<number>(-1); // expires immediately
    cache.set("k", 42);
    expect(cache.get("k")).toBeUndefined();
  });

  it("wrap computes once and then serves from cache", async () => {
    const cache = new TtlCache<number>(1000);
    let calls = 0;
    const produce = async () => {
      calls += 1;
      return 7;
    };

    const first = await cache.wrap("k", produce);
    const second = await cache.wrap("k", produce);

    expect(first).toEqual({ value: 7, cached: false });
    expect(second).toEqual({ value: 7, cached: true });
    expect(calls).toBe(1);
  });

  it("does not cache a rejected producer", async () => {
    const cache = new TtlCache<number>(1000);
    await expect(cache.wrap("k", async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(cache.get("k")).toBeUndefined();
  });
});
