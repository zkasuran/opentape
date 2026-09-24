// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0

// Chart + role colors taken from the dataviz skill's validated dark palette.
// Categorical dark column, diverging blue<->red poles, reserved status steps.
export const PALETTE = {
  series: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"],
  divergeNeg: "#3987e5", // discount, trades cheap
  divergePos: "#e66767", // premium, trades rich
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
  grid: "#2c2c2a",
  axis: "#383835",
  textMuted: "#898781",
  textSecondary: "#c3c2b7",
  surface: "#1a1a19",
} as const;

// One fixed hue per issuer so identity never depends on rank or count.
export const ISSUER_COLOR: Record<string, string> = {
  xstocks: "#3987e5",
  bstocks: "#d95926",
  ondo: "#199e70",
};

export const ISSUER_LABEL: Record<string, string> = {
  xstocks: "xStocks",
  bstocks: "bStocks",
  ondo: "Ondo",
};

// A premium (paying above the true underlying) reads warm; a discount reads cool.
export function premiumColor(premiumBps: number): string {
  return premiumBps >= 0 ? PALETTE.divergePos : PALETTE.divergeNeg;
}
