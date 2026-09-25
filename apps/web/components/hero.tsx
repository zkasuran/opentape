// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import { ArrowRight, Layers, Scale, ShieldCheck } from "lucide-react";

export function Hero() {
  return (
    <section className="hero" id="top">
      <div className="container hero-grid">
        <div className="hero-lead">
          <span className="eyebrow">Consolidated tape · Best execution · BNB Chain</span>
          <h1>
            Trade any tokenized stock at the <span className="grad">true best price</span> across every
            issuer, one click on BNB.
          </h1>
          <div className="hero-points">
            <div className="hero-point">
              <Layers size={18} />
              <span>
                <b>One book, every issuer.</b> Same-underlying tokens mapped and compared, not treated
                as unrelated assets.
              </span>
            </div>
            <div className="hero-point">
              <Scale size={18} />
              <span>
                <b>Priced against the truth.</b> Every venue measured in basis points versus the Chainlink
                underlying reference.
              </span>
            </div>
            <div className="hero-point">
              <ShieldCheck size={18} />
              <span>
                <b>Honest about execution.</b> Permissionless DEX routes execute in one click. Gated
                venues are flagged, never faked.
              </span>
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <HeroPreview />
          <div className="hero-aside">
            <p className="hero-lede">
              The same stock trades as xStocks, bStocks and Ondo, spread across PancakeSwap pools, the
              Binance book and issuer mint. OpenTape scans every venue, prices each one against the true
              underlying and routes your order to the cheapest venue you can actually reach.
            </p>
            <div className="hero-cta">
              <a className="btn btn-primary btn-lg" href="#console" style={{ width: "auto" }}>
                Find best execution
                <ArrowRight size={16} />
              </a>
              <a className="btn btn-ghost btn-lg" href="#radar" style={{ width: "auto" }}>
                See the premium radar
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroPreview() {
  return (
    <div className="card card-pad" aria-hidden="true">
      <div className="card-head">
        <div className="card-title">AAPL · best route</div>
        <span className="pill pill-demo">
          <span className="dot" />
          Preview
        </span>
      </div>
      <div className="result-top">
        <div>
          <span className="winner-badge">Best execution</span>
          <div className="winner-venue">xStocks</div>
          <div className="winner-sub">PancakeSwap v3 · permissionless</div>
        </div>
        <div className="price-tag">
          <div className="px">$232.41</div>
          <div className="px-sub">+11 bps vs true</div>
        </div>
      </div>
      <div className="issuer-row">
        <span className="issuer-chip">
          <span className="swatch" style={{ background: "var(--series-1)" }} />
          xStocks
        </span>
        <span className="issuer-chip">
          <span className="swatch" style={{ background: "var(--series-2)" }} />
          bStocks
        </span>
        <span className="issuer-chip">
          <span className="swatch" style={{ background: "var(--series-3)" }} />
          Ondo
        </span>
      </div>
    </div>
  );
}
