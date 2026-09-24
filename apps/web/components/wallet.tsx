// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Address, EIP1193Provider } from "viem";
import { BSC_CHAIN_ID } from "../lib/executor";

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

interface WalletState {
  account: Address | null;
  chainId: number | null;
  connecting: boolean;
  hasProvider: boolean;
  error: string | null;
  onBsc: boolean;
  connect: () => Promise<void>;
  ensureBsc: () => Promise<boolean>;
  provider: () => EIP1193Provider | null;
}

const WalletContext = createContext<WalletState | null>(null);

const BSC_HEX = `0x${BSC_CHAIN_ID.toString(16)}`;

function getProvider(): EIP1193Provider | null {
  if (typeof window === "undefined") return null;
  return window.ethereum ?? null;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [hasProvider, setHasProvider] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const provider = getProvider();
    setHasProvider(Boolean(provider));
    if (!provider) return;

    const syncChain = async () => {
      try {
        const id = (await provider.request({ method: "eth_chainId" })) as string;
        setChainId(Number.parseInt(id, 16));
      } catch {
        /* wallet declined, leave unset */
      }
    };
    const syncAccounts = async () => {
      try {
        const accs = (await provider.request({ method: "eth_accounts" })) as string[];
        setAccount((accs[0] as Address) ?? null);
      } catch {
        /* ignore */
      }
    };
    void syncChain();
    void syncAccounts();

    const onAccounts = (accs: unknown) => setAccount(((accs as string[])[0] as Address) ?? null);
    const onChain = (id: unknown) => setChainId(Number.parseInt(id as string, 16));
    const evt = provider as unknown as {
      on?: (event: string, handler: (arg: unknown) => void) => void;
      removeListener?: (event: string, handler: (arg: unknown) => void) => void;
    };
    evt.on?.("accountsChanged", onAccounts);
    evt.on?.("chainChanged", onChain);
    return () => {
      evt.removeListener?.("accountsChanged", onAccounts);
      evt.removeListener?.("chainChanged", onChain);
    };
  }, []);

  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      setError("No EIP-1193 wallet found. Install a BNB Chain compatible wallet.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const accs = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      setAccount((accs[0] as Address) ?? null);
      const id = (await provider.request({ method: "eth_chainId" })) as string;
      setChainId(Number.parseInt(id, 16));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wallet connection was rejected.");
    } finally {
      setConnecting(false);
    }
  }, []);

  const ensureBsc = useCallback(async () => {
    const provider = getProvider();
    if (!provider) return false;
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: BSC_HEX }],
      });
      setChainId(BSC_CHAIN_ID);
      return true;
    } catch (e) {
      const code = (e as { code?: number }).code;
      if (code === 4902) {
        try {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: BSC_HEX,
                chainName: "BNB Smart Chain",
                nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
                rpcUrls: ["https://bsc-dataseed.bnbchain.org"],
                blockExplorerUrls: ["https://bscscan.com"],
              },
            ],
          });
          setChainId(BSC_CHAIN_ID);
          return true;
        } catch {
          setError("Could not add BNB Smart Chain to the wallet.");
          return false;
        }
      }
      setError("Switch the wallet to BNB Smart Chain to execute.");
      return false;
    }
  }, []);

  const value = useMemo<WalletState>(
    () => ({
      account,
      chainId,
      connecting,
      hasProvider,
      error,
      onBsc: chainId === BSC_CHAIN_ID,
      connect,
      ensureBsc,
      provider: getProvider,
    }),
    [account, chainId, connecting, hasProvider, error, connect, ensureBsc],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
