// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import type { Quote } from "../types";

// TODO(core): rank by total landed cost, net of fee + amortized gas + price impact.
// Placeholder sorts by the normalized per-exposure price only.
export function rankQuotes(quotes: Quote[]): Quote[] {
  return quotes.slice().sort((a, b) => a.pxPerExposureUsd - b.pxPerExposureUsd);
}
