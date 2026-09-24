// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import { NextResponse } from "next/server";
import { getArbSpread, registerDefaultAdapters } from "@opentape/sdk";
import { demoArbSpread } from "../../../../lib/demo";
import type { ArbResponse } from "../../../../lib/types";

export const dynamic = "force-dynamic";
export const preferredRegion = "bom1";

// Cross-issuer arb SIGNAL for a symbol: buy cheapest, sell/redeem dearest, net of costs.
// Executability is reported honestly (redemption is gated) and it falls back to DEMO.
export async function GET(_req: Request, ctx: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await ctx.params;
  const sym = symbol.toUpperCase();

  try {
    registerDefaultAdapters();
    const result = await getArbSpread(sym);
    if (!result?.buy || !result.sell) throw new Error("no live arb");
    const body: ArbResponse = { mode: "live", result, fetchedAt: Date.now() };
    return NextResponse.json(body);
  } catch {
    const body: ArbResponse = { mode: "demo", result: demoArbSpread(sym), fetchedAt: Date.now() };
    return NextResponse.json(body);
  }
}
