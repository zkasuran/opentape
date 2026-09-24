// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import { NextResponse } from "next/server";
import { getBestExecution } from "@opentape/sdk";
import { demoBestExecution } from "../../../../lib/demo";
import { clampSizeUsd } from "../../../../lib/quote";
import type { BestExecResponse } from "../../../../lib/types";

export const dynamic = "force-dynamic";

// Best execution across every issuer/venue for a symbol + trade size. Calls the SDK
// engine server-side; if the engine or its adapters are not ready, falls back to the
// clearly-labeled DEMO dataset so the product still renders and the demo still works.
export async function GET(req: Request, ctx: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await ctx.params;
  const sym = symbol.toUpperCase();
  const sizeUsd = clampSizeUsd(Number(new URL(req.url).searchParams.get("sizeUsd")));

  try {
    const result = await getBestExecution(sym, sizeUsd);
    if (!result?.best || !result.ranked?.length) throw new Error("no live quotes");
    const body: BestExecResponse = { mode: "live", sizeUsd, result, fetchedAt: Date.now() };
    return NextResponse.json(body);
  } catch {
    const body: BestExecResponse = {
      mode: "demo",
      sizeUsd,
      result: demoBestExecution(sym, sizeUsd),
      fetchedAt: Date.now(),
    };
    return NextResponse.json(body);
  }
}
