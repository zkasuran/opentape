// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { BestExecution } from "../lib/types";
import { bps, price } from "../lib/format";
import { DIVERGE, issuerColor } from "../lib/palette";
import { quotePremiumBps } from "../lib/quote";
import { issuerLabel, venueLabel } from "../lib/venue";
import { useTheme } from "./theme";

interface RadarDatum {
  name: string;
  issuer: string;
  issuerKey: string;
  premiumBps: number;
  priceUsd: number;
}

// The plot leaves fixed room for the venue label on the left and the bps value on
// the right; the overlays (zones, the true line, the arb band) inset by the same
// amounts so a marker at x% lines up exactly with them.
const LABEL_W = 104;
const VAL_W = 66;

export function PremiumRadar({ result }: { result: BestExecution }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { theme } = useTheme();
  const poles = DIVERGE[theme];

  const fair = result.fairValue.usd;
  const data: RadarDatum[] = result.ranked
    .map((q) => ({
      name: venueLabel(q),
      issuer: issuerLabel(q),
      issuerKey: q.issuer,
      premiumBps: Math.round(quotePremiumBps(q, fair)),
      priceUsd: q.pxPerExposureUsd,
    }))
    .sort((a, b) => a.premiumBps - b.premiumBps);

  const maxAbs = Math.max(20, ...data.map((d) => Math.abs(d.premiumBps)));
  const bound = Math.ceil(maxAbs / 10) * 10;
  const pct = (p: number) => Math.max(0, Math.min(100, 50 + (p / bound) * 50));

  const cheapest = data[0];
  const richest = data[data.length - 1];
  const spread = data.length ? richest.premiumBps - cheapest.premiumBps : 0;
  const bandLeft = data.length ? pct(cheapest.premiumBps) : 50;
  const bandRight = data.length ? pct(richest.premiumBps) : 50;

  if (!mounted) return <div className="skeleton" style={{ width: "100%", height: 248 }} />;

  return (
    <div className="spectrum">
      <div className="spec-headline">
        <div className="spec-signal">
          <span className="spec-eyebrow">Arb signal</span>
          <span className="spec-spread">{bps(spread)}</span>
          <span className="spec-cap">spread across venues</span>
        </div>
        <div className="spec-flow">
          <span className="spec-flow-end num-disc">
            {cheapest?.name ?? "—"} <em>cheapest</em>
          </span>
          <span className="spec-flow-arrow" aria-hidden="true">
            &rarr;
          </span>
          <span className="spec-flow-end num-prem">
            {richest?.name ?? "—"} <em>richest</em>
          </span>
        </div>
      </div>

      <div className="spec-plot" style={{ "--label-w": `${LABEL_W}px`, "--val-w": `${VAL_W}px` } as CSSProperties}>
        <div className="spec-field">
          <div className="spec-zone spec-zone-disc" style={{ background: `linear-gradient(90deg, ${poles.neg}22, transparent)` }} />
          <div className="spec-zone spec-zone-prem" style={{ background: `linear-gradient(270deg, ${poles.pos}22, transparent)` }} />
          {spread > 0 ? (
            <div className="spec-band" style={{ left: `${bandLeft}%`, width: `${bandRight - bandLeft}%` }}>
              <span className="spec-band-tag">{bps(spread)} gap</span>
            </div>
          ) : null}
          <div className="spec-true">
            <span className="spec-true-tag">TRUE ${price(fair)}</span>
          </div>
        </div>

        {data.map((d) => {
          const x = pct(d.premiumBps);
          const hue = issuerColor(d.issuerKey, theme);
          const rich = d.premiumBps >= 0;
          return (
            <div className="spec-row" key={d.name}>
              <div className="spec-name">
                <span className="spec-swatch" style={{ background: hue }} />
                <span className="spec-venue">{d.name}</span>
              </div>
              <div className="spec-track">
                <span
                  className={`spec-stem ${rich ? "is-prem" : "is-disc"}`}
                  style={rich ? { left: "50%", width: `${x - 50}%` } : { left: `${x}%`, width: `${50 - x}%` }}
                />
                <span
                  className="spec-dot"
                  style={{ left: `${x}%`, background: hue }}
                  title={`${d.name} · ${d.issuer} · $${price(d.priceUsd)} · ${bps(d.premiumBps, { sign: true })} vs true`}
                />
              </div>
              <div className={`spec-val ${rich ? "num-prem" : "num-disc"}`}>{bps(d.premiumBps, { sign: true })}</div>
            </div>
          );
        })}

        <div className="spec-axis">
          <span>-{bound}</span>
          <span className="spec-axis-mid">0 bps</span>
          <span>+{bound}</span>
        </div>
      </div>

      <div className="legend-row">
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: poles.neg }} />
          left of TRUE trades cheap
        </span>
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: poles.pos }} />
          right trades rich
        </span>
        <span className="legend-item" style={{ color: "var(--text-muted)" }}>
          bps vs the Chainlink underlying
        </span>
      </div>
    </div>
  );
}
