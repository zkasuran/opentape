// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import type { FastifyPluginAsync } from "fastify";

// Liveness probe. Never touches the SDK or the network, so it is always 200.
export const healthRoutes: FastifyPluginAsync = async (app) => {
  const startedAt = Date.now();
  app.get("/health", async () => ({
    ok: true,
    service: "opentape-api",
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
  }));
};
