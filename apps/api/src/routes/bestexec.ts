// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import { getBestExecution } from "@opentape/sdk";
import type { FastifyPluginAsync } from "fastify";
import type { RouteDeps } from "../deps";
import { resolveSymbol, sendDataUnavailable, sizeQuerySchema } from "./helpers";

// GET /bestexec/:symbol?sizeUsd= -> the best route for a given trade size across venues.
export function bestexecRoutes(deps: RouteDeps): FastifyPluginAsync {
  return async (app) => {
    app.get("/bestexec/:symbol", async (request, reply) => {
      const symbol = resolveSymbol(request.params, reply);
      if (symbol === null) return reply;

      const q = sizeQuerySchema.safeParse(request.query);
      if (!q.success) {
        return reply.code(400).send({
          error: "invalid_request",
          detail: "sizeUsd must be a positive number of US dollars",
          issues: q.error.issues,
        });
      }
      const sizeUsd = q.data.sizeUsd ?? deps.config.defaultSizeUsd;

      try {
        const { value, cached } = await deps.cache.wrap(`bestexec:${symbol}:${sizeUsd}`, () =>
          getBestExecution(symbol, sizeUsd),
        );
        reply.header("x-cache", cached ? "HIT" : "MISS");
        return value;
      } catch (err) {
        request.log.warn({ err, symbol, sizeUsd }, "best execution unavailable");
        return sendDataUnavailable(reply, `bestexec/${symbol}`, err);
      }
    });
  };
}
