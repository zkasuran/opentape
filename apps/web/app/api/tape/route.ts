// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import { NextResponse } from "next/server";
import { getConsolidatedTape, listUnderlyings } from "@opentape/sdk";
import { demoTape } from "../../../lib/demo";
import type { TapeResponse, TapeRow } from "../../../lib/types";

export const dynamic = "force-dynamic";

// Market-wide consolidated tape: one premium row per tracked underlying, used by the
// symbol strip and the premium radar. Live via the SDK engine, else DEMO fallback.
export async function GET() {
  try {
    const symbols = listUnderlyings();
    const rows = await Promise.all(symbols.map((s) => getConsolidatedTape(s)));
    const ok = rows.filter((r): r is TapeRow => Boolean(r?.bestOffer));
    if (!ok.length) throw new Error("no live tape");
    const body: TapeResponse = { mode: "live", rows: ok, fetchedAt: Date.now() };
    return NextResponse.json(body);
  } catch {
    const body: TapeResponse = { mode: "demo", rows: demoTape(), fetchedAt: Date.now() };
    return NextResponse.json(body);
  }
}
