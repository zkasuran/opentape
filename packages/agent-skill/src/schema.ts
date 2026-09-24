// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import { z } from "zod";

// Safe defaults for a wallet skill invoked by an LLM. Both caps are overridable
// per call, but a call that omits them is still gated rather than unbounded.
export const DEFAULT_MAX_SLIPPAGE_BPS = 100; // 1.00%
export const DEFAULT_MAX_NOTIONAL_USD = 25_000;

// Input schema for the skill. `symbol` and `sizeUsd` are required; the two caps
// are optional and fall back to the safe defaults above.
export const skillInputSchema = z.object({
  symbol: z
    .string()
    .min(1)
    .max(16)
    .transform((s) => s.trim().toUpperCase())
    .refine((s) => s.length > 0, "symbol must not be blank"),
  sizeUsd: z
    .number()
    .gt(0, "sizeUsd must be greater than 0")
    .refine((n) => Number.isFinite(n), "sizeUsd must be finite"),
  maxSlippageBps: z
    .number()
    .gt(0, "maxSlippageBps must be greater than 0")
    .lte(10_000, "maxSlippageBps cannot exceed 10000 (100%)")
    .refine((n) => Number.isFinite(n), "maxSlippageBps must be finite")
    .default(DEFAULT_MAX_SLIPPAGE_BPS),
  maxNotionalUsd: z
    .number()
    .gt(0, "maxNotionalUsd must be greater than 0")
    .refine((n) => Number.isFinite(n), "maxNotionalUsd must be finite")
    .default(DEFAULT_MAX_NOTIONAL_USD),
});

// Raw, caller-facing input (the two caps may be omitted).
export type SkillInputRaw = z.input<typeof skillInputSchema>;
// Resolved input after defaults are applied (both caps are present numbers).
export type SkillInput = z.output<typeof skillInputSchema>;
