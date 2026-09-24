// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
"use client";

import { Wallet } from "lucide-react";
import { shortAddress } from "../lib/format";
import { useWallet } from "./wallet";

export function WalletButton() {
  const { account, connecting, connect, onBsc, ensureBsc, hasProvider } = useWallet();

  if (account) {
    if (!onBsc) {
      return (
        <button className="btn" onClick={() => void ensureBsc()}>
          <span className="dot" style={{ background: "var(--warning)" }} />
          Switch to BNB Chain
        </button>
      );
    }
    return (
      <span className="pill pill-live" title={account}>
        <span className="dot" />
        {shortAddress(account)}
      </span>
    );
  }

  return (
    <button className="btn btn-primary" onClick={() => void connect()} disabled={connecting}>
      <Wallet size={16} />
      {connecting ? "Connecting..." : hasProvider ? "Connect wallet" : "Get a wallet"}
    </button>
  );
}
