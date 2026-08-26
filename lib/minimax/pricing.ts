/**
 * MiniMax Pricing — canonical source of truth
 *
 * MiniMax Token Plan uses 1:1 credit parity: 1,000 credits = $1 USD.
 * All models on a Token Plan draw from the SAME credit pool.
 *
 * Source: https://platform.minimax.io/docs/guides/pricing-paygo
 * Last verified against docs: 2026-08-19
 *
 * Pricing is per 1 MILLION TOKENS in USD.
 * Cache reads are billed at discounted rates. Cache writes (Anthropic explicit
 * caching on M2.x) are billed at a separate rate.
 */

export type MiniMaxModelId =
  | "MiniMax-M3"
  | "MiniMax-M2.7"
  | "MiniMax-M2.7-highspeed"
  | "MiniMax-M2.5"
  | "MiniMax-M2.5-highspeed"
  | "MiniMax-M2.1"
  | "MiniMax-M2.1-highspeed"
  | "MiniMax-M2";

export type ServiceTier = "standard" | "priority";

export interface ModelPricing {
  readonly inputPerMTokensUsd: number;
  readonly outputPerMTokensUsd: number;
  readonly cacheReadPerMTokensUsd: number;
  /** Long-context (input >512k) input rate — only M3 supports this */
  readonly inputLongPerMTokensUsd?: number;
  readonly outputLongPerMTokensUsd?: number;
  readonly cacheReadLongPerMTokensUsd?: number;
  /** Threshold in tokens; above this, long-context pricing kicks in */
  readonly longContextThresholdTokens?: number;
  /** Output speed in tokens/sec (TPS) — for picking speed vs cost */
  readonly outputTps: number;
  /** Context window in tokens */
  readonly contextWindowTokens: number;
  /** Description from official docs */
  readonly description: string;
}

/**
 * Authoritative pricing table.
 * Edit only when docs explicitly change.
 */
export const PRICING: Readonly<Record<MiniMaxModelId, ModelPricing>> = {
  "MiniMax-M3": {
    inputPerMTokensUsd: 0.60,
    outputPerMTokensUsd: 2.40,
    cacheReadPerMTokensUsd: 0.12,
    inputLongPerMTokensUsd: 1.20,
    outputLongPerMTokensUsd: 4.80,
    cacheReadLongPerMTokensUsd: 0.24,
    longContextThresholdTokens: 512_000,
    outputTps: 60,
    contextWindowTokens: 1_000_000,
    description:
      "Frontier multimodal coding model with 1M context window. Agentic reasoning, tool use, coding.",
  },
  "MiniMax-M2.7": {
    inputPerMTokensUsd: 0.30,
    outputPerMTokensUsd: 1.20,
    cacheReadPerMTokensUsd: 0.06,
    outputTps: 60,
    contextWindowTokens: 204_800,
    description:
      "Real-world engineering, professional office work. 50% cheaper than M3 input.",
  },
  "MiniMax-M2.7-highspeed": {
    inputPerMTokensUsd: 0.30,
    outputPerMTokensUsd: 2.40,
    cacheReadPerMTokensUsd: 0.06,
    outputTps: 100,
    contextWindowTokens: 204_800,
    description: "M2.7 quality at ~67% faster output. Use for latency-sensitive paths.",
  },
  "MiniMax-M2.5": {
    inputPerMTokensUsd: 0.30,
    outputPerMTokensUsd: 1.20,
    cacheReadPerMTokensUsd: 0.03,
    outputTps: 60,
    contextWindowTokens: 204_800,
    description: "Code generation + refactoring. Legacy.",
  },
  "MiniMax-M2.5-highspeed": {
    inputPerMTokensUsd: 0.60,
    outputPerMTokensUsd: 2.40,
    cacheReadPerMTokensUsd: 0.03,
    outputTps: 100,
    contextWindowTokens: 204_800,
    description: "M2.5 quality at speed. Legacy.",
  },
  "MiniMax-M2.1": {
    inputPerMTokensUsd: 0.30,
    outputPerMTokensUsd: 1.20,
    cacheReadPerMTokensUsd: 0.03,
    outputTps: 60,
    contextWindowTokens: 204_800,
    description: "Multilingual code. Legacy.",
  },
  "MiniMax-M2.1-highspeed": {
    inputPerMTokensUsd: 0.60,
    outputPerMTokensUsd: 2.40,
    cacheReadPerMTokensUsd: 0.03,
    outputTps: 100,
    contextWindowTokens: 204_800,
    description: "M2.1 quality at speed. Legacy.",
  },
  "MiniMax-M2": {
    inputPerMTokensUsd: 0.30,
    outputPerMTokensUsd: 1.20,
    cacheReadPerMTokensUsd: 0.03,
    outputTps: 60,
    contextWindowTokens: 204_800,
    description: "Agentic, advanced reasoning. Legacy.",
  },
} as const;

export const SERVICE_TIER_MULTIPLIER: Readonly<Record<ServiceTier, number>> = {
  standard: 1.0,
  priority: 1.5,
};

/** Server tools (web_search) — flat per-request USD */
export const SERVER_TOOL_PRICING_USD = {
  web_search: 0.01,
} as const;

/**
 * Compute USD cost for a MiniMax call.
 *
 * @param model — the model id
 * @param inputTokens — total input tokens (including cache reads)
 * @param outputTokens — total output tokens
 * @param cacheReadTokens — subset of input tokens that hit the cache
 * @param tier — standard (default) or priority (1.5x)
 *
 * Long-context pricing (M3 only): applies when inputTokens > 512k. NOTE that
 * the threshold is on TOTAL input tokens, not on uncached portion.
 */
export function computeCallCostUsd(
  model: MiniMaxModelId,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number = 0,
  tier: ServiceTier = "standard"
): number {
  const p = PRICING[model];
  if (!p) throw new Error(`Unknown MiniMax model: ${model}`);

  const useLong =
    p.longContextThresholdTokens !== undefined &&
    inputTokens > p.longContextThresholdTokens;

  const inputRate = useLong
    ? (p.inputLongPerMTokensUsd ?? p.inputPerMTokensUsd)
    : p.inputPerMTokensUsd;
  const outputRate = useLong
    ? (p.outputLongPerMTokensUsd ?? p.outputPerMTokensUsd)
    : p.outputPerMTokensUsd;
  const cacheRate = useLong
    ? (p.cacheReadLongPerMTokensUsd ?? p.cacheReadPerMTokensUsd)
    : p.cacheReadPerMTokensUsd;

  const safeCacheRead = Math.min(cacheReadTokens, inputTokens);
  const uncachedInput = inputTokens - safeCacheRead;

  const usd =
    (uncachedInput * inputRate +
      safeCacheRead * cacheRate +
      outputTokens * outputRate) /
    1_000_000;

  return usd * SERVICE_TIER_MULTIPLIER[tier];
}

/** Convert USD to credits (Token Plan parity: 1 credit = $0.001) */
export function usdToCredits(usd: number): number {
  return usd * 1000;
}

/**
 * Pick the cheapest viable model for a given task profile.
 * Returns the model id and the estimated per-call cost.
 */
export function pickCheapestModel(opts: {
  needsTools?: boolean;
  needsVision?: boolean;
  needsLongContext?: boolean;
  needsSpeed?: boolean;
  inputTokens?: number;
}): MiniMaxModelId {
  // M3 is required for vision/image/video input
  if (opts.needsVision) return "MiniMax-M3";
  // M3 is required for >204.8k context
  if (opts.needsLongContext || (opts.inputTokens ?? 0) > 204_800)
    return "MiniMax-M3";

  if (opts.needsSpeed) return "MiniMax-M2.7-highspeed";

  // For most non-frontier tasks, M2.7 = half price of M3 with strong quality
  return "MiniMax-M2.7";
}
