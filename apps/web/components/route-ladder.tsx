// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
"use client";

import { CircleCheck, Lock } from "lucide-react";
import type { BestExecution } from "../lib/types";
import { bps, price } from "../lib/format";
import { landedPerShare, landedPremiumBps } from "../lib/quote";
import { ISSUER_COLOR } from "../lib/palette";
import { issuerLabel, venueKindLabel, venueLabel } from "../lib/venue";

export function RouteLadder({ result }: { result: BestExecution }) {
  const fair = result.fairValue.usd;
  const bestBps = landedPremiumBps(result.best, fair);
  const deltas = result.ranked.map((q) => landedPremiumBps(q, fair) - bestBps);
  const maxDelta = Math.max(1, ...deltas);

  return (
    <div className="ladder">
      {result.ranked.map((q, i) => {
        const isBest = q.venueId === result.best.venueId;
        const delta = deltas[i] ?? 0;
        const width = isBest ? 4 : Math.max(6, (delta / maxDelta) * 100);
        return (
          <div className={`route${isBest ? " best" : ""}`} key={q.venueId}>
            <div className="route-venue">
              <span className="v-name">{venueLabel(q)}</span>
              <span className="v-issuer">
                {issuerLabel(q)} · {venueKindLabel(q.venueKind)}
                {q.kycGated ? " · gated" : ""}
              </span>
            </div>
            <div className="route-bar-track" role="img" aria-label={`${bps(delta)} above best`}>
              <div
                className="route-bar-fill"
                style={{
                  width: `${width}%`,
                  background: isBest ? "var(--good)" : ISSUER_COLOR[q.issuer] ?? "var(--series-1)",
                  opacity: isBest ? 1 : 0.72,
                }}
              />
            </div>
            <div className="route-cost">${price(landedPerShare(q, fair))}</div>
            <div className="route-delta">
              {isBest ? (
                <span style={{ color: "var(--good)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <CircleCheck size={13} /> best
                </span>
              ) : (
                bps(delta, { sign: true })
              )}
              {q.kycGated ? <Lock size={11} style={{ marginLeft: 6, color: "var(--serious)" }} /> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
