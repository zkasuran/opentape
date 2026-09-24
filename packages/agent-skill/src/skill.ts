// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import {
  type ArbSpread,
  type BestExecution,
  type CanonicalSymbol,
  getArbSpread,
  getBestExecution,
} from "@opentape/sdk";
import { skillManifest } from "./manifest";
import { buildRecommendation, type Recommendation } from "./recommend";
import { skillInputSchema } from "./schema";

// The SDK surface the skill depends on. Injecting it keeps the skill testable
// against fixtures and lets a caller point it at a live engine or a fake.
export interface SkillDeps {
  getBestExecution(symbol: CanonicalSymbol, sizeUsd: number): Promise<BestExecution>;
  getArbSpread(symbol: CanonicalSymbol): Promise<ArbSpread>;
}

// Default wiring: the real @opentape/sdk engine reading the registered adapters.
export const defaultDeps: SkillDeps = { getBestExecution, getArbSpread };

/**
 * Run the skill: validate the input, pull best execution and the arb signal from
 * the SDK, then shape a risk-gated recommendation. The arb call is best-effort,
 * so a symbol that prices for execution still returns a recommendation even when
 * no cross-venue spread is available.
 */
export async function runSkill(
  rawInput: unknown,
  deps: SkillDeps = defaultDeps,
): Promise<Recommendation> {
  const input = skillInputSchema.parse(rawInput);
  const [best, arb] = await Promise.all([
    deps.getBestExecution(input.symbol, input.sizeUsd),
    deps.getArbSpread(input.symbol).catch(() => null),
  ]);
  return buildRecommendation(input, best, arb);
}

// Typed descriptor for embedding the skill in an agent runtime: a name, the input
// schema and a handler. SKILL.md is the portable-format rendering of the same.
export const openTapeBestExecutionSkill = {
  name: skillManifest.name,
  description: skillManifest.description,
  inputSchema: skillInputSchema,
  invoke: runSkill,
} as const;
