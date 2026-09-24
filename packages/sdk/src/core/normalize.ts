// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import type { FairValue, Quote } from "../types";

// TODO(core): normalize each venue quote to USD-per-exposure using issuer multipliers
// (e.g. Ondo total-return multiplier), so cross-issuer comparison is valid.
export function normalizeQuotes(quotes: Quote[], _fairValue: FairValue): Quote[] {
  return quotes;
}
