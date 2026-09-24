// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import type { Metadata } from "next";
import { Activity, CircleCheckBig, Info, ListChecks, Scale, ShieldAlert } from "lucide-react";
import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";

export const metadata: Metadata = {
  title: "Reports · OpenTape",
  description:
    "How OpenTape holds up: the validation metrics, the methodology behind best price and premium, an honest note on what is live versus a signal, plus how the build is verified.",
};

const METRICS = [
  { value: "6", label: "Underlyings tracked", hint: "Canonical symbols, each mapped across issuers." },
  { value: "5", label: "Venues per symbol", hint: "Priced and ranked on every quote." },
  { value: "3", label: "Issuers mapped", hint: "xStocks, bStocks and Ondo onto one tape." },
  { value: "1.0%", label: "Slippage floor", hint: "Enforced on every one-click execute." },
];

const FORMULAS = [
  { term: "Fair value", desc: "The Chainlink reference price for the underlying, in USD per share." },
  { term: "Landed per share", desc: "pxPerExposureUsd + (feeUsd + gasUsd) / shares, where shares = sizeUsd / fairValue." },
  { term: "Premium (bps)", desc: "(pxPerExposureUsd / fairValue - 1) x 10000. Positive is rich, negative is a discount." },
  { term: "Best route", desc: "The lowest landed-per-share venue. Savings equals worst landed premium minus best, in bps." },
  { term: "Arb net (bps)", desc: "gross dispersion minus round-trip cost, where round-trip folds both legs' fees and gas over the size." },
];

const CHECKS = [
  { head: "Types are clean", body: "The web app type-checks with no errors under strict TypeScript." },
  { head: "It builds for production", body: "next build compiles and prerenders every route without a failure." },
  { head: "One source of truth for the math", body: "The demo dataset and the UI read the same landed-cost functions, so a quote is ranked and shown the same way everywhere." },
  { head: "The product never blanks", body: "Every read endpoint falls back to a clearly labeled demo set, so a source outage degrades to demo, not to an empty screen." },
  { head: "The gated leg is reachable", body: "The quoting routes are pinned to the Mumbai region so the Binance public book resolves where US regions are blocked." },
];

export default function ReportsPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="page-hero">
          <div className="container">
            <span className="eyebrow">Reports</span>
            <h1>What the tape measures and how honest it is about it.</h1>
            <p className="lede">
              OpenTape is a neutral advisor, so the method and the limits are part of the product, not
              a footnote. Here is what is computed, how, what is live versus a signal, then how the
              build is verified.
            </p>
            <nav className="page-nav">
              <a href="#validation">Validation metrics</a>
              <a href="#methodology">Methodology</a>
              <a href="#limits">Honesty and limits</a>
              <a href="#tests">Tests and verification</a>
            </nav>
          </div>
        </section>

        <section className="section" id="validation" style={{ paddingTop: 12 }}>
          <div className="container">
            <div className="section-head">
              <div>
                <span className="eyebrow">
                  <Activity size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                  Validation metrics
                </span>
                <h2 className="section-title" style={{ marginTop: 8 }}>
                  The shape of what the engine covers.
                </h2>
                <p className="section-sub">
                  Structural facts of the current build. Live price accuracy tracks the Chainlink
                  reference in real time; the demo dataset is internally consistent and always labeled
                  as demo in the product.
                </p>
              </div>
            </div>
            <div className="metric-grid">
              {METRICS.map((m) => (
                <div className="metric-tile" key={m.label}>
                  <div className="metric-value">{m.value}</div>
                  <div className="metric-label">{m.label}</div>
                  <div className="metric-hint">{m.hint}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section section-alt" id="methodology">
          <div className="container">
            <div className="section-head">
              <div>
                <span className="eyebrow">
                  <Scale size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                  Methodology
                </span>
                <h2 className="section-title" style={{ marginTop: 8 }}>
                  How best price and premium are computed.
                </h2>
                <p className="section-sub">
                  Every venue is folded to one comparable number: the all-in cost of one share of
                  exposure, measured against the true underlying.
                </p>
              </div>
            </div>
            <div className="def-list">
              {FORMULAS.map((f) => (
                <div className="def-row" key={f.term}>
                  <div className="def-term">{f.term}</div>
                  <div className="def-desc">{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="limits">
          <div className="container">
            <div className="section-head">
              <div>
                <span className="eyebrow">
                  <ShieldAlert size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                  Honesty and limits
                </span>
                <h2 className="section-title" style={{ marginTop: 8 }}>
                  What is live, what is a signal, what is demo.
                </h2>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="callout callout-info">
                <Info size={17} aria-hidden="true" />
                <div className="callout-body">
                  <b>Live with a labeled fallback.</b> The read endpoints call the engine server-side.
                  When a source is not reachable the response is a clearly labeled demo set, so the
                  product still renders. Demo numbers are synthetic but internally consistent. No
                  real token address is asserted in the demo path.
                </div>
              </div>
              <div className="callout callout-warn">
                <ShieldAlert size={17} aria-hidden="true" />
                <div className="callout-body">
                  <b>Arb is a signal, not a captured trade.</b> Redemption at Ondo and the Binance book
                  are KYC gated, so the dear side of the spread is priced, never routed to. One-click
                  execute only ever touches permissionless DEX routes. It stays disabled until the
                  executor contract address is set. This is not investment advice.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section section-alt" id="tests">
          <div className="container">
            <div className="section-head">
              <div>
                <span className="eyebrow">
                  <ListChecks size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                  Tests and verification
                </span>
                <h2 className="section-title" style={{ marginTop: 8 }}>
                  What was checked before shipping.
                </h2>
              </div>
            </div>
            <ul className="check-list">
              {CHECKS.map((c) => (
                <li className="check-item" key={c.head}>
                  <CircleCheckBig size={18} aria-hidden="true" />
                  <span>
                    <b>{c.head}.</b> {c.body}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
