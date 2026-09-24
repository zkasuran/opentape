// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import { listUnderlyings } from "@opentape/sdk";
import type { FastifyPluginAsync } from "fastify";

// The universe of underlyings the tape tracks. Backed by the SDK catalog, not the network.
export const underlyingsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/underlyings", async () => ({ underlyings: listUnderlyings() }));
};
