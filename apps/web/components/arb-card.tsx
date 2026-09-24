// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
"use client";

import { ArrowRight, Info, ShieldCheck } from "lucide-react";
import type { ArbSpread } from "../lib/types";
import { bps, price } from "../lib/format";
import { issuerLabel, venueLabel } from "../lib/venue";

export function ArbCard({ arb }: { arb: ArbSpread }) {
  const netClass = arb.netBps > 0 ? "val-good" : "val-neutral";
  return (
    <div className="card card-pad" id="arb">
      <div className="card-head">
        <div className="card-title">Cross-issuer arb signal · {arb.symbol}</div>
        <span className="tag tag-kyc">
          <ShieldCheck size={12} />
          {arb.executable ? "executable" : "signal only"}
        </span>
      </div>

      <div className="arb-legs">
        <div className="arb-leg buy">
          <div className="leg-tag">Buy cheapest</div>
          <div className="leg-venue">{venueLabel(arb.buy)}</div>
          <div className="leg-px">
            {issuerLabel(arb.buy)} · ${price(arb.buy.pxPerExposureUsd)}
          </div>
        </div>
        <ArrowRight className="arb-arrow" size={20} />
        <div className="arb-leg sell">
          <div className="leg-tag">Sell / redeem dearest</div>
          <div className="leg-venue">{venueLabel(arb.sell)}</div>
          <div className="leg-px">
            {issuerLabel(arb.sell)} · ${price(arb.sell.pxPerExposureUsd)}
          </div>
        </div>
      </div>

      <div className="arb-spread">
        <div>
          <div className={`sp-net ${netClass}`}>{bps(arb.netBps, { sign: true })}</div>
          <div className="sp-label">net of both legs' fees and gas</div>
        </div>
        <div>
          <div className="sp-gross">gross {bps(arb.grossBps, { sign: true })}</div>
          <div className="sp-label">raw dispersion</div>
        </div>
      </div>

      {arb.notes.length > 0 ? (
        <ul className="arb-notes">
          {arb.notes.map((n) => (
            <li key={n}>
              <Info size={13} />
              <span>{n}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
