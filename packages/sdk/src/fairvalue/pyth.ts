// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import type { CanonicalSymbol, FairValue } from "../types";

// TODO(pyth): read on-chain Pyth on BSC (permissionless) via @pythnetwork/pyth-evm-js + viem,
// or Hermes REST if it is keyless. VERIFY the API-key requirement first (agents disagreed).
export async function getFairValue(symbol: CanonicalSymbol): Promise<FairValue> {
  throw new Error(`not implemented: getFairValue(${symbol})`);
}
