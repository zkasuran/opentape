// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import { listUnderlyings } from "@opentape/sdk";
import type { FastifyReply } from "fastify";
import { z } from "zod";

// A symbol is a short equity ticker: a letter, then up to 15 letters, digits or dots.
const SYMBOL_RE = /^[A-Z][A-Z0-9.]{0,15}$/;

const symbolParamsSchema = z.object({ symbol: z.string().min(1).max(16) });

export const sizeQuerySchema = z.object({
  // Coerce the query string to a number; reject zero, negatives, NaN and absurd sizes.
  sizeUsd: z.coerce.number().positive().max(1_000_000_000).optional(),
});

// Parse and normalize the :symbol path param and confirm it is a tracked underlying.
// On any problem it sends the correct 4xx and returns null so the caller bails out.
export function resolveSymbol(rawParams: unknown, reply: FastifyReply): string | null {
  const parsed = symbolParamsSchema.safeParse(rawParams);
  if (!parsed.success) {
    reply.code(400).send({
      error: "invalid_request",
      detail: "missing or malformed symbol",
      issues: parsed.error.issues,
    });
    return null;
  }

  const symbol = parsed.data.symbol.trim().toUpperCase();
  if (!SYMBOL_RE.test(symbol)) {
    reply.code(400).send({
      error: "invalid_symbol",
      detail: "symbol must start with a letter and contain only letters, digits or dots",
      symbol,
    });
    return null;
  }

  const supported = listUnderlyings();
  if (!supported.includes(symbol)) {
    reply.code(404).send({
      error: "unknown_symbol",
      detail: "this underlying is not tracked; see GET /underlyings",
      symbol,
      supported,
    });
    return null;
  }

  return symbol;
}

export function isNotImplemented(err: unknown): boolean {
  return err instanceof Error && /not implemented/i.test(err.message);
}

// Every data route depends on the SDK data layer (still being finished by sibling work) and
// on live external venues. When either cannot produce data we answer 503 rather than fake a
// quote. A missing SDK capability and an unreachable venue are told apart in the body.
export function sendDataUnavailable(reply: FastifyReply, resource: string, err: unknown): FastifyReply {
  const upstream = err instanceof Error ? err.message : String(err);
  if (isNotImplemented(err)) {
    return reply.code(503).send({
      error: "sdk_not_ready",
      resource,
      detail: `${resource} is not available yet: the OpenTape SDK data layer is still being implemented`,
      upstream,
    });
  }
  return reply.code(503).send({
    error: "upstream_unavailable",
    resource,
    detail: `${resource} could not be produced right now; an upstream venue or data source was unavailable`,
    upstream,
  });
}
