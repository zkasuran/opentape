import { describe, expect, it } from "vitest";
import * as sdk from "../src/index";

describe("@opentape/sdk barrel", () => {
  it("exports the public API as functions", () => {
    const api = sdk as unknown as Record<string, unknown>;
    for (const fn of [
      "getConsolidatedTape",
      "getBestExecution",
      "getArbSpread",
      "listUnderlyings",
      "registerAdapter",
    ]) {
      expect(typeof api[fn]).toBe("function");
    }
  });

  it("lists underlyings", () => {
    expect(sdk.listUnderlyings().length).toBeGreaterThan(0);
  });
});
