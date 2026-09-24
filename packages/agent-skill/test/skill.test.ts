// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import { describe, expect, it } from "vitest";
import { demoDeps } from "../src/fixtures";
import { skillManifest } from "../src/manifest";
import {
  DEFAULT_MAX_NOTIONAL_USD,
  DEFAULT_MAX_SLIPPAGE_BPS,
  skillInputSchema,
} from "../src/schema";
import { openTapeBestExecutionSkill, runSkill } from "../src/skill";

describe("skillInputSchema", () => {
  it("applies safe defaults and uppercases the symbol", () => {
    const parsed = skillInputSchema.parse({ symbol: "  aapl ", sizeUsd: 1_000 });
    expect(parsed.symbol).toBe("AAPL");
    expect(parsed.maxSlippageBps).toBe(DEFAULT_MAX_SLIPPAGE_BPS);
    expect(parsed.maxNotionalUsd).toBe(DEFAULT_MAX_NOTIONAL_USD);
  });

  it("keeps explicit overrides", () => {
    const parsed = skillInputSchema.parse({
      symbol: "NVDA",
      sizeUsd: 2_500,
      maxSlippageBps: 30,
      maxNotionalUsd: 5_000,
    });
    expect(parsed.maxSlippageBps).toBe(30);
    expect(parsed.maxNotionalUsd).toBe(5_000);
  });

  it("rejects a non-positive or non-finite size", () => {
    expect(skillInputSchema.safeParse({ symbol: "AAPL", sizeUsd: 0 }).success).toBe(false);
    expect(skillInputSchema.safeParse({ symbol: "AAPL", sizeUsd: -5 }).success).toBe(false);
    expect(
      skillInputSchema.safeParse({ symbol: "AAPL", sizeUsd: Number.POSITIVE_INFINITY }).success,
    ).toBe(false);
  });

  it("rejects a blank symbol", () => {
    expect(skillInputSchema.safeParse({ symbol: "   ", sizeUsd: 1_000 }).success).toBe(false);
  });
});

describe("manifest and descriptor", () => {
  it("declares the required inputs and matching defaults", () => {
    expect(skillManifest.name).toBe("openTapeBestExecution");
    expect(skillManifest.input.required).toEqual(["symbol", "sizeUsd"]);
    expect(skillManifest.input.properties.maxSlippageBps?.default).toBe(DEFAULT_MAX_SLIPPAGE_BPS);
    expect(skillManifest.input.properties.maxNotionalUsd?.default).toBe(DEFAULT_MAX_NOTIONAL_USD);
    expect(skillManifest.metadata.readOnly).toBe(true);
    expect(skillManifest.metadata.network).toBe("bsc-mainnet");
  });

  it("exposes a typed descriptor for embedding", () => {
    expect(openTapeBestExecutionSkill.name).toBe(skillManifest.name);
    expect(openTapeBestExecutionSkill.inputSchema).toBe(skillInputSchema);
    expect(typeof openTapeBestExecutionSkill.invoke).toBe("function");
  });
});

describe("demoDeps: offline CLI fixtures", () => {
  it("produce a consistent allowed recommendation with a signal-only arb", async () => {
    const rec = await runSkill({ symbol: "AAPL", sizeUsd: 5_000 }, demoDeps);
    expect(rec.decision).toBe("allowed");
    expect(rec.bestRoute.executable).toBe(true);
    expect(rec.bestRoute.kycGated).toBe(false);
    expect(rec.arb.grossBps).toBeGreaterThan(0);
    // The dearest leg is the KYC-gated redemption, so the spread is not capturable.
    expect(rec.arb.capturable).toBe(false);
  });
});
