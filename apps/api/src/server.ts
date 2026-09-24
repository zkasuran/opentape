// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import { fileURLToPath } from "node:url";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { ensureDefaultAdapters } from "./adapters";
import { TtlCache } from "./cache";
import { type ApiConfig, loadConfig } from "./config";
import type { RouteDeps } from "./deps";
import { arbRoutes } from "./routes/arb";
import { bestexecRoutes } from "./routes/bestexec";
import { healthRoutes } from "./routes/health";
import { tapeRoutes } from "./routes/tape";
import { underlyingsRoutes } from "./routes/underlyings";

export interface BuildOptions {
  config?: Partial<ApiConfig>;
  // Register the default SDK adapters at startup. On by default; tests can opt out to
  // inject their own fixtures.
  registerDefaultAdapters?: boolean;
  logger?: boolean;
}

// Build a fully configured Fastify instance WITHOUT listening, so tests drive it with
// `inject` and the entrypoint below calls `listen`.
export async function buildServer(options: BuildOptions = {}): Promise<FastifyInstance> {
  const config: ApiConfig = { ...loadConfig(), ...options.config };

  if (options.registerDefaultAdapters !== false) {
    ensureDefaultAdapters();
  }

  const app = Fastify({ logger: options.logger ?? false });

  // The web app is a browser client on another origin, so CORS is required.
  await app.register(cors, { origin: config.corsOrigin });

  const deps: RouteDeps = { cache: new TtlCache<unknown>(config.quoteCacheTtlMs), config };

  app.get("/", async () => ({
    service: "opentape-api",
    description: "Consolidated tape, best execution and cross-issuer arb signal for tokenized stocks.",
    routes: ["/health", "/underlyings", "/tape/:symbol", "/bestexec/:symbol?sizeUsd=", "/arb/:symbol"],
  }));

  await app.register(healthRoutes);
  await app.register(underlyingsRoutes);
  await app.register(tapeRoutes(deps));
  await app.register(bestexecRoutes(deps));
  await app.register(arbRoutes(deps));

  return app;
}

async function start(): Promise<void> {
  // Load a local .env only when actually starting the server, never during tests.
  const { config: loadDotenv } = await import("dotenv");
  loadDotenv();

  const config = loadConfig();
  const app = await buildServer({ logger: true });

  // Read-only, unauthenticated public market-data API: no mutations, no secrets, no auth by
  // design. If it is ever put behind a shared gateway, add rate limiting and an allow-list.
  try {
    await app.listen({ host: config.host, port: config.port });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

const invokedDirectly =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  void start();
}
