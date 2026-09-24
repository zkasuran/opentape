// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import { getFairValue } from "../fairvalue/chainlink";
import { getAdapters } from "../registry";
import type { ArbSpread, BestExecution, CanonicalSymbol, Quote, TapeRow } from "../types";
import { computeArb } from "./arb";
import { normalizeQuotes } from "./normalize";
import { buildBestExecution } from "./rank";
import { buildTape } from "./tape";

// Reference order size used to price the tape and the arb signal, where no size
// is supplied by the caller. Best-execution takes its own size.
const DEFAULT_TAPE_SIZE_USD = 10_000;

// Fan out to every registered adapter and flatten their quotes. An adapter that
// throws or does not cover the symbol contributes nothing rather than failing the
// whole consolidation.
async function gatherQuotes(symbol: CanonicalSymbol, sizeUsd: number): Promise<Quote[]> {
  const adapters = getAdapters();
  const batches = await Promise.all(
    adapters.map((a) => a.quotes(symbol, sizeUsd).catch(() => [] as Quote[])),
  );
  return batches.flat();
}

export async function getConsolidatedTape(symbol: CanonicalSymbol): Promise<TapeRow> {
  const fairValue = await getFairValue(symbol);
  const quotes = await gatherQuotes(symbol, DEFAULT_TAPE_SIZE_USD);
  return buildTape(symbol, quotes, fairValue);
}

export async function getBestExecution(
  symbol: CanonicalSymbol,
  sizeUsd: number,
): Promise<BestExecution> {
  const fairValue = await getFairValue(symbol);
  const quotes = await gatherQuotes(symbol, sizeUsd);
  return buildBestExecution(symbol, sizeUsd, quotes, fairValue);
}

export async function getArbSpread(symbol: CanonicalSymbol): Promise<ArbSpread> {
  const fairValue = await getFairValue(symbol);
  const quotes = normalizeQuotes(
    await gatherQuotes(symbol, DEFAULT_TAPE_SIZE_USD),
    fairValue,
  );
  if (quotes.length === 0) throw new Error(`getArbSpread: no quotes for ${symbol}`);
  return computeArb(symbol, quotes);
}
