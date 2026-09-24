// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0

// Chart + role colors, validated with the dataviz skill in both modes (categorical
// trio and diverging poles pass the lightness band, chroma floor, CVD separation
// and contrast checks on each mode's surface). Charts read JS color values, so they
// carry their own light and dark instances here; the rest of the UI reads CSS tokens
// from globals.css. Identity is never color alone: every mark sits beside a text label.

export type ThemeName = "light" | "dark";

// Chart chrome per theme (grid, axis, tick ink), from the dataviz chrome table.
export const CHART_TOKENS: Record<
  ThemeName,
  { grid: string; axis: string; textMuted: string; textSecondary: string }
> = {
  light: { grid: "#e1e0d9", axis: "#c3c2b7", textMuted: "#898781", textSecondary: "#52514e" },
  dark: { grid: "#2c2c2a", axis: "#383835", textMuted: "#898781", textSecondary: "#c3c2b7" },
};

// Diverging poles: blue (discount, trades cheap) <-> red (premium, trades rich).
export const DIVERGE: Record<ThemeName, { neg: string; pos: string }> = {
  light: { neg: "#2a78d6", pos: "#e34948" },
  dark: { neg: "#3987e5", pos: "#e66767" },
};

// One fixed hue per issuer so identity never depends on rank or count.
const ISSUER_HUE: Record<ThemeName, Record<string, string>> = {
  light: { xstocks: "#2a78d6", bstocks: "#eb6834", ondo: "#1baf7a" },
  dark: { xstocks: "#3987e5", bstocks: "#d95926", ondo: "#199e70" },
};

export const ISSUER_LABEL: Record<string, string> = {
  xstocks: "xStocks",
  bstocks: "bStocks",
  ondo: "Ondo",
};

export function issuerColor(issuer: string, theme: ThemeName): string {
  return ISSUER_HUE[theme][issuer] ?? DIVERGE[theme].neg;
}

// A premium (paying above the true underlying) reads warm; a discount reads cool.
export function divergeFill(premiumBps: number, theme: ThemeName): string {
  return premiumBps >= 0 ? DIVERGE[theme].pos : DIVERGE[theme].neg;
}
