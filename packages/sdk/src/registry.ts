// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import type { VenueAdapter } from "./types";

const adapters: VenueAdapter[] = [];

export function registerAdapter(a: VenueAdapter): void {
  adapters.push(a);
}

export function getAdapters(): VenueAdapter[] {
  return adapters.slice();
}

export function clearAdapters(): void {
  adapters.length = 0;
}
