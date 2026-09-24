// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import type { Quote, VenueKind } from "@opentape/sdk";
import { ISSUER_LABEL } from "./palette";

// Human label for a venue, derived from the SDK venueId (e.g. "pancakeswap:v3:xstocks").
export function venueLabel(q: Quote): string {
  const parts = q.venueId.split(":");
  const head = parts[0] ?? q.venueId;
  switch (head) {
    case "pancakeswap": {
      const tier = parts[1] ? ` ${parts[1]}` : "";
      return `PancakeSwap${tier}`;
    }
    case "binance":
      return "Binance spot";
    case "ondo":
      return "Ondo mint / redeem";
    default:
      return head.charAt(0).toUpperCase() + head.slice(1);
  }
}

export function issuerLabel(q: Quote): string {
  return ISSUER_LABEL[q.issuer] ?? q.issuer;
}

export function venueKindLabel(kind: VenueKind): string {
  switch (kind) {
    case "dex":
      return "on-chain pool";
    case "cex":
      return "central order book";
    case "issuer":
      return "issuer primary";
    default:
      return kind;
  }
}

// A venue is one-click executable from a browser wallet only when it settles on
// chain and is not KYC gated. CEX and issuer-primary legs are real quotes, but
// they are not permissionless, so the one-click executor never routes to them.
export function isPermissionless(q: Quote): boolean {
  return q.executable && !q.kycGated && q.venueKind === "dex";
}
