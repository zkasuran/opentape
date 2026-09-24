// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import { getArbSpread } from "@opentape/sdk";
import type { FastifyPluginAsync } from "fastify";
import type { RouteDeps } from "../deps";
import { resolveSymbol, sendDataUnavailable } from "./helpers";

// GET /arb/:symbol -> the cross-issuer arbitrage SIGNAL (not a capture; redemption is gated).
export function arbRoutes(deps: RouteDeps): FastifyPluginAsync {
  return async (app) => {
    app.get("/arb/:symbol", async (request, reply) => {
      const symbol = resolveSymbol(request.params, reply);
      if (symbol === null) return reply;

      try {
        const { value, cached } = await deps.cache.wrap(`arb:${symbol}`, () => getArbSpread(symbol));
        reply.header("x-cache", cached ? "HIT" : "MISS");
        return value;
      } catch (err) {
        request.log.warn({ err, symbol }, "arb spread unavailable");
        return sendDataUnavailable(reply, `arb/${symbol}`, err);
      }
    });
  };
}
