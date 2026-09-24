// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import type { Metadata } from "next";
import { ArrowUpRight, Boxes, Braces, Cpu, GitBranch, Wallet } from "lucide-react";
import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";

export const metadata: Metadata = {
  title: "Developers · OpenTape",
  description:
    "Build on OpenTape: the typed @opentape/sdk engine, the HTTP endpoints for best execution, arb, tape and underlyings, the injected-wallet execute path and the on-chain executor contract.",
};

const ENDPOINTS = [
  { method: "GET", path: "/api/bestexec/[symbol]?sizeUsd=", desc: "Ranks every venue for a symbol and size by all-in landed cost." },
  { method: "GET", path: "/api/arb/[symbol]", desc: "The cross-issuer arb signal: buy cheapest, sell dearest, net of fees." },
  { method: "GET", path: "/api/tape", desc: "The consolidated tape, one premium row per tracked underlying." },
  { method: "GET", path: "/api/underlyings", desc: "The catalog of tracked canonical symbols." },
];

const SDK_SNIPPET = `import {
  getBestExecution,
  getArbSpread,
  getConsolidatedTape,
  listUnderlyings,
  registerDefaultAdapters,
} from "@opentape/sdk";

registerDefaultAdapters();
const best = await getBestExecution("AAPL", 10_000);
console.log(best.best.venueId, best.savingsBpsVsWorst);`;

const ABI_SNIPPET = `function executeBestRoute(
  address tokenOut,
  uint256 amountIn,
  uint256 minAmountOut,
  address recipient
) returns (uint256 amountOut)`;

export default function DevelopersPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="page-hero">
          <div className="container">
            <span className="eyebrow">Developers</span>
            <h1>The tape is a library, an API and a contract.</h1>
            <p className="lede">
              Everything the product shows runs on a typed engine you can call yourself. Read prices
              over HTTP, price a route in the SDK or execute the best permissionless route straight
              from an injected wallet.
            </p>
            <nav className="page-nav">
              <a href="#sdk">SDK</a>
              <a href="#api">API endpoints</a>
              <a href="#wallet-skill">Wallet skill</a>
              <a href="#executor">Executor contract</a>
              <a href="#github">GitHub</a>
            </nav>
          </div>
        </section>

        <section className="section" id="sdk">
          <div className="container">
            <div className="section-head">
              <div>
                <span className="eyebrow">
                  <Boxes size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                  SDK
                </span>
                <h2 className="section-title" style={{ marginTop: 8 }}>
                  @opentape/sdk, typed and pure.
                </h2>
                <p className="section-sub">
                  The engine that maps issuers, prices venues and ranks routes. No network state on
                  the caller, the same result on the server and in a test.
                </p>
              </div>
            </div>
            <pre className="code-block">{SDK_SNIPPET}</pre>
          </div>
        </section>

        <section className="section section-alt" id="api">
          <div className="container">
            <div className="section-head">
              <div>
                <span className="eyebrow">
                  <Braces size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                  API endpoints
                </span>
                <h2 className="section-title" style={{ marginTop: 8 }}>
                  Four read endpoints, live with a labeled fallback.
                </h2>
                <p className="section-sub">
                  Each handler calls the SDK server-side and returns live data. If a source is not
                  reachable it returns a clearly labeled demo set, so the response never blanks. The
                  quoting functions are pinned to the Mumbai region so the Binance book is reachable.
                </p>
              </div>
            </div>
            <div className="endpoint-list">
              {ENDPOINTS.map((e) => (
                <div className="endpoint" key={e.path}>
                  <span className="endpoint-method">{e.method}</span>
                  <div>
                    <div className="endpoint-path">{e.path}</div>
                    <div className="endpoint-desc">{e.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="wallet-skill">
          <div className="container">
            <div className="section-head">
              <div>
                <span className="eyebrow">
                  <Wallet size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                  Wallet skill
                </span>
                <h2 className="section-title" style={{ marginTop: 8 }}>
                  One click, from the wallet already in the browser.
                </h2>
                <p className="section-sub">
                  The execute path uses an injected EIP-1193 provider through viem. It connects,
                  makes sure the wallet is on BNB Smart Chain, then sends the best route.
                </p>
              </div>
            </div>
            <div className="def-list">
              <div className="def-row">
                <div className="def-term">Connect</div>
                <div className="def-desc">Requests accounts from the injected provider and tracks the active chain.</div>
              </div>
              <div className="def-row">
                <div className="def-term">Ensure chain</div>
                <div className="def-desc">Switches to BNB Smart Chain, adding it with <code>wallet_addEthereumChain</code> if the wallet does not know it.</div>
              </div>
              <div className="def-row">
                <div className="def-term">Execute</div>
                <div className="def-desc">Only permissionless DEX routes run. The path is guarded on <code>NEXT_PUBLIC_EXECUTOR_ADDRESS</code>, so nothing sends until the contract is live.</div>
              </div>
            </div>
          </div>
        </section>

        <section className="section section-alt" id="executor">
          <div className="container">
            <div className="section-head">
              <div>
                <span className="eyebrow">
                  <Cpu size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                  Executor contract
                </span>
                <h2 className="section-title" style={{ marginTop: 8 }}>
                  A thin best-route swap on BNB Chain.
                </h2>
                <p className="section-sub">
                  The client builds one call: swap the input stable into the chosen token through the
                  PancakeSwap router with a slippage floor. The address is injected at deploy time and
                  the ABI is confirmed against the deployed contract before any mainnet call.
                </p>
              </div>
            </div>
            <pre className="code-block">{ABI_SNIPPET}</pre>
          </div>
        </section>

        <section className="section" id="github">
          <div className="container">
            <div className="section-head">
              <div>
                <span className="eyebrow">
                  <GitBranch size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                  GitHub
                </span>
                <h2 className="section-title" style={{ marginTop: 8 }}>
                  Read the source and the tests.
                </h2>
                <p className="section-sub">
                  OpenTape ships source-available under LicenseRef-zkasuran-SAND-1.0. The engine, the
                  adapters and the suite that proves them are published under the zkasuran account.
                </p>
              </div>
            </div>
            <a className="link-out" href="https://github.com/zkasuran" target="_blank" rel="noreferrer">
              github.com/zkasuran
              <ArrowUpRight size={15} />
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
