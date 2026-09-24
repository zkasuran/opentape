// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import type { ArbSpread, CanonicalSymbol, Quote } from "../types";

// TODO(core): compute the cross-issuer arb SIGNAL (buy cheapest, sell/redeem dearest) net of costs,
// and flag executability honestly (redemption is institutional/KYC-gated for most issuers).
export function computeArb(symbol: CanonicalSymbol, _quotes: Quote[]): ArbSpread {
  throw new Error(`not implemented: computeArb(${symbol})`);
}
