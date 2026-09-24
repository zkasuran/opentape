// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
"use client";

import { useEffect, useState, type ComponentProps } from "react";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BestExecution } from "../lib/types";
import { bps, price } from "../lib/format";
import { PALETTE, premiumColor } from "../lib/palette";
import { quotePremiumBps } from "../lib/quote";
import { issuerLabel, venueLabel } from "../lib/venue";

interface RadarDatum {
  name: string;
  issuer: string;
  premiumBps: number;
  priceUsd: number;
  kind: string;
}

export function PremiumRadar({ result }: { result: BestExecution }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const fair = result.fairValue.usd;
  const data: RadarDatum[] = result.ranked
    .map((q) => ({
      name: venueLabel(q),
      issuer: issuerLabel(q),
      premiumBps: Math.round(quotePremiumBps(q, fair)),
      priceUsd: q.pxPerExposureUsd,
      kind: q.venueKind,
    }))
    .sort((a, b) => a.premiumBps - b.premiumBps);

  const maxAbs = Math.max(20, ...data.map((d) => Math.abs(d.premiumBps)));
  const bound = Math.ceil(maxAbs / 10) * 10;

  return (
    <div>
      <div className="chart-wrap">
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 20, bottom: 4, left: 8 }}
              barCategoryGap={10}
            >
              <CartesianGrid horizontal={false} stroke={PALETTE.grid} strokeDasharray="0" />
              <XAxis
                type="number"
                domain={[-bound, bound]}
                tick={{ fill: PALETTE.textMuted, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: PALETTE.axis }}
                tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v}`}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={116}
                tick={{ fill: PALETTE.textSecondary, fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <ReferenceLine x={0} stroke={PALETTE.axis} strokeWidth={1.5} />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                content={renderTooltip as unknown as ComponentProps<typeof Tooltip>["content"]}
              />
              <Bar dataKey="premiumBps" radius={[3, 3, 3, 3]} isAnimationActive={false}>
                {data.map((d) => (
                  <Cell key={d.name} fill={premiumColor(d.premiumBps)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="skeleton" style={{ width: "100%", height: "100%" }} />
        )}
      </div>
      <div className="legend-row">
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: PALETTE.divergeNeg }} />
          discount, trades below true
        </span>
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: PALETTE.divergePos }} />
          premium, trades above true
        </span>
        <span className="legend-item" style={{ color: "var(--text-muted)" }}>
          premium vs true underlying (bps)
        </span>
      </div>
    </div>
  );
}

function renderTooltip(props: { active?: boolean; payload?: ReadonlyArray<{ payload?: RadarDatum }> }) {
  if (!props.active || !props.payload?.length) return null;
  const d = props.payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="viz-tooltip">
      <div className="tt-title">{d.name}</div>
      <div className="tt-row">
        <span>Issuer</span>
        <b>{d.issuer}</b>
      </div>
      <div className="tt-row">
        <span>Price</span>
        <b>${price(d.priceUsd)}</b>
      </div>
      <div className="tt-row">
        <span>vs true</span>
        <b style={{ color: premiumColor(d.premiumBps) }}>{bps(d.premiumBps, { sign: true })}</b>
      </div>
    </div>
  );
}
