// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import { getAdapters } from "@opentape/sdk";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildServer } from "../src/server";

// The data routes must answer WITHOUT a live network: the SDK data layer is a stub while
// sibling agents finish it, so these routes return a graceful 503. Once the SDK is real they
// return a data shape instead. The tests accept either and never depend on real data.
const DATA_ROUTES = [
  "/tape/AAPL",
  "/bestexec/AAPL?sizeUsd=1000",
  "/bestexec/AAPL", // default size, no query
  "/arb/AAPL",
];

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("GET /health", () => {
  it("is always 200 and ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
  });
});

describe("GET /underlyings", () => {
  it("lists the tracked underlyings from the SDK catalog", async () => {
    const res = await app.inject({ method: "GET", url: "/underlyings" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { underlyings: string[] };
    expect(Array.isArray(body.underlyings)).toBe(true);
    expect(body.underlyings.length).toBeGreaterThan(0);
    expect(body.underlyings).toContain("AAPL");
  });
});

describe("startup wiring", () => {
  it("registers the three default adapters exactly once", () => {
    const ids = getAdapters().map((a) => a.id);
    for (const id of ["pancakeswap", "binance", "ondo"]) {
      expect(ids.filter((x) => x === id)).toHaveLength(1);
    }
  });
});

describe("data routes", () => {
  for (const url of DATA_ROUTES) {
    it(`GET ${url} returns a valid object shape or a graceful 503`, async () => {
      const res = await app.inject({ method: "GET", url });
      if (res.statusCode === 200) {
        const body = res.json();
        expect(body).toBeTypeOf("object");
        expect(body).not.toBeNull();
      } else {
        expect(res.statusCode).toBe(503);
        const body = res.json() as { error: string; detail: string };
        expect(typeof body.error).toBe("string");
        expect(typeof body.detail).toBe("string");
      }
    });
  }

  it("rejects an unknown symbol with 404 and lists the supported set", async () => {
    const res = await app.inject({ method: "GET", url: "/tape/DOESNOTEXIST" });
    expect(res.statusCode).toBe(404);
    const body = res.json() as { error: string; supported: string[] };
    expect(body.error).toBe("unknown_symbol");
    expect(Array.isArray(body.supported)).toBe(true);
  });

  it("rejects a malformed symbol with 400", async () => {
    const res = await app.inject({ method: "GET", url: "/tape/@@@" });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a non-positive sizeUsd with 400", async () => {
    const res = await app.inject({ method: "GET", url: "/bestexec/AAPL?sizeUsd=-5" });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a non-numeric sizeUsd with 400", async () => {
    const res = await app.inject({ method: "GET", url: "/bestexec/AAPL?sizeUsd=abc" });
    expect(res.statusCode).toBe(400);
  });
});

describe("CORS", () => {
  it("answers a browser preflight with an allow-origin header", async () => {
    const res = await app.inject({
      method: "OPTIONS",
      url: "/underlyings",
      headers: { origin: "http://localhost:3000", "access-control-request-method": "GET" },
    });
    expect(res.headers["access-control-allow-origin"]).toBeDefined();
  });
});
