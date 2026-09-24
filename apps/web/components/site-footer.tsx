// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
const SOURCES = ["Chainlink reference", "PancakeSwap pools", "Binance public book", "Ondo NAV"];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div style={{ maxWidth: "44ch" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span className="brand-mark" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
              <b style={{ color: "var(--text-secondary)" }}>OpenTape</b>
            </div>
            <p>
              A neutral, read-only consolidated tape and best-execution advisor for tokenized US
              stocks on BNB Chain. Prices come from public venues. Arb is a signal where redemption is
              gated, not a captured trade. This is not investment advice.
            </p>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              Data sources
            </div>
            <div className="footer-sources">
              {SOURCES.map((s) => (
                <span className="tag" key={s}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 26, fontSize: 12.5 }}>
          Source-available, no derivatives. LicenseRef-zkasuran-SAND-1.0.
        </div>
      </div>
    </footer>
  );
}
