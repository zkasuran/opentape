// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import type { CanonicalSymbol, Quote, VenueAdapter } from "../types";

// TODO(binance): walk Binance public /api/v3/depth for bStock pairs (CEX leg, free, no key).
// VERIFY which bStock/tokenized pairs are on the public API via /api/v3/exchangeInfo first.
export const binanceAdapter: VenueAdapter = {
  id: "binance",
  async supports(_symbol: CanonicalSymbol): Promise<boolean> {
    return false;
  },
  async quotes(_symbol: CanonicalSymbol, _sizeUsd: number): Promise<Quote[]> {
    return [];
  },
};
