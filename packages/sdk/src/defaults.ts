// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import { binanceAdapter } from "./adapters/binance";
import { ondoAdapter } from "./adapters/ondo";
import { pancakeswapAdapter } from "./adapters/pancakeswap";
import { getAdapters, registerAdapter } from "./registry";

// Register the three built-in venue adapters (PancakeSwap DEX, Binance CEX, Ondo NAV). Idempotent:
// safe to call on every serverless invocation, since a warm instance keeps the registry and we only
// add an adapter whose id is not already present.
export function registerDefaultAdapters(): void {
  const present = new Set(getAdapters().map((a) => a.id));
  for (const adapter of [pancakeswapAdapter, binanceAdapter, ondoAdapter]) {
    if (!present.has(adapter.id)) registerAdapter(adapter);
  }
}
