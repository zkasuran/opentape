// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
"use client";

import type { TapeRow } from "../lib/types";
import { bps, price } from "../lib/format";
import { issuerLabel, venueLabel } from "../lib/venue";

// One fixed CSS token per issuer, so the dot stays on brand and swaps with the theme.
const ISSUER_VAR: Record<string, string> = {
  xstocks: "--series-1",
  bstocks: "--series-2",
  ondo: "--series-3",
};

export function ConsolidatedTape({
  rows,
  activeSymbol,
  onSelect,
}: {
  rows: TapeRow[];
  activeSymbol: string;
  onSelect: (s: TapeRow["symbol"]) => void;
}) {
  if (!rows.length) {
    return <div className="tape-empty">No underlyings on the tape yet.</div>;
  }
  return (
    <div className="tape-grid">
      {rows.map((r) => {
        const prem = Math.round(r.premiumBps);
        const active = r.symbol === activeSymbol;
        const hue = ISSUER_VAR[r.bestOffer.issuer] ?? "--series-1";
        return (
          <button
            key={r.symbol}
            type="button"
            className={`tape-cell${active ? " active" : ""}`}
            onClick={() => onSelect(r.symbol)}
            aria-pressed={active}
          >
            <div className="tape-top">
              <span className="tape-sym">{r.symbol}</span>
              <span className={`tape-prem ${prem >= 0 ? "num-prem" : "num-disc"}`}>
                {bps(prem, { sign: true })}
              </span>
            </div>
            <div className="tape-fair">
              true <b>${price(r.fairValue.usd)}</b>
            </div>
            <div className="tape-venue">
              <span className="tape-dot" style={{ background: `var(${hue})` }} aria-hidden="true" />
              best at {venueLabel(r.bestOffer)}
            </div>
          </button>
        );
      })}
    </div>
  );
}
