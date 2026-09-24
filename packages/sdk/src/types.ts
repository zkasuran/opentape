// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0

export type CanonicalSymbol = string; // underlying, e.g. "AAPL"
export type IssuerId = "xstocks" | "bstocks" | "ondo";
export type VenueKind = "dex" | "cex" | "issuer";
export type VenueId = string; // e.g. "pancakeswap:v3:0x..", "binance:bAAPLUSDT", "ondo:mint"

export interface Quote {
  venueId: VenueId;
  venueKind: VenueKind;
  issuer: IssuerId;
  symbol: CanonicalSymbol;
  tokenAddress?: string;
  sizeUsd: number;
  pxPerExposureUsd: number; // normalized USD cost per $1 of economic exposure
  feeUsd: number;
  gasUsd: number;
  priceImpactBps: number;
  executable: boolean;
  kycGated: boolean;
  ts: number;
  source: string;
}

export interface FairValue {
  symbol: CanonicalSymbol;
  usd: number;
  confBps: number;
  ts: number;
  source: string;
}

export interface VenueAdapter {
  id: string;
  supports(symbol: CanonicalSymbol): Promise<boolean>;
  quotes(symbol: CanonicalSymbol, sizeUsd: number): Promise<Quote[]>;
}

export interface TapeRow {
  symbol: CanonicalSymbol;
  fairValue: FairValue;
  bestBid?: Quote;
  bestOffer: Quote;
  quotes: Quote[];
  premiumBps: number; // bestOffer vs fairValue
  ts: number;
}

export interface BestExecution {
  symbol: CanonicalSymbol;
  sizeUsd: number;
  best: Quote;
  ranked: Quote[];
  fairValue: FairValue;
  savingsBpsVsWorst: number;
}

export interface ArbSpread {
  symbol: CanonicalSymbol;
  buy: Quote;
  sell: Quote;
  grossBps: number;
  netBps: number;
  executable: boolean;
  notes: string[];
}
