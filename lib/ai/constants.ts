/**
 * AI Model Constants
 *
 * Shared constants for the AI content pipeline.
 */

/**
 * Token budgets for Claude 4.6 extended thinking (Anthropic direct provider only).
 *
 * Select based on content tier and performance requirements:
 * - quick:    Disabled — standard generation, fastest, lowest cost.
 * - standard: Light thinking — Sonnet, general social content.
 * - deep:     Deep thinking — Sonnet premium, multi-step campaigns (5+ posts).
 * - opus:     Maximum thinking — Opus flagship campaigns, brand strategy.
 *
 * Only active when AI_PROVIDER=anthropic. Silently ignored on OpenRouter/Google.
 */
export const THINKING_BUDGETS = {
  quick: 0,
  standard: 500,
  deep: 4000,
  opus: 16000,
} as const;

export type ThinkingBudget =
  (typeof THINKING_BUDGETS)[keyof typeof THINKING_BUDGETS];
