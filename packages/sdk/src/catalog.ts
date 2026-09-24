// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import type { CanonicalSymbol } from "./types";

// Underlyings we track. Kept small and liquid; the adapters map each to their issuer tokens.
export const UNDERLYINGS: CanonicalSymbol[] = ["AAPL", "TSLA", "NVDA", "SPY", "GOOGL", "META"];

export function listUnderlyings(): CanonicalSymbol[] {
  return UNDERLYINGS.slice();
}
