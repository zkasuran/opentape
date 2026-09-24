// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import Link from "next/link";

const SOURCES = ["Chainlink reference", "PancakeSwap pools", "Binance public book", "Ondo NAV"];

const PRODUCT_LINKS = [
  { label: "Best execution", href: "/#bestexec" },
  { label: "Consolidated tape", href: "/#tape" },
  { label: "Premium radar", href: "/#radar" },
  { label: "Arb signal", href: "/#arb" },
];
const EXPLORE_LINKS = [
  { label: "Venues", href: "/venues" },
  { label: "Developers", href: "/developers" },
  { label: "Reports", href: "/reports" },
];
const TRUST_LINKS = [
  { label: "Validation metrics", href: "/reports#validation" },
  { label: "Honesty and limits", href: "/reports#limits" },
  { label: "Methodology", href: "/reports#methodology" },
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top">
          <div className="footer-brand">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="brand-mark" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
              <b style={{ color: "var(--text-primary)", fontSize: 15 }}>OpenTape</b>
            </div>
            <p>
              A neutral, read-only consolidated tape and best-execution advisor for tokenized US
              stocks on BNB Chain. Prices come from public venues. Arb is a signal where redemption
              is gated, not a captured trade. This is not investment advice.
            </p>
          </div>
          <div className="footer-col">
            <h4>Product</h4>
            {PRODUCT_LINKS.map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
          </div>
          <div className="footer-col">
            <h4>Explore</h4>
            {EXPLORE_LINKS.map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
          </div>
          <div className="footer-col">
            <h4>Trust</h4>
            {TRUST_LINKS.map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="footer-bottom">
          <span>Source-available, no derivatives. LicenseRef-zkasuran-SAND-1.0.</span>
          <div className="footer-sources">
            {SOURCES.map((s) => (
              <span className="tag" key={s}>
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
