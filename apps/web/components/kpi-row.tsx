// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
"use client";

import { Gauge, Layers, Scale, TrendingUp } from "lucide-react";
import type { BestExecution } from "../lib/types";
import { bps, price, usd } from "../lib/format";
import { landedPerShare, landedPremiumBps } from "../lib/quote";

export function KpiRow({ result }: { result: BestExecution }) {
  const fair = result.fairValue.usd;
  const bestLanded = landedPerShare(result.best, fair);
  const premiumBps = landedPremiumBps(result.best, fair);
  const savingsUsd = (result.savingsBpsVsWorst / 10000) * result.sizeUsd;
  const issuers = new Set(result.ranked.map((q) => q.issuer)).size;

  const premiumClass = premiumBps <= 0 ? "val-good" : "val-bad";

  return (
    <div className="kpi-row">
      <div className="kpi">
        <div className="k-label">
          <Gauge size={13} />
          Best price
        </div>
        <div className="k-value val-neutral">${price(bestLanded)}</div>
        <div className="k-hint">all in, per share</div>
      </div>
      <div className="kpi">
        <div className="k-label">
          <Scale size={13} />
          Premium vs true
        </div>
        <div className={`k-value ${premiumClass}`}>{bps(premiumBps, { sign: true })}</div>
        <div className="k-hint">{premiumBps <= 0 ? "trades at a discount" : "trades rich"}</div>
      </div>
      <div className="kpi">
        <div className="k-label">
          <TrendingUp size={13} />
          Savings vs worst
        </div>
        <div className="k-value val-good">{bps(result.savingsBpsVsWorst)}</div>
        <div className="k-hint">{usd(savingsUsd, { compact: savingsUsd >= 1000 })} on this size</div>
      </div>
      <div className="kpi">
        <div className="k-label">
          <Layers size={13} />
          Venues scanned
        </div>
        <div className="k-value val-neutral">{result.ranked.length}</div>
        <div className="k-hint">across {issuers} issuers</div>
      </div>
    </div>
  );
}
