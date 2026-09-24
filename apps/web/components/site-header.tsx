// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import Link from "next/link";
import { NavMenu } from "./nav-menu";
import { ThemeToggle } from "./theme";
import { WalletButton } from "./wallet-button";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Link className="brand" href="/" aria-label="OpenTape home">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          OpenTape
        </Link>

        <NavMenu />

        <div className="header-actions">
          <span className="pill pill-bnb hide-sm" title="Runs on BNB Smart Chain">
            <span className="dot" />
            BNB Chain
          </span>
          <ThemeToggle />
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
