// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0

export function usd(value: number, opts?: { compact?: boolean; cents?: boolean }): string {
  const compact = opts?.compact ?? false;
  const cents = opts?.cents ?? true;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    minimumFractionDigits: cents && !compact ? 2 : 0,
    maximumFractionDigits: cents && !compact ? 2 : compact ? 1 : 0,
  }).format(value);
}

export function price(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// Basis points, signed. 1% = 100 bps.
export function bps(value: number, opts?: { sign?: boolean }): string {
  const sign = opts?.sign ?? false;
  const rounded = Math.round(value);
  const prefix = sign && rounded > 0 ? "+" : "";
  return `${prefix}${rounded.toLocaleString("en-US")} bps`;
}

export function pct(value: number, digits = 2): string {
  return `${value.toFixed(digits)}%`;
}

export function shortAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function relativeTime(ts: number): string {
  const secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  return `${mins}m ago`;
}
