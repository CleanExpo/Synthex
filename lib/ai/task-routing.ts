/**
 * Task → Model Routing Matrix — SYN-807 Phase 1
 *
 * Skills and code call `routeIntent(intent)` rather than picking a model
 * directly. The matrix below decides which model handles which intent —
 * routine and mid-quality work go to DeepSeek V4 Flash (very cheap cloud),
 * and senior-level work to Claude.
 *
 * The matrix is the single place to retune the cost/quality balance.
 *
 * This module is purely declarative — it returns a `ModelChoice` describing
 * which provider/model to call. Actually invoking the model is the caller's
 * responsibility (or `lib/ai/model-router.ts`'s, which wraps this with
 * tier-escalation behaviour for back-compat with existing call sites).
 */

import type { AIProvider } from './model-registry';

/**
 * Synthex task intents. Skills declare the intent, the matrix picks the
 * model. Naming convention: `<verb>-<noun>` lowercase-kebab.
 *
 * Group A — Routine (DeepSeek V4 Flash, Gemini 3.1 Flash fallback)
 *   classify-text, extract-entities, summarise-batch, format-conversion,
 *   linting-suggest
 * Group B — Mid-quality cloud (DeepSeek V4 Flash baseline)
 *   boilerplate-generate, draft-blog-post, draft-email-sequence,
 *   research-synthesis, code-generation
 * Group C — Senior cloud (Claude Sonnet baseline)
 *   code-review, brand-voice-enforce, senior-strategy-draft
 * Group D — Multi-model triangulation
 *   boardroom-decision, architecture-decision
 * Group E — Premium (Claude Opus only)
 *   high-stakes-creative
 */
export type TaskIntent =
  // Group A — routine
  | 'classify-text'
  | 'extract-entities'
  | 'summarise-batch'
  | 'format-conversion'
  | 'linting-suggest'
  // Group B — mid-quality cloud
  | 'boilerplate-generate'
  | 'draft-blog-post'
  | 'draft-email-sequence'
  | 'research-synthesis'
  | 'code-generation'
  // Group C — senior cloud
  | 'code-review'
  | 'brand-voice-enforce'
  | 'senior-strategy-draft'
  // Group D — triangulation
  | 'boardroom-decision'
  | 'architecture-decision'
  // Group E — premium
  | 'high-stakes-creative';

/**
 * The result of a routing decision. A caller invokes the primary model
 * first; on a non-recoverable failure it falls back through the chain in
 * order.
 */
export interface ModelChoice {
  /** Primary provider to call. */
  provider: AIProvider;
  /** Provider-specific model identifier (e.g. "anthropic/claude-sonnet-5"). */
  modelId: string;
  /** Estimated cost per 1K output tokens — for ledger / budget guards. */
  estimatedCostPer1k: number;
  /** Ordered fallback list. Empty array means no fallback (fail loud). */
  fallback: Array<{ provider: AIProvider; modelId: string }>;
  /** True when this intent uses parallel multi-model synthesis. */
  triangulate: boolean;
  /**
   * The panel of models when `triangulate` is true. Each is invoked in
   * parallel; the primary `provider`/`modelId` above is the synthesiser
   * that combines the panel's outputs.
   */
  panel?: Array<{ provider: AIProvider; modelId: string }>;
}

/** Optional caller-supplied modifiers. */
export interface RouteOptions {
  /**
   * Override the default tier. `quality:'low'` forces the cheapest cloud tier
   * (DeepSeek V4 Flash); `quality:'high'` forces an upgrade to the senior tier.
   */
  quality?: 'low' | 'standard' | 'high';
  /**
   * If the prompt + expected output exceeds this token count, escalate to
   * a model with a larger context window (DeepSeek V4 has 1M). Defaults
   * to the matrix's choice without override.
   */
  contextLength?: number;
  /**
   * Hard ceiling on $/1k output tokens. If the matrix's primary exceeds
   * this, routeIntent throws rather than return a model the ceiling cannot
   * pay for. No model is free, so `0` always throws.
   */
  budgetCeiling?: number;
}

/** The cheapest cloud tier: DeepSeek V4 Flash, $0.28 / 1M output tokens. */
const CHEAP_CLOUD = {
  provider: 'openrouter',
  modelId: 'deepseek/deepseek-v4-flash',
  cost: 0.00028,
} as const satisfies MatrixEntry['primary'];

interface MatrixEntry {
  primary: { provider: AIProvider; modelId: string; cost: number };
  fallback: Array<{ provider: AIProvider; modelId: string }>;
  triangulate?: boolean;
  panel?: Array<{ provider: AIProvider; modelId: string }>;
}

/**
 * The single source of truth for "which model handles which intent".
 * Cost values are $/1k OUTPUT tokens (same units as
 * `lib/ai/model-registry.ts costPer1kTokens.output`).
 */
const ROUTING_MATRIX: Record<TaskIntent, MatrixEntry> = {
  // ── Group A — routine (DeepSeek V4 Flash baseline) ────────────────
  'classify-text': {
    primary: CHEAP_CLOUD,
    fallback: [
      { provider: 'openrouter', modelId: 'google/gemini-3.1-flash' },
      { provider: 'openrouter', modelId: 'anthropic/claude-sonnet-5' },
    ],
  },
  'extract-entities': {
    primary: CHEAP_CLOUD,
    fallback: [{ provider: 'openrouter', modelId: 'google/gemini-3.1-flash' }],
  },
  'summarise-batch': {
    primary: CHEAP_CLOUD,
    fallback: [{ provider: 'openrouter', modelId: 'google/gemini-3.1-flash' }],
  },
  'format-conversion': {
    primary: CHEAP_CLOUD,
    // Format conversion is mechanical; if the cheap model can't do it, the
    // input is malformed. Fail loud rather than spend more money on it.
    fallback: [],
  },
  'linting-suggest': {
    primary: CHEAP_CLOUD,
    fallback: [{ provider: 'openrouter', modelId: 'google/gemini-3.1-flash' }],
  },

  // ── Group B — mid-quality cloud (DeepSeek V4 Flash baseline) ──────
  'boilerplate-generate': {
    primary: {
      provider: 'openrouter',
      modelId: 'deepseek/deepseek-v4-flash',
      cost: 0.00028,
    },
    fallback: [
      { provider: 'openrouter', modelId: 'anthropic/claude-sonnet-5' },
    ],
  },
  'draft-blog-post': {
    primary: {
      provider: 'openrouter',
      modelId: 'deepseek/deepseek-v4-flash',
      cost: 0.00028,
    },
    fallback: [
      { provider: 'openrouter', modelId: 'anthropic/claude-sonnet-5' },
    ],
  },
  'draft-email-sequence': {
    primary: {
      provider: 'openrouter',
      modelId: 'deepseek/deepseek-v4-flash',
      cost: 0.00028,
    },
    fallback: [
      { provider: 'openrouter', modelId: 'anthropic/claude-sonnet-5' },
    ],
  },
  'research-synthesis': {
    primary: {
      provider: 'openrouter',
      modelId: 'deepseek/deepseek-v4-flash',
      cost: 0.00028,
    },
    fallback: [
      { provider: 'openrouter', modelId: 'anthropic/claude-sonnet-5' },
    ],
  },
  'code-generation': {
    primary: {
      provider: 'openrouter',
      modelId: 'deepseek/deepseek-v4-flash',
      cost: 0.00028,
    },
    fallback: [
      { provider: 'openrouter', modelId: 'anthropic/claude-sonnet-5' },
    ],
  },

  // ── Group C — senior cloud (Claude Sonnet) ────────────────────────
  'code-review': {
    primary: {
      provider: 'openrouter',
      modelId: 'anthropic/claude-sonnet-5',
      cost: 0.015,
    },
    fallback: [
      { provider: 'openrouter', modelId: 'anthropic/claude-opus-4-8' },
    ],
  },
  'brand-voice-enforce': {
    primary: {
      provider: 'openrouter',
      modelId: 'anthropic/claude-sonnet-5',
      cost: 0.015,
    },
    fallback: [
      { provider: 'openrouter', modelId: 'anthropic/claude-opus-4-8' },
    ],
  },
  'senior-strategy-draft': {
    primary: {
      provider: 'openrouter',
      modelId: 'anthropic/claude-sonnet-5',
      cost: 0.015,
    },
    fallback: [
      { provider: 'openrouter', modelId: 'anthropic/claude-opus-4-8' },
    ],
  },

  // ── Group D — multi-model triangulation ───────────────────────────
  'boardroom-decision': {
    primary: {
      provider: 'openrouter',
      modelId: 'anthropic/claude-sonnet-5',
      cost: 0.015,
    },
    fallback: [
      { provider: 'openrouter', modelId: 'anthropic/claude-opus-4-8' },
    ],
    triangulate: true,
    panel: [
      { provider: 'openrouter', modelId: 'google/gemini-3.1-flash' },
      { provider: 'openrouter', modelId: 'deepseek/deepseek-v4-flash' },
      { provider: 'openrouter', modelId: 'anthropic/claude-sonnet-5' },
    ],
  },
  'architecture-decision': {
    primary: {
      provider: 'openrouter',
      modelId: 'anthropic/claude-opus-4-8',
      cost: 0.075,
    },
    fallback: [],
    triangulate: true,
    panel: [
      { provider: 'openrouter', modelId: 'deepseek/deepseek-v4-flash' },
      { provider: 'openrouter', modelId: 'anthropic/claude-sonnet-5' },
      { provider: 'openrouter', modelId: 'anthropic/claude-opus-4-8' },
    ],
  },

  // ── Group E — premium (Claude Opus) ───────────────────────────────
  'high-stakes-creative': {
    primary: {
      provider: 'openrouter',
      modelId: 'anthropic/claude-opus-4-8',
      cost: 0.075,
    },
    // No fallback — high-stakes work doesn't get auto-downgraded.
    fallback: [],
  },
};

/**
 * Known per-1k cost of every model the matrix can return as a fallback.
 * A model missing here has no known price, so a budget ceiling drops it.
 */
const KNOWN_COST_PER_1K: Record<string, number> = {
  'deepseek/deepseek-v4-flash': 0.00028,
  'anthropic/claude-sonnet-5': 0.015,
  'anthropic/claude-opus-4-8': 0.075,
};

/**
 * Resolve the model choice for a given task intent.
 *
 * The defaults in `ROUTING_MATRIX` are the standard answer; `opts` lets
 * callers override on a per-call basis (e.g. a user-facing flow that
 * needs the highest quality regardless of budget).
 */
export function routeIntent(
  intent: TaskIntent,
  opts: RouteOptions = {}
): ModelChoice {
  const entry = ROUTING_MATRIX[intent];
  if (!entry) {
    throw new Error(`Unknown task intent: ${intent}`);
  }

  let primary = entry.primary;
  let fallback = entry.fallback.slice();

  // ── Quality override ──────────────────────────────────────────────
  if (opts.quality === 'high' && primary.cost < 0.015) {
    // Force-upgrade to Sonnet if the matrix routed cheaper than senior.
    primary = {
      provider: 'openrouter',
      modelId: 'anthropic/claude-sonnet-5',
      cost: 0.015,
    };
    fallback = [
      { provider: 'openrouter', modelId: 'anthropic/claude-opus-4-8' },
    ];
  } else if (opts.quality === 'low' && primary.cost > CHEAP_CLOUD.cost) {
    // Force-downgrade to the cheapest cloud tier.
    primary = CHEAP_CLOUD;
    fallback = entry.fallback.filter(f => f.modelId !== CHEAP_CLOUD.modelId);
  }

  // ── Budget ceiling ────────────────────────────────────────────────
  if (
    typeof opts.budgetCeiling === 'number' &&
    primary.cost > opts.budgetCeiling
  ) {
    // Every model costs money: never return one the ceiling cannot pay for.
    // Callers that want the cheapest tier pass quality:'low' first.
    throw new Error(
      `No model within budgetCeiling ${opts.budgetCeiling} for task intent: ${intent}`
    );
  }

  // ── Context-length escalation ─────────────────────────────────────
  // If the prompt is huge, prefer DeepSeek V4 (1M ctx) over Sonnet (200K).
  if (opts.contextLength && opts.contextLength > 200_000) {
    if (primary.modelId.startsWith('anthropic/')) {
      primary = {
        provider: 'openrouter',
        modelId: 'deepseek/deepseek-v4-flash',
        cost: 0.00028,
      };
      fallback = [
        { provider: 'openrouter', modelId: 'deepseek/deepseek-v4-pro' },
      ];
    }
  }

  // ── Budget ceiling on the fallback chain ──────────────────────────
  // The ceiling is a hard cap on everything returned, not just the primary:
  // keep only fallbacks with a known price inside it (unknown price fails closed).
  if (typeof opts.budgetCeiling === 'number') {
    const ceiling = opts.budgetCeiling;
    fallback = fallback.filter(f => {
      const cost = KNOWN_COST_PER_1K[f.modelId];
      return typeof cost === 'number' && cost <= ceiling;
    });
  }

  return {
    provider: primary.provider,
    modelId: primary.modelId,
    estimatedCostPer1k: primary.cost,
    fallback,
    triangulate: Boolean(entry.triangulate),
    panel: entry.panel,
  };
}

/** All known intents — useful for tests and validation. */
export const ALL_INTENTS: TaskIntent[] = Object.keys(
  ROUTING_MATRIX
) as TaskIntent[];

/** Read-only access to the matrix, for ops dashboards / cost analysis. */
export function getRoutingMatrix(): Readonly<Record<TaskIntent, MatrixEntry>> {
  return ROUTING_MATRIX;
}
