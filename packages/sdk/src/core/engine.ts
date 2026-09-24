// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import type { ArbSpread, BestExecution, CanonicalSymbol, TapeRow } from "../types";

// TODO(core): orchestrate the registered adapters + fair value into the consolidated tape,
// the best-execution recommendation, and the arb signal. See registry, normalize, rank, arb.
export async function getConsolidatedTape(symbol: CanonicalSymbol): Promise<TapeRow> {
  throw new Error(`not implemented: getConsolidatedTape(${symbol})`);
}

export async function getBestExecution(
  symbol: CanonicalSymbol,
  sizeUsd: number,
): Promise<BestExecution> {
  throw new Error(`not implemented: getBestExecution(${symbol}, ${sizeUsd})`);
}

export async function getArbSpread(symbol: CanonicalSymbol): Promise<ArbSpread> {
  throw new Error(`not implemented: getArbSpread(${symbol})`);
}
