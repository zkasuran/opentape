// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Radar, Search } from "lucide-react";
import type {
  ArbResponse,
  BestExecResponse,
  CanonicalSymbol,
  TapeResponse,
} from "../lib/types";
import { clampSizeUsd } from "../lib/quote";
import {
  DEMO_UNDERLYINGS,
  demoArbSpread,
  demoBestExecution,
  demoTape,
} from "../lib/demo";
import { relativeTime } from "../lib/format";
import { TradePanel } from "./trade-panel";
import { BestExecCard } from "./best-exec-card";
import { KpiRow } from "./kpi-row";
import { RouteLadder } from "./route-ladder";
import { PremiumRadar } from "./premium-radar";
import { ArbCard } from "./arb-card";

const INITIAL_SYMBOL: CanonicalSymbol = "AAPL";
const INITIAL_SIZE = 10_000;

function localBestExec(sym: CanonicalSymbol, size: number): BestExecResponse {
  return { mode: "demo", sizeUsd: size, result: demoBestExecution(sym, size), fetchedAt: Date.now() };
}
function localArb(sym: CanonicalSymbol): ArbResponse {
  return { mode: "demo", result: demoArbSpread(sym), fetchedAt: Date.now() };
}
function tapePremiums(rows: TapeResponse["rows"]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.symbol] = Math.round(r.premiumBps);
  return out;
}

export function Console() {
  const [symbols, setSymbols] = useState<CanonicalSymbol[]>(DEMO_UNDERLYINGS);
  const [activeSymbol, setActiveSymbol] = useState<CanonicalSymbol>(INITIAL_SYMBOL);
  const [sizeUsd, setSizeUsd] = useState<number>(INITIAL_SIZE);
  const [debouncedSize, setDebouncedSize] = useState<number>(INITIAL_SIZE);
  const [side, setSide] = useState<"buy" | "sell">("buy");

  const [bestExec, setBestExec] = useState<BestExecResponse>(() =>
    localBestExec(INITIAL_SYMBOL, INITIAL_SIZE),
  );
  const [arb, setArb] = useState<ArbResponse>(() => localArb(INITIAL_SYMBOL));
  const [premiumBySymbol, setPremiumBySymbol] = useState<Record<string, number>>(() =>
    tapePremiums(demoTape()),
  );
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const reqId = useRef(0);

  // debounce the trade size so typing does not fire a request per keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSize(clampSizeUsd(sizeUsd)), 300);
    return () => clearTimeout(t);
  }, [sizeUsd]);

  useEffect(() => {
    setMounted(true);
    void (async () => {
      try {
        const [uRes, tRes] = await Promise.all([
          fetch("/api/underlyings").then((r) => r.json() as Promise<{ symbols: CanonicalSymbol[] }>),
          fetch("/api/tape").then((r) => r.json() as Promise<TapeResponse>),
        ]);
        if (uRes?.symbols?.length) setSymbols(uRes.symbols);
        if (tRes?.rows?.length) setPremiumBySymbol(tapePremiums(tRes.rows));
      } catch {
        /* keep the demo defaults already in state */
      }
    })();
  }, []);

  const load = useCallback(async (sym: CanonicalSymbol, size: number) => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const [be, ar] = await Promise.all([
        fetch(`/api/bestexec/${sym}?sizeUsd=${size}`).then((r) => r.json() as Promise<BestExecResponse>),
        fetch(`/api/arb/${sym}`).then((r) => r.json() as Promise<ArbResponse>),
      ]);
      if (id !== reqId.current) return; // a newer request superseded this one
      if (be?.result?.best) setBestExec(be);
      else setBestExec(localBestExec(sym, size));
      if (ar?.result?.buy) setArb(ar);
      else setArb(localArb(sym));
    } catch {
      if (id !== reqId.current) return;
      setBestExec(localBestExec(sym, size));
      setArb(localArb(sym));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(activeSymbol, debouncedSize);
  }, [activeSymbol, debouncedSize, load]);

  const mode = bestExec.mode;

  return (
    <>
      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">
                <Search size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                Best execution engine
              </span>
              <h2 className="section-title" style={{ marginTop: 8 }}>
                Pick a stock and a size. See the true best route.
              </h2>
              <p className="section-sub">
                Every issuer token for the same underlying, priced across on-chain pools, the central
                book and issuer primary, then ranked by all-in landed cost.
              </p>
            </div>
            {mounted ? (
              <span className="fetch-meta">
                <span className={`pill ${mode === "live" ? "pill-live" : "pill-demo"}`}>
                  <span className="dot" />
                  {mode === "live" ? "Live data" : "Demo data"}
                </span>
                updated {relativeTime(bestExec.fetchedAt)}
              </span>
            ) : null}
          </div>

          <div className="console-grid">
            <TradePanel
              symbols={symbols}
              activeSymbol={activeSymbol}
              onSelectSymbol={setActiveSymbol}
              sizeUsd={sizeUsd}
              onSizeChange={setSizeUsd}
              side={side}
              onSideChange={setSide}
              premiumBySymbol={premiumBySymbol}
            />
            <div className={`stack${loading ? " loading-dim" : ""}`}>
              <BestExecCard result={bestExec.result} mode={mode} sizeUsd={bestExec.sizeUsd} />
              <KpiRow result={bestExec.result} />
              <div className="card card-pad">
                <div className="card-head">
                  <div className="card-title">All routes, ranked by landed cost</div>
                  <span className="card-note">{bestExec.result.ranked.length} venues</span>
                </div>
                <RouteLadder result={bestExec.result} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="radar">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">
                <Radar size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                Cross-issuer premium radar
              </span>
              <h2 className="section-title" style={{ marginTop: 8 }}>
                The same stock, priced differently across issuers.
              </h2>
              <p className="section-sub">
                Each venue for {activeSymbol}, measured in basis points against the true underlying.
                Left of center trades cheap, right trades rich. That gap is the arb signal.
              </p>
            </div>
          </div>

          <div className="radar-grid">
            <div className="card card-pad">
              <div className="card-head">
                <div className="card-title">{activeSymbol} premium by venue</div>
                <span className="card-note">
                  true ${bestExec.result.fairValue.usd.toFixed(2)} · Chainlink reference
                </span>
              </div>
              <PremiumRadar result={bestExec.result} />
            </div>
            <ArbCard arb={arb.result} />
          </div>
        </div>
      </section>
    </>
  );
}
