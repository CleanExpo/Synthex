/**
 * AI Model Constants
 *
 * Shared constants for the AI content pipeline.
 */

/**
 * Effort levels for Claude 4.6 adaptive thinking (Anthropic direct provider only).
 *
 * Select based on content tier and performance requirements:
 * - low:    Light thinking — fast social content, simple rewrites.
 * - medium: Standard thinking — Sonnet, general campaigns.
 * - high:   Deep thinking — multi-step campaigns (5+ posts), premium content.
 * - max:    Maximum thinking — Opus flagship campaigns, brand strategy.
 *
 * Only active when AI_PROVIDER=anthropic. Silently ignored on OpenRouter/Google.
 *
 * Migration note (Claude 4.6): Replaces the deprecated budget_tokens approach.
 * Old mapping: quick=0 → disabled, standard=500 → low, deep=4000 → high, opus=16000 → max.
 */
export const THINKING_EFFORTS = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  max: 'max',
} as const;

export type ThinkingEffort =
  (typeof THINKING_EFFORTS)[keyof typeof THINKING_EFFORTS];
