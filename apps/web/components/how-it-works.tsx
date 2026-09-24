// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import { Layers, Scale, TrendingUp, Zap } from "lucide-react";

const STEPS = [
  {
    icon: Layers,
    title: "Map",
    body: "Same-underlying tokens across xStocks, bStocks and Ondo are mapped to one canonical stock, not treated as unrelated assets.",
  },
  {
    icon: Scale,
    title: "Price",
    body: "Every venue is quoted for your size, then measured against the Chainlink underlying reference in basis points.",
  },
  {
    icon: TrendingUp,
    title: "Rank",
    body: "Routes rank by all-in landed cost: venue price, fee, gas and slippage folded into one number.",
  },
  {
    icon: Zap,
    title: "Execute",
    body: "The best permissionless route executes in one click on BNB, with a slippage floor. Gated venues stay flagged, never faked.",
  },
];

export function HowItWorks() {
  return (
    <section className="section">
      <div className="container">
        <div className="section-head">
          <div>
            <span className="eyebrow">How OpenTape works</span>
            <h2 className="section-title" style={{ marginTop: 8 }}>
              A neutral tape, not another issuer.
            </h2>
          </div>
        </div>
        <div className="steps">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div className="step" key={s.title}>
                <div className="step-n">{i + 1}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Icon size={16} style={{ color: "var(--accent)" }} />
                  <h3>{s.title}</h3>
                </div>
                <p>{s.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
