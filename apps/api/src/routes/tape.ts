// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import { getConsolidatedTape } from "@opentape/sdk";
import type { FastifyPluginAsync } from "fastify";
import type { RouteDeps } from "../deps";
import { resolveSymbol, sendDataUnavailable } from "./helpers";

// GET /tape/:symbol -> the consolidated tape (NBBO + premium) for one underlying.
export function tapeRoutes(deps: RouteDeps): FastifyPluginAsync {
  return async (app) => {
    app.get("/tape/:symbol", async (request, reply) => {
      const symbol = resolveSymbol(request.params, reply);
      if (symbol === null) return reply;

      try {
        const { value, cached } = await deps.cache.wrap(`tape:${symbol}`, () =>
          getConsolidatedTape(symbol),
        );
        reply.header("x-cache", cached ? "HIT" : "MISS");
        return value;
      } catch (err) {
        request.log.warn({ err, symbol }, "consolidated tape unavailable");
        return sendDataUnavailable(reply, `tape/${symbol}`, err);
      }
    });
  };
}
