// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import type { TtlCache } from "./cache";
import type { ApiConfig } from "./config";

// Shared dependencies handed to the data-route plugins.
export interface RouteDeps {
  cache: TtlCache<unknown>;
  config: ApiConfig;
}
