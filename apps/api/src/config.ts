// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0

// Runtime configuration for the OpenTape API. Everything has a sane default so the
// service boots with no environment file and no network. Override via env for a deploy.
export interface ApiConfig {
  // Bind address. Defaults to all interfaces so a container/Vercel deploy is reachable.
  host: string;
  port: number;
  // CORS origin passed to @fastify/cors. `true` reflects any origin (read-only public API);
  // a comma-separated CORS_ORIGIN pins it to an allow-list for the web app.
  corsOrigin: boolean | string[];
  // TTL for the in-memory quote cache. Quotes are volatile, so keep this short.
  quoteCacheTtlMs: number;
  // Fallback trade size for /bestexec when the caller omits sizeUsd.
  defaultSizeUsd: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const corsRaw = env.CORS_ORIGIN?.trim();
  const corsOrigin: boolean | string[] =
    !corsRaw || corsRaw === "*"
      ? true
      : corsRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

  return {
    host: env.HOST ?? "0.0.0.0",
    port: toInt(env.PORT, 8787),
    corsOrigin,
    quoteCacheTtlMs: toInt(env.QUOTE_CACHE_TTL_MS, 3000),
    defaultSizeUsd: toInt(env.DEFAULT_SIZE_USD, 1000),
  };
}

function toInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
