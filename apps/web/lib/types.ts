// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import type {
  ArbSpread,
  BestExecution,
  CanonicalSymbol,
  IssuerId,
  Quote,
  TapeRow,
  VenueKind,
} from "@opentape/sdk";

// Re-export the SDK's shared contract so components import view + domain types from one place.
export type { ArbSpread, BestExecution, CanonicalSymbol, IssuerId, Quote, TapeRow, VenueKind };

export type DataMode = "live" | "demo";

export interface BestExecResponse {
  mode: DataMode;
  sizeUsd: number;
  result: BestExecution;
  fetchedAt: number;
}

export interface ArbResponse {
  mode: DataMode;
  result: ArbSpread;
  fetchedAt: number;
}

export interface TapeResponse {
  mode: DataMode;
  rows: TapeRow[];
  fetchedAt: number;
}

export interface UnderlyingsResponse {
  mode: DataMode;
  symbols: CanonicalSymbol[];
}
