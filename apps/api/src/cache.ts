// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0

interface Entry<T> {
  value: T;
  expiresAt: number;
}

// A tiny time-to-live cache. Quotes move fast, so the point is to collapse a burst of
// identical requests (a web grid polling one symbol) into a single SDK call, not to hold
// data for long. Errors are never cached: a failed producer leaves the key empty.
export class TtlCache<T> {
  private readonly store = new Map<string, Entry<T>>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | undefined {
    const hit = this.store.get(key);
    if (hit === undefined) return undefined;
    if (Date.now() > hit.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  // Serve a cached value if fresh, otherwise run `produce`, cache the result and return it.
  // If `produce` rejects, the rejection propagates and nothing is cached.
  async wrap(key: string, produce: () => Promise<T>): Promise<{ value: T; cached: boolean }> {
    const hit = this.get(key);
    if (hit !== undefined) return { value: hit, cached: true };
    const value = await produce();
    this.set(key, value);
    return { value, cached: false };
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}
