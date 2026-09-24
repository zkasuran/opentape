// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import type { Metadata } from "next";
import { Banknote, Building2, Layers, ShieldCheck, Waypoints, Zap, type LucideIcon } from "lucide-react";
import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";

export const metadata: Metadata = {
  title: "Venues · OpenTape",
  description:
    "Where OpenTape reads prices: the Chainlink reference it measures against, the PancakeSwap pools it can execute on plus the Binance book and Ondo primary it prices as signals.",
};

interface VenueInfo {
  id: string;
  icon: LucideIcon;
  name: string;
  tag: { label: string; cls: string; withZap?: boolean };
  body: string;
  feeds: string;
}

const VENUES: VenueInfo[] = [
  {
    id: "chainlink",
    icon: Waypoints,
    name: "Chainlink reference",
    tag: { label: "reference", cls: "tag" },
    body: "The true underlying price for each stock. It is not a place to trade, it is the yardstick. Every venue on the tape is measured against this reference in basis points, so a premium or a discount always means the same thing.",
    feeds: "Feeds the fair value behind best execution, the radar and the arb signal.",
  },
  {
    id: "pancakeswap",
    icon: Layers,
    name: "PancakeSwap",
    tag: { label: "permissionless", cls: "tag tag-good", withZap: true },
    body: "On-chain pools holding tokenized stocks from more than one issuer. These routes are permissionless, so a browser wallet can settle them without an account. This is the only venue class the one-click executor will route to.",
    feeds: "The executable leg. Best-execution routing lands here first.",
  },
  {
    id: "binance",
    icon: Building2,
    name: "Binance",
    tag: { label: "gated", cls: "tag tag-kyc" },
    body: "A central order book with deep liquidity and tight spreads. It is a real quote and it belongs on the tape, but it is account and KYC gated, so the one-click executor never sends an order to it. It is priced, not traded.",
    feeds: "A priced quote on the tape and in the arb signal, flagged as gated.",
  },
  {
    id: "ondo",
    icon: Banknote,
    name: "Ondo",
    tag: { label: "gated", cls: "tag tag-kyc" },
    body: "Issuer mint and redeem at net asset value. This is where the discount to true value can close, but access is institutional and KYC gated. OpenTape shows it as the dear side of the arb, honestly labeled as a signal rather than a permissionless trade.",
    feeds: "The redeem leg of the arb signal, never presented as executable.",
  },
];

export default function VenuesPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="page-hero">
          <div className="container">
            <span className="eyebrow">Venues</span>
            <h1>Every price OpenTape reads and how far it can act on each.</h1>
            <p className="lede">
              The same stock trades in very different places. OpenTape reads all of them, prices each
              against the Chainlink reference, then draws a hard line between what a wallet can execute
              and what is a signal only.
            </p>
            <nav className="page-nav">
              {VENUES.map((v) => (
                <a key={v.id} href={`#${v.id}`}>
                  {v.name}
                </a>
              ))}
            </nav>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="feature-grid">
              {VENUES.map((v) => {
                const Icon = v.icon;
                return (
                  <article className="feature-card" id={v.id} key={v.id}>
                    <div className="feature-icon" aria-hidden="true">
                      <Icon size={20} />
                    </div>
                    <h3>{v.name}</h3>
                    <div className="feature-meta">
                      <span className={v.tag.cls}>
                        {v.tag.withZap ? <Zap size={12} /> : v.tag.cls.includes("kyc") ? null : <ShieldCheck size={12} />}
                        {v.tag.label}
                      </span>
                    </div>
                    <p style={{ marginTop: 12 }}>{v.body}</p>
                    <p className="card-note" style={{ marginTop: 12 }}>
                      {v.feeds}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
