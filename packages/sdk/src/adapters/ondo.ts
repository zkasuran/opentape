// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import type { CanonicalSymbol, Quote, VenueAdapter } from "../types";

// TODO(ondo): Ondo on BNB as a NAV/quote reference (mint/redeem ~ underlying). Mark kycGated=true;
// executable per findings. If the API is gated, approximate as fairValue x multiplier, clearly labeled.
export const ondoAdapter: VenueAdapter = {
  id: "ondo",
  async supports(_symbol: CanonicalSymbol): Promise<boolean> {
    return false;
  },
  async quotes(_symbol: CanonicalSymbol, _sizeUsd: number): Promise<Quote[]> {
    return [];
  },
};
