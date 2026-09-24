// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
/// <reference types="node" />
import type { CanonicalSymbol, FairValue, Quote, VenueAdapter } from "../types";
import { UNDERLYINGS } from "../catalog";
import { getFairValue } from "../fairvalue/chainlink";

// Ondo Global Markets (Ondo Stocks) is the issuer NAV / mint-redeem reference on BNB Chain.
// Verified against primary sources (2026-09-24):
//   - Live on BNB Chain, 100+ tokenized US stocks & ETFs:
//       https://ondo.finance/blog/global-markets-live-on-bnb-chain
//       https://www.bnbchain.org/en/blog/ondo-global-markets-brings-100-tokenized-u-s-stocks-etfs-to-bnb-chain
//   - Tokens are TOTAL-RETURN trackers: a "shares per token" factor grows as dividends/interest
//     reinvest, so token price = sharesPerToken * underlyingPrice and 1 token != 1 share. BNB Chain
//     and Solana also apply a display multiplier:
//       https://docs.ondo.finance/ondo-global-markets/token-and-quote-pricing
//   - Mint/redeem is gated: whitelisted address + attestation signature, non-US, onboarding by request
//     (IGMTokenManager). Not permissionless -> kycGated:true, executable:false:
//       https://docs.ondo.finance/api-reference/overview
//   - Public price API requires an x-api-key (401 MISSING_API_KEY without one). Response carries the
//     token price and the underlying price:
//       GET https://api.gm.ondo.finance/v1/assets/{symbol}/prices/latest
//       https://docs.ondo.finance/api-reference/assets/get-current-price-for-an-asset
// This adapter is the arb-convergence anchor, not an executable leg. It emits pxPerExposureUsd in
// USD per one underlying-share-equivalent (the total-return multiplier is divided back out), so an
// Ondo primary-market quote reads as par to fair value. DEX/CEX premiums are then measured against it.
// We never invent a contract address, so tokenAddress is left undefined until an on-chain read verifies it.

const FETCH_TIMEOUT_MS = 4000;
const DEFAULT_API_BASE = "https://api.gm.ondo.finance/v1";
const SUPPORTED = new Set(UNDERLYINGS.map((s) => s.toUpperCase()));

export interface OndoNavInputs {
  underlyingUsd: number; // fair value of one underlying share, USD
  sharesPerToken: number; // total-return multiplier (>= 1 as dividends reinvest)
}

export interface OndoNav {
  tokenPriceUsd: number; // mint/redeem NAV per token = underlyingUsd * sharesPerToken
  underlyingUsd: number; // fair value per underlying share
  sharesPerToken: number; // total-return multiplier
  pxPerExposureUsd: number; // USD per one share-equivalent of exposure = tokenPriceUsd / sharesPerToken
}

// NAV from the underlying fair value and the total-return multiplier. Doc example: 1.05 * $110 = $115.50.
export function ondoNav({ underlyingUsd, sharesPerToken }: OndoNavInputs): OndoNav {
  const tokenPriceUsd = underlyingUsd * sharesPerToken;
  const pxPerExposureUsd = sharesPerToken > 0 ? tokenPriceUsd / sharesPerToken : Number.NaN;
  return { tokenPriceUsd, underlyingUsd, sharesPerToken, pxPerExposureUsd };
}

// Shape of GET /v1/assets/{symbol}/prices/latest (AssetPrice). Prices are string-encoded decimals.
export interface OndoAssetPrice {
  primaryMarket: { symbol: string; price: string };
  underlyingMarket: { ticker: string; price: string };
  timestamp: number;
}

// Derive the multiplier and NAV from the API response. The primary market is par to NAV by construction,
// so sharesPerToken = tokenPrice / underlyingPrice and pxPerExposureUsd = underlyingPrice.
export function ondoNavFromApi(resp: OndoAssetPrice): OndoNav {
  const tokenPriceUsd = Number(resp.primaryMarket.price);
  const underlyingUsd = Number(resp.underlyingMarket.price);
  const sharesPerToken = underlyingUsd > 0 ? tokenPriceUsd / underlyingUsd : Number.NaN;
  const pxPerExposureUsd = sharesPerToken > 0 ? tokenPriceUsd / sharesPerToken : Number.NaN;
  return { tokenPriceUsd, underlyingUsd, sharesPerToken, pxPerExposureUsd };
}

// --- configurable, injectable dependencies (no config param on the fixed VenueAdapter interface) ---

type FairValueFn = (symbol: CanonicalSymbol) => Promise<FairValue>;
let fairValueProvider: FairValueFn | null = null;
let configuredKey: string | null | undefined; // undefined = fall back to env; ""/null = disabled; string = use it
const multiplierOverrides = new Map<string, number>();

// Inject a fair-value source (defaults to the Chainlink fair value). Used by tests and the orchestrator.
export function setOndoFairValueProvider(fn: FairValueFn | null): void {
  fairValueProvider = fn;
}

// Set the Ondo GM API key (defaults to process.env.ONDO_API_KEY). Never hardcode a key.
export function setOndoApiKey(key: string | null | undefined): void {
  configuredKey = key;
}

// Feed the real on-chain shares-per-token multiplier for a symbol. Absent, approx mode assumes 1.0.
export function setOndoMultiplier(symbol: string, sharesPerToken: number): void {
  multiplierOverrides.set(symbol.toUpperCase(), sharesPerToken);
}

export function resetOndoConfig(): void {
  fairValueProvider = null;
  configuredKey = undefined;
  multiplierOverrides.clear();
}

function apiKey(): string | undefined {
  const k = configuredKey === undefined ? process.env.ONDO_API_KEY : configuredKey;
  return k ? k : undefined;
}

function apiBase(): string {
  return process.env.ONDO_API_BASE || DEFAULT_API_BASE;
}

function fairValue(symbol: CanonicalSymbol): Promise<FairValue> {
  return (fairValueProvider ?? getFairValue)(symbol);
}

function multiplierFor(sym: string): number {
  return multiplierOverrides.get(sym) ?? 1.0;
}

function isSupported(sym: string): boolean {
  return SUPPORTED.has(sym);
}

// Ondo GM symbol convention: underlying ticker + "on" (docs example: AAPLon). Not a contract address.
function toGmSymbol(sym: string): string {
  return `${sym}on`;
}

// Docs describe the timestamp as milliseconds but the example looks like seconds; normalize either way.
function normalizeTs(t: number): number {
  if (!Number.isFinite(t) || t <= 0) return Date.now();
  return t < 1e12 ? Math.round(t * 1000) : Math.round(t);
}

async function fetchOndoPrice(gm: string, key: string): Promise<OndoAssetPrice | null> {
  const url = `${apiBase()}/assets/${encodeURIComponent(gm)}/prices/latest`;
  const res = await fetch(url, {
    headers: { "x-api-key": key, accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Partial<OndoAssetPrice> | null;
  const pm = data?.primaryMarket;
  const um = data?.underlyingMarket;
  if (!pm?.price || !um?.price) return null;
  return {
    primaryMarket: { symbol: pm.symbol ?? gm, price: pm.price },
    underlyingMarket: { ticker: um.ticker ?? "", price: um.price },
    timestamp: typeof data?.timestamp === "number" ? data.timestamp : Date.now(),
  };
}

function buildQuote(
  symbol: CanonicalSymbol,
  gm: string,
  sizeUsd: number,
  nav: OndoNav,
  ts: number,
  source: string,
): Quote {
  const live = source.startsWith("ondo-gm");
  return {
    venueId: live ? `ondo:gm:${gm}` : `ondo:nav:${symbol}`,
    venueKind: "issuer",
    issuer: "ondo",
    symbol,
    // tokenAddress intentionally omitted: no verified on-chain address (never invent one).
    sizeUsd,
    pxPerExposureUsd: nav.pxPerExposureUsd,
    feeUsd: 0, // Ondo's mint/redeem spread is quote-specific and not publicly fixed; the NAV reference models none.
    gasUsd: 0, // reference only, not executed on-chain by this adapter.
    priceImpactBps: 0, // NAV reference is size-independent.
    executable: false, // mint/redeem is whitelist + attestation gated, not a permissionless leg.
    kycGated: true,
    ts,
    source,
  };
}

export const ondoAdapter: VenueAdapter = {
  id: "ondo",
  async supports(symbol: CanonicalSymbol): Promise<boolean> {
    return isSupported(symbol.toUpperCase());
  },
  async quotes(symbol: CanonicalSymbol, sizeUsd: number): Promise<Quote[]> {
    const sym = symbol.toUpperCase();
    if (!isSupported(sym)) return [];
    const gm = toGmSymbol(sym);

    // 1) Live Ondo GM API when a key is configured. A network failure must never throw here.
    const key = apiKey();
    if (key) {
      try {
        const resp = await fetchOndoPrice(gm, key);
        if (resp) {
          const nav = ondoNavFromApi(resp);
          if (Number.isFinite(nav.pxPerExposureUsd) && nav.pxPerExposureUsd > 0) {
            return [buildQuote(sym, gm, sizeUsd, nav, normalizeTs(resp.timestamp), "ondo-gm-api")];
          }
        }
      } catch {
        // fall through to the NAV approximation
      }
    }

    // 2) NAV approximation: underlying fair value * multiplier, clearly labeled.
    try {
      const fv = await fairValue(sym);
      if (fv && Number.isFinite(fv.usd) && fv.usd > 0) {
        const mult = multiplierFor(sym);
        const nav = ondoNav({ underlyingUsd: fv.usd, sharesPerToken: mult });
        return [buildQuote(sym, gm, sizeUsd, nav, Date.now(), `ondo-nav-approx(mult=${mult},fv=${fv.source})`)];
      }
    } catch {
      // no fair value available: emit no quote rather than crash the tape
    }

    return [];
  },
};
