// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
"use client";

import { useState } from "react";
import type { Address } from "viem";
import { CircleCheck, ExternalLink, Info, Lock, Zap } from "lucide-react";
import type { BestExecution, DataMode } from "../lib/types";
import { bps, price, shortAddress } from "../lib/format";
import { landedPerShare, landedPremiumBps } from "../lib/quote";
import { issuerLabel, isPermissionless, venueKindLabel, venueLabel } from "../lib/venue";
import { bscScanTx, executeBestRoute, isExecutorConfigured } from "../lib/executor";
import { useWallet } from "./wallet";

export function BestExecCard({
  result,
  mode,
  sizeUsd,
}: {
  result: BestExecution;
  mode: DataMode;
  sizeUsd: number;
}) {
  const { account, onBsc, connect, ensureBsc, provider, connecting } = useWallet();
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const fair = result.fairValue.usd;
  const best = result.best;
  const landed = landedPerShare(best, fair);
  const premiumBps = landedPremiumBps(best, fair);

  const bestPermissionless = result.ranked.find(isPermissionless) ?? null;
  const route = isPermissionless(best) ? best : bestPermissionless;
  const routesDiffer = route ? route.venueId !== best.venueId : false;

  const executorReady = isExecutorConfigured();
  const routeHasToken = Boolean(route?.tokenAddress);
  const canExecute = executorReady && routeHasToken && Boolean(account) && onBsc && !busy;

  async function handlePrimary() {
    setErr(null);
    setTxHash(null);
    if (!account) {
      await connect();
      return;
    }
    if (!onBsc) {
      await ensureBsc();
      return;
    }
    const p = provider();
    if (!p || !route?.tokenAddress) {
      setErr("A live on-chain route is required to execute.");
      return;
    }
    setBusy(true);
    try {
      const sharesOut = route.pxPerExposureUsd > 0 ? sizeUsd / route.pxPerExposureUsd : 0;
      const hash = await executeBestRoute({
        provider: p,
        account: account as Address,
        tokenOut: route.tokenAddress as Address,
        amountInUsd: sizeUsd,
        sharesOut,
      });
      setTxHash(hash);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Transaction failed.");
    } finally {
      setBusy(false);
    }
  }

  const primaryLabel = !account
    ? "Connect wallet to execute"
    : !onBsc
      ? "Switch to BNB Chain"
      : busy
        ? "Confirm in wallet..."
        : "Execute best route on BNB";

  return (
    <div className="card card-pad" id="bestexec">
      <div className="card-head">
        <div className="card-title">Best execution · {result.symbol}</div>
        <span className={`pill ${mode === "live" ? "pill-live" : "pill-demo"}`}>
          <span className="dot" />
          {mode === "live" ? "Live" : "Demo data"}
        </span>
      </div>

      <div className="result-top">
        <div>
          <span className="winner-badge">
            <CircleCheck size={14} />
            Best execution
          </span>
          <div className="winner-venue">
            {issuerLabel(best)} · {venueLabel(best)}
          </div>
          <div className="winner-sub">
            {venueKindLabel(best.venueKind)} · {best.priceImpactBps} bps impact on{" "}
            ${sizeUsd.toLocaleString("en-US")}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {isPermissionless(best) ? (
              <span className="tag tag-good">
                <Zap size={12} /> one-click on BNB
              </span>
            ) : (
              <span className="tag tag-kyc">
                <Lock size={12} /> {best.kycGated ? "KYC gated" : "off-chain"}
              </span>
            )}
            <span className="tag">via Chainlink reference</span>
          </div>
        </div>
        <div className="price-tag">
          <div className="px">${price(landed)}</div>
          <div className="px-sub">
            <span style={{ color: premiumBps <= 0 ? "var(--good)" : "var(--diverge-pos)" }}>
              {bps(premiumBps, { sign: true })}
            </span>{" "}
            vs true ${price(fair)}
          </div>
        </div>
      </div>

      <div className="execute-box">
        <button className="btn btn-bnb btn-lg" onClick={() => void handlePrimary()} disabled={busy || connecting}>
          <Zap size={16} />
          {primaryLabel}
        </button>

        {account && onBsc && !canExecute ? (
          <div className="note">
            <Info size={15} />
            <span>
              {!executorReady
                ? "Execution goes live once the OpenTape executor is deployed to BNB Chain. The route above is fully priced and ready."
                : "A live on-chain route with a token address is required to execute. This view is showing DEMO market data."}
            </span>
          </div>
        ) : null}

        {routesDiffer && route ? (
          <div className="note">
            <Info size={15} />
            <span>
              The best all-in price is on a gated venue. One click routes to the best permissionless
              DEX route instead: {issuerLabel(route)} · {venueLabel(route)}.
            </span>
          </div>
        ) : null}

        {txHash ? (
          <div className="execute-meta">
            <span>Submitted</span>
            <a className="tx-link" href={bscScanTx(txHash)} target="_blank" rel="noreferrer">
              {shortAddress(txHash)} <ExternalLink size={12} />
            </a>
          </div>
        ) : (
          <div className="execute-meta">
            <span>{account ? `Wallet ${shortAddress(account)}` : "No wallet connected"}</span>
            <span>Slippage floor 1.0% · settles on BSC mainnet</span>
          </div>
        )}

        {err ? <div className="err-line">{err}</div> : null}
      </div>
    </div>
  );
}
