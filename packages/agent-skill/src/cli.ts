// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
// Tiny CLI for the openTapeBestExecution skill. Run with tsx, for example:
//   tsx src/cli.ts AAPL --size 5000
//   tsx src/cli.ts AAPL --size 5000 --json
//   tsx src/cli.ts AAPL --size 60000 --max-slippage-bps 25   (shows a blocked case)
//   tsx src/cli.ts --live NVDA --size 2000                    (query the real SDK)
//   tsx src/cli.ts --manifest                                 (print the skill manifest)
//
// Default mode uses offline demonstration fixtures (labeled on stderr) so the CLI
// always prints a recommendation without network access. --live registers the
// real adapters and reads live venues through the SDK.
import { parseArgs } from "node:util";
import { skillManifest } from "./manifest";
import type { Recommendation } from "./recommend";
import { demoDeps } from "./fixtures";
import { defaultDeps, runSkill, type SkillDeps } from "./skill";

const USAGE = `opentape-skill: best execution plus cross-issuer arb signal for tokenized stocks (BNB Chain)

Usage:
  opentape-skill <SYMBOL> --size <usd> [--max-slippage-bps <n>] [--max-notional-usd <n>] [--json] [--live]
  opentape-skill --manifest

Options:
  --size <usd>              Order size in USD of exposure (required)
  --max-slippage-bps <n>    Reject when best-route price impact exceeds n bps (default 100)
  --max-notional-usd <n>    Reject when size exceeds this notional (default 25000)
  --json                    Print the recommendation as JSON
  --live                    Query live venues via the SDK instead of demo fixtures
  --manifest                Print the machine-readable skill manifest and exit
  -h, --help                Show this help`;

function parseNum(label: string, raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`${label} must be a finite number, got "${raw}"`);
  return n;
}

// Register the real venue adapters and return the live SDK deps.
async function liveDeps(): Promise<SkillDeps> {
  const sdk = await import("@opentape/sdk");
  sdk.clearAdapters();
  sdk.registerAdapter(sdk.pancakeswapAdapter);
  sdk.registerAdapter(sdk.binanceAdapter);
  sdk.registerAdapter(sdk.ondoAdapter);
  return defaultDeps;
}

function bps(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)} bps`;
}

function printHuman(rec: Recommendation): void {
  const r = rec.bestRoute;
  const lines: string[] = [];
  lines.push(`OpenTape recommendation for ${rec.symbol} ($${rec.sizeUsd})`);
  lines.push(`  decision:        ${rec.decision.toUpperCase()}`);
  if (rec.reasons.length > 0) for (const reason of rec.reasons) lines.push(`    - ${reason}`);
  lines.push(`  best route:      ${r.venueId} (${r.issuer}, ${r.venueKind})`);
  lines.push(`  price:           $${r.pxPerExposureUsd.toFixed(4)} per share of exposure`);
  lines.push(`  reference:       $${rec.referenceUsd.toFixed(4)}  (premium ${bps(rec.premiumBps)})`);
  lines.push(`  price impact:    ${r.priceImpactBps.toFixed(1)} bps`);
  lines.push(`  executable:      ${r.executable}  kycGated: ${r.kycGated}`);
  lines.push(`  savings vs worst:${bps(rec.savingsBpsVsWorst)}  (${rec.routesConsidered} routes)`);
  lines.push(`  arb signal:      gross ${bps(rec.arb.grossBps)}, net ${bps(rec.arb.netBps)}`);
  lines.push(`    capturable:    ${rec.arb.capturable}`);
  for (const note of rec.arb.notes) lines.push(`    note: ${note}`);
  lines.push(`  ${rec.disclaimer}`);
  process.stdout.write(`${lines.join("\n")}\n`);
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      size: { type: "string" },
      "max-slippage-bps": { type: "string" },
      "max-notional-usd": { type: "string" },
      json: { type: "boolean", default: false },
      live: { type: "boolean", default: false },
      manifest: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.manifest) {
    process.stdout.write(`${JSON.stringify(skillManifest, null, 2)}\n`);
    return;
  }
  const symbol = positionals[0];
  if (values.help || symbol === undefined) {
    process.stdout.write(`${USAGE}\n`);
    if (symbol === undefined && !values.help) process.exitCode = 2;
    return;
  }

  const sizeUsd = parseNum("--size", values.size);
  if (sizeUsd === undefined) throw new Error("--size <usd> is required");

  const rawInput = {
    symbol,
    sizeUsd,
    maxSlippageBps: parseNum("--max-slippage-bps", values["max-slippage-bps"]),
    maxNotionalUsd: parseNum("--max-notional-usd", values["max-notional-usd"]),
  };

  const deps = values.live ? await liveDeps() : demoDeps;
  if (!values.live) {
    process.stderr.write(
      "note: DEMO FIXTURE DATA (no live venue calls). Pass --live to query the OpenTape SDK.\n",
    );
  }

  const rec = await runSkill(rawInput, deps);
  if (values.json) process.stdout.write(`${JSON.stringify(rec, null, 2)}\n`);
  else printHuman(rec);
}

main().catch((err: unknown) => {
  process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
