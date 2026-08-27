/**
 * MiniMax API Module — public surface
 *
 * Drop-in MiniMax (M3, M2.7, M2.5, M2.1, M2) client with built-in:
 *   - Credit budget enforcement (Redis atomic counters)
 *   - Prompt caching (Anthropic-compatible cache_control)
 *   - Automatic cost estimation + post-call reconciliation
 *   - Streaming + non-streaming + tool use + vision + video input
 *
 * Quick start:
 *
 *   import { callMiniMax, creditGuard, withSystemCache } from "@/lib/minimax";
 *
 *   const response = await callMiniMax({
 *     model: "MiniMax-M2.7",
 *     system: withSystemCache("You are a senior code reviewer..."),
 *     messages: [{ role: "user", content: "Review this PR..." }],
 *     maxTokens: 2048,
 *   });
 *
 *   console.log(response.usage.actualCostUsd);  // true USD cost
 */

// Pricing (canonical source of truth)
export {
  PRICING,
  SERVICE_TIER_MULTIPLIER,
  SERVER_TOOL_PRICING_USD,
  computeCallCostUsd,
  usdToCredits,
  pickCheapestModel,
  type MiniMaxModelId,
  type ServiceTier,
  type ModelPricing,
} from "./pricing";

// Credit guard (pre-spend enforcement)
export {
  MiniMaxCreditGuard,
  MiniMaxCreditExceededError,
  creditGuard,
  getMiniMaxSpendSnapshot,
  creditsToUsd,
  type CreditGuardOptions,
  type CreditSnapshot,
  type ReservationHandle,
} from "./credit-guard";

// Client (Anthropic-compatible)
export {
  callMiniMax,
  streamMiniMax,
  estimateInputTokens,
  resetMiniMaxClient,
  type MiniMaxCallOptions,
  type MiniMaxContentPart,
  type MiniMaxMessage,
  type MiniMaxTool,
  type MiniMaxUsage,
  type MiniMaxResponse,
  type MiniMaxStreamEvent,
} from "./client";

// Cache helpers
export {
  withSystemCache,
  withUserContentCache,
  withToolsCache,
  applyAutoCaching,
  estimateTokensForContent,
  recordCacheOutcome,
  getCacheStats,
  resetCacheStats,
  prefixHash,
  MINIMAX_CACHE_MIN_TOKENS,
  type CachedRequest,
} from "./cache/prefix-cache";
