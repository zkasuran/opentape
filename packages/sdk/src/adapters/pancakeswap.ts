// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import type { CanonicalSymbol, Quote, VenueAdapter } from "../types";

// TODO(pancake): read PancakeSwap v3 (+ v2) pools on BSC for tokenized-stock/USDT pairs and
// compute amount-out + priceImpactBps for sizeUsd. VERIFY the v3 Quoter/SmartRouter addresses
// and the real xStocks/bStocks token addresses on BSC first. Use a BNB dataseed RPC.
export const pancakeswapAdapter: VenueAdapter = {
  id: "pancakeswap",
  async supports(_symbol: CanonicalSymbol): Promise<boolean> {
    return false;
  },
  async quotes(_symbol: CanonicalSymbol, _sizeUsd: number): Promise<Quote[]> {
    return [];
  },
};
