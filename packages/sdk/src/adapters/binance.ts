// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
/// <reference types="node" />
import type { CanonicalSymbol, Quote, VenueAdapter } from "../types";

// Binance public-market-data venue adapter: the CEX leg for bStocks (tokenized US equities).
//
// VERIFIED against primary sources (2026-09-24):
//   * Binance public REST DOES list tokenized-stock spot pairs, no API key required.
//     Symbol format is `<TICKER>B` (base) + `USDT` (quote), e.g. AAPL -> AAPLBUSDT,
//     TSLA -> TSLABUSDT, NVDA -> NVDABUSDT. Confirmed live from:
//       - https://api.binance.com/api/v3/exchangeInfo  (base "AAPLB"/"TSLAB"/... , quote "USDT", status TRADING, spot)
//       - https://api.binance.com/api/v3/depth?symbol=NVDABUSDT&limit=5  (real two-sided book, tight spread)
//       - https://api.binance.com/api/v3/ticker/24hr?symbol=AAPLBUSDT  (price ~ the real share price, real volume)
//   * These pairs are "bStocks": fully-backed tokenized securities representing select U.S. stocks
//     issued by BTech Holding, admitted to trading on Binance Exchange (launched 2026-06-12). Sources:
//       - https://www.prnewswire.com/news-releases/binance-exchange-launches-bstocks-tokenized-securities-11-backing-and-247-trading-302798876.html
//       - https://www.binance.com/en/how-to-buy/tesla-tokenized-bstocks
//     Offered under an ADGM Approved Prospectus, subject to regional availability and eligibility.
//
// HONESTY: the order book (price + liquidity) is public and real, so the quote is real. But actually
// placing a trade needs a Binance account with regional eligibility, which is reflected in `source`.
// The public read path needs no key, so `kycGated` is false and `executable` follows real fillability.
// `supports()` returns false for any symbol with no known bStock pair, so the venue contributes nothing
// (rather than faking a number) when it has no market for the underlying.

const BINANCE_REST_BASE = "https://api.binance.com";

// Binance spot standard taker fee is 0.10% (VIP 0). A market order that walks the book is a taker order,
// so this is the fee that lands on the executed notional. Documented default; adjust per fee tier.
export const TAKER_FEE_BPS = 10;

// Order-book depth we pull. Binance /api/v3/depth accepts 5,10,20,50,100,500,1000,5000; 1000 covers
// realistic sizes on the liquid bStock pairs without over-fetching.
export const DEPTH_LIMIT = 1000;

const FETCH_TIMEOUT_MS = 8000;

const SOURCE =
  "binance-public:/api/v3/depth (bStocks by BTech Holding, 1:1-backed tokenized US equities; " +
  "live public order book, no API key; placing a real trade needs a Binance account and regional " +
  "eligibility per the ADGM prospectus)";

// Canonical underlying -> Binance bStock spot symbol. Every entry was verified live against
// /api/v3/exchangeInfo (base "<TICKER>B", quote "USDT", status TRADING, spot allowed). Extend only
// with pairs checked the same way; never map a symbol to a guessed pair.
export const BSTOCK_PAIRS: Readonly<Record<string, string>> = {
  AAPL: "AAPLBUSDT",
  TSLA: "TSLABUSDT",
  NVDA: "NVDABUSDT",
  SPY: "SPYBUSDT",
  GOOGL: "GOOGLBUSDT",
  META: "METABUSDT",
  MSFT: "MSFTBUSDT",
  AMZN: "AMZNBUSDT",
  NFLX: "NFLXBUSDT",
  COIN: "COINBUSDT",
  MSTR: "MSTRBUSDT",
  CRCL: "CRCLBUSDT",
  AMD: "AMDBUSDT",
  PLTR: "PLTRBUSDT",
  HOOD: "HOODBUSDT",
  MU: "MUBUSDT",
  SNDK: "SNDKBUSDT",
  ORCL: "ORCLBUSDT",
  AVGO: "AVGOBUSDT",
  ARM: "ARMBUSDT",
  TSM: "TSMBUSDT",
  ASML: "ASMLBUSDT",
  IBM: "IBMBUSDT",
  GS: "GSBUSDT",
  PYPL: "PYPLBUSDT",
  CRM: "CRMBUSDT",
  GME: "GMEBUSDT",
  MRNA: "MRNABUSDT",
  CRWD: "CRWDBUSDT",
  RDDT: "RDDTBUSDT",
  QCOM: "QCOMBUSDT",
  INTC: "INTCBUSDT",
  SMCI: "SMCIBUSDT",
  DELL: "DELLBUSDT",
  AMAT: "AMATBUSDT",
  QQQ: "QQQBUSDT",
};

/** Map a canonical underlying (case-insensitive) to its Binance bStock symbol, or undefined. */
export function bstockSymbolFor(symbol: string): string | undefined {
  return BSTOCK_PAIRS[symbol.toUpperCase()];
}

export interface DepthLevel {
  price: number;
  qty: number;
}

export interface BookWalk {
  filledUsd: number; // USD notional actually spent
  baseQty: number; // units of the token acquired
  avgPx: number; // filledUsd / baseQty (USD per unit); 0 if nothing filled
  fullyFilled: boolean; // whether the full sizeUsd was covered by the book
  bestPx: number; // top-of-book price, used as the price-impact reference; 0 if book empty
  priceImpactBps: number; // (avgPx / bestPx - 1) * 1e4, i.e. slippage vs the touch price
}

const EMPTY_WALK: BookWalk = {
  filledUsd: 0,
  baseQty: 0,
  avgPx: 0,
  fullyFilled: false,
  bestPx: 0,
  priceImpactBps: 0,
};

/**
 * Walk price levels for a BUY, spending up to `sizeUsd`. Levels must be sorted best-first (asks
 * ascending). Pure and deterministic: no network, safe to unit-test against a fixture book.
 */
export function walkBook(levels: DepthLevel[], sizeUsd: number): BookWalk {
  if (!Number.isFinite(sizeUsd) || sizeUsd <= 0 || levels.length === 0) return { ...EMPTY_WALK };
  const first = levels[0];
  if (!first || !(first.price > 0)) return { ...EMPTY_WALK };
  const bestPx = first.price;

  let remaining = sizeUsd;
  let baseQty = 0;
  let filledUsd = 0;
  for (const lvl of levels) {
    if (remaining <= 0) break;
    if (!(lvl.price > 0) || !(lvl.qty > 0)) continue;
    const levelUsd = lvl.price * lvl.qty;
    if (levelUsd <= remaining) {
      baseQty += lvl.qty;
      filledUsd += levelUsd;
      remaining -= levelUsd;
    } else {
      baseQty += remaining / lvl.price;
      filledUsd += remaining;
      remaining = 0;
    }
  }

  if (baseQty <= 0) return { ...EMPTY_WALK, bestPx };
  const avgPx = filledUsd / baseQty;
  const fullyFilled = remaining <= sizeUsd * 1e-9;
  const priceImpactBps = bestPx > 0 ? Math.max(0, (avgPx / bestPx - 1) * 1e4) : 0;
  return { filledUsd, baseQty, avgPx, fullyFilled, bestPx, priceImpactBps };
}

/**
 * Build the BUY-side Quote (cost to acquire exposure) from the ask side of a book. bStocks are
 * 1:1-backed, so the per-token USD price equals the USD cost per unit of economic exposure; core
 * normalization applies issuer multipliers (1x here). Returns undefined if the book yields no fill.
 */
export function buildBuyQuote(
  symbol: CanonicalSymbol,
  binanceSymbol: string,
  asks: DepthLevel[],
  sizeUsd: number,
): Quote | undefined {
  const walk = walkBook(asks, sizeUsd);
  if (!(walk.avgPx > 0) || walk.baseQty <= 0) return undefined;
  return {
    venueId: `binance:${binanceSymbol}`,
    venueKind: "cex",
    issuer: "bstocks",
    symbol: symbol.toUpperCase(),
    sizeUsd,
    pxPerExposureUsd: walk.avgPx,
    feeUsd: (walk.filledUsd * TAKER_FEE_BPS) / 1e4,
    gasUsd: 0,
    priceImpactBps: walk.priceImpactBps,
    // Honest fillability: true only when the visible book fully covers the requested size.
    executable: walk.fullyFilled,
    kycGated: false,
    ts: Date.now(),
    source: SOURCE,
  };
}

interface ParsedDepth {
  bids: DepthLevel[];
  asks: DepthLevel[];
}

/** Parse and validate a /api/v3/depth response into numeric levels. Returns undefined if malformed. */
export function parseDepth(data: unknown): ParsedDepth | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const raw = data as { bids?: unknown; asks?: unknown };
  const asks = parseLevels(raw.asks);
  const bids = parseLevels(raw.bids);
  if (!asks || !bids) return undefined;
  return { bids, asks };
}

function parseLevels(input: unknown): DepthLevel[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const out: DepthLevel[] = [];
  for (const entry of input) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const price = Number(entry[0]);
    const qty = Number(entry[1]);
    if (Number.isFinite(price) && Number.isFinite(qty) && price > 0 && qty > 0) {
      out.push({ price, qty });
    }
  }
  return out;
}

async function fetchDepth(binanceSymbol: string, limit: number): Promise<ParsedDepth | undefined> {
  try {
    const url = `${BINANCE_REST_BASE}/api/v3/depth?symbol=${encodeURIComponent(binanceSymbol)}&limit=${limit}`;
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return undefined;
    return parseDepth(await res.json());
  } catch {
    // Offline, rate-limited, timed out or malformed: contribute nothing rather than fake a number.
    return undefined;
  }
}

export const binanceAdapter: VenueAdapter = {
  id: "binance",
  async supports(symbol: CanonicalSymbol): Promise<boolean> {
    return bstockSymbolFor(symbol) !== undefined;
  },
  async quotes(symbol: CanonicalSymbol, sizeUsd: number): Promise<Quote[]> {
    const binanceSymbol = bstockSymbolFor(symbol);
    if (!binanceSymbol) return [];
    if (!Number.isFinite(sizeUsd) || sizeUsd <= 0) return [];
    const depth = await fetchDepth(binanceSymbol, DEPTH_LIMIT);
    if (!depth) return [];
    // Binance returns asks best-first, but sort defensively so the walk is always ascending.
    const asks = depth.asks.slice().sort((a, b) => a.price - b.price);
    const quote = buildBuyQuote(symbol, binanceSymbol, asks, sizeUsd);
    return quote ? [quote] : [];
  },
};
