// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
"use client";

import { bps } from "../lib/format";
import type { CanonicalSymbol } from "../lib/types";

const SIZE_PRESETS = [1000, 10000, 50000, 100000];

export function TradePanel({
  symbols,
  activeSymbol,
  onSelectSymbol,
  sizeUsd,
  onSizeChange,
  side,
  onSideChange,
  premiumBySymbol,
}: {
  symbols: CanonicalSymbol[];
  activeSymbol: CanonicalSymbol;
  onSelectSymbol: (s: CanonicalSymbol) => void;
  sizeUsd: number;
  onSizeChange: (n: number) => void;
  side: "buy" | "sell";
  onSideChange: (s: "buy" | "sell") => void;
  premiumBySymbol: Record<string, number>;
}) {
  return (
    <div className="card card-pad" id="console">
      <div className="field">
        <div className="field-label">Underlying</div>
        <div className="sym-grid">
          {symbols.map((s) => {
            const prem = premiumBySymbol[s];
            return (
              <button
                key={s}
                className={`sym-btn${s === activeSymbol ? " active" : ""}`}
                onClick={() => onSelectSymbol(s)}
              >
                <span className="sym">{s}</span>
                <span
                  className={
                    prem === undefined
                      ? "sym-prem sym-prem-none"
                      : `sym-prem ${prem >= 0 ? "num-prem" : "num-disc"}`
                  }
                >
                  {prem === undefined ? "·" : bps(prem, { sign: true })}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="field">
        <div className="field-label">
          <span>Trade size</span>
          <span>USD</span>
        </div>
        <label className="size-input">
          <span>$</span>
          <input
            inputMode="numeric"
            value={String(sizeUsd)}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^0-9]/g, "");
              onSizeChange(digits ? Number.parseInt(digits, 10) : 0);
            }}
            aria-label="Trade size in US dollars"
          />
        </label>
        <div className="chip-row">
          {SIZE_PRESETS.map((v) => (
            <button
              key={v}
              className={`chip${v === sizeUsd ? " active" : ""}`}
              onClick={() => onSizeChange(v)}
            >
              ${v >= 1000 ? `${v / 1000}k` : v}
            </button>
          ))}
        </div>
      </div>

      <div className="field" style={{ marginBottom: 0 }}>
        <div className="field-label">Side</div>
        <div className="side-toggle">
          <button className={side === "buy" ? "active" : ""} onClick={() => onSideChange("buy")}>
            Buy
          </button>
          <button className={side === "sell" ? "active" : ""} onClick={() => onSideChange("sell")}>
            Sell
          </button>
        </div>
        {side === "sell" ? (
          <p className="card-note" style={{ marginTop: 10 }}>
            Sell routing is view only in this build. One-click execute is spot buy, USDT into the token.
          </p>
        ) : null}
      </div>
    </div>
  );
}
