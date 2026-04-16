/**
 * ModelRouter task-to-tier mapping — SYN-652
 *
 * Edit this file to re-route tasks without touching call sites.
 * Tier meanings:
 *   simple   → Haiku-class  (~$0.25/MTok input)  — deterministic, low-variance tasks
 *   standard → Sonnet-class (~$3/MTok input)      — most creative/analytical work
 *   complex  → Opus-class   (~$15/MTok input)     — multi-step reasoning, strategy
 */

import { TaskType, RoutingTier } from './model-router';

/** Per-task routing decisions.  Override at runtime via ROUTING_OVERRIDES env var (JSON). */
export const DEFAULT_TASK_ROUTING: Record<TaskType, RoutingTier> = {
  // Simple — fast, cheap, deterministic
  hashtag_scoring: 'simple',
  posting_time_lookup: 'simple',
  signal_translation: 'simple',

  // Standard — creative/analytical but well-bounded
  caption_generation: 'standard',
  brand_voice_enforcement: 'standard',
  entity_extraction: 'standard',
  content_strategy: 'standard',

  // Complex — deep reasoning, cross-domain synthesis
  advisor_synthesis: 'complex',
  knowledge_graph_inference: 'complex',

  // Ask Synthex conversation tiers — SYN-681
  // simple: single-signal lookups ("what's my Health Score?", "what's my posting frequency?")
  // synthesis: multi-signal analysis ("why did my reach drop?", "what's my best content type?")
  // strategy: long-term reasoning ("biggest opportunity this quarter?", "how do I grow local reach?")
  conversation_query_simple: 'simple',
  conversation_query_synthesis: 'standard',
  conversation_query_strategy: 'complex',
};

/**
 * Model IDs for each routing tier (via OpenRouter — Synthex's primary provider).
 * Costs are per-million input tokens.
 */
export const TIER_MODELS: Record<
  RoutingTier,
  { modelId: string; costPerMTokInput: number; costPerMTokOutput: number }
> = {
  simple: {
    modelId: 'anthropic/claude-haiku-4-5',
    costPerMTokInput: 0.8,
    costPerMTokOutput: 4.0,
  },
  standard: {
    modelId: 'anthropic/claude-sonnet-4-6',
    costPerMTokInput: 3.0,
    costPerMTokOutput: 15.0,
  },
  complex: {
    modelId: 'anthropic/claude-opus-4-6',
    costPerMTokInput: 15.0,
    costPerMTokOutput: 75.0,
  },
};

/** Tier escalation order used by the fallback mechanism. */
export const TIER_ESCALATION: Record<RoutingTier, RoutingTier | null> = {
  simple: 'standard',
  standard: 'complex',
  complex: null,
};
