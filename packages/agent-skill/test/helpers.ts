// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import type { ArbSpread, BestExecution, FairValue, Quote } from "@opentape/sdk";

const TS = 1_700_000_000_000;

export function mkQuote(
  seed: Partial<Quote> & Pick<Quote, "venueId" | "issuer" | "pxPerExposureUsd">,
): Quote {
  return {
    venueKind: "dex",
    symbol: "AAPL",
    sizeUsd: 10_000,
    feeUsd: 0,
    gasUsd: 0,
    priceImpactBps: 0,
    executable: true,
    kycGated: false,
    ts: TS,
    source: "test",
    ...seed,
  };
}

export function mkFair(usd = 200): FairValue {
  return { symbol: "AAPL", usd, confBps: 5, ts: TS, source: "test" };
}

export function mkBE(opts: {
  best: Quote;
  ranked?: Quote[];
  fairUsd?: number;
  sizeUsd?: number;
  savingsBpsVsWorst?: number;
}): BestExecution {
  return {
    symbol: opts.best.symbol,
    sizeUsd: opts.sizeUsd ?? 10_000,
    best: opts.best,
    ranked: opts.ranked ?? [opts.best],
    fairValue: mkFair(opts.fairUsd),
    savingsBpsVsWorst: opts.savingsBpsVsWorst ?? 0,
  };
}

export function mkArb(
  seed: Partial<ArbSpread> & Pick<ArbSpread, "buy" | "sell">,
): ArbSpread {
  return { symbol: "AAPL", grossBps: 0, netBps: 0, executable: true, notes: [], ...seed };
}
