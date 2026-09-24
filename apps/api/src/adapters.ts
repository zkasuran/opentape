// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import {
  binanceAdapter,
  getAdapters,
  ondoAdapter,
  pancakeswapAdapter,
  registerAdapter,
} from "@opentape/sdk";

// The venue adapters the service ships with. PancakeSwap (DEX), Binance (CEX order book)
// and Ondo (issuer NAV/mint reference) cover the three venue kinds the tape spans.
const DEFAULT_ADAPTERS = [pancakeswapAdapter, binanceAdapter, ondoAdapter];

// The SDK registry is a process-global singleton, so register each default at most once.
// This stays idempotent when the server is built more than once in the same process
// (for example across test files).
export function ensureDefaultAdapters(): void {
  const present = new Set(getAdapters().map((a) => a.id));
  for (const adapter of DEFAULT_ADAPTERS) {
    if (!present.has(adapter.id)) registerAdapter(adapter);
  }
}
