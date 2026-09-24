// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
"use client";

import { WalletButton } from "./wallet-button";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <a className="brand" href="#top" aria-label="OpenTape home">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          OpenTape
        </a>
        <div className="header-actions">
          <span className="pill pill-bnb">
            <span className="dot" />
            BNB Chain
          </span>
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
