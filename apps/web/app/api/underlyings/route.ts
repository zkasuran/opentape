// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import { NextResponse } from "next/server";
import { listUnderlyings } from "@opentape/sdk";
import { DEMO_UNDERLYINGS } from "../../../lib/demo";
import type { UnderlyingsResponse } from "../../../lib/types";

export const dynamic = "force-dynamic";

// Tracked underlyings. listUnderlyings is a pure catalog read in the SDK, so this
// path is genuinely live today; it still falls back if the import ever fails.
export async function GET() {
  try {
    const symbols = listUnderlyings();
    if (!symbols.length) throw new Error("empty catalog");
    const body: UnderlyingsResponse = { mode: "live", symbols };
    return NextResponse.json(body);
  } catch {
    const body: UnderlyingsResponse = { mode: "demo", symbols: DEMO_UNDERLYINGS };
    return NextResponse.json(body);
  }
}
