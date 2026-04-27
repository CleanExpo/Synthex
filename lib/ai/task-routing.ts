/**
 * Task Routing Matrix
 *
 * Intent-driven model selection. Skills and code call `routeIntent('intent-name')`
 * and the matrix decides which provider + model handles the request.
 *
 * The matrix encodes the cost/quality tradeoff explicitly:
 * - $0 local Gemma 4 for routine work (classify, extract, format, summarise)
 * - $0.28/M DeepSeek V4 Flash for cheap mid-quality cloud (drafts, code-gen, research)
 * - $15/M Sonnet for senior-tier work (brand voice, strategy, code review)
 * - $75/M Opus only for high-stakes creative or boardroom synthesis
 *
 * Each intent ships with a fallback chain so callers can retry without re-routing
 * when the primary fails (e.g. Ollama unreachable on Vercel).
 *
 * See: .claude/scratchpad/track-c-pilot-proposal.md and the multi-model
 * orchestration plan that introduced this module.
 */

export type ProviderId = 'ollama' | 'openrouter' | 'anthropic' | 'google';

export interface ModelChoice {
  provider: ProviderId;
  modelId: string;
  /** Approximate cost per 1k output tokens (AUD-equivalent USD). 0 = local. */
  estimatedCostPer1kOutput: number;
  /** Ordered fallback chain when the primary fails. */
  fallback: ModelChoice[];
  /** Human-readable rationale for telemetry / cost-ledger explanation. */
  rationale: string;
}

export type TaskIntent =
  // Routine — local-first, near-zero cost
  | 'classify-text'
  | 'extract-entities'
  | 'summarise-batch'
  | 'format-conversion'
  | 'linting-suggest'
  // Mid-quality cloud
  | 'boilerplate-generate'
  | 'draft-blog-post'
  | 'draft-social-post'
  | 'draft-email-sequence'
  | 'research-synthesis'
  | 'code-generation'
  // Senior-tier
  | 'code-review'
  | 'brand-voice-enforce'
  | 'senior-strategy-draft'
  // Triangulation / high-stakes
  | 'boardroom-decision'
  | 'architecture-decision'
  | 'high-stakes-creative';

export interface RouteOptions {
  /** Override default quality bias (push to a higher tier). */
  quality?: 'fast' | 'balanced' | 'premium';
  /** Hard cap on cost-per-1k-output for primary; lower-cost fallback chosen if exceeded. */
  budgetCeilingPer1kOutput?: number;
  /** If the intent's primary requires more context than this, escalate to higher-context tier. */
  contextLength?: number;
}

// --- Reusable model anchors ---
const GEMMA_E2B: ModelChoice = {
  provider: 'ollama',
  modelId: 'gemma4:e2b',
  estimatedCostPer1kOutput: 0,
  fallback: [],
  rationale: 'local routine tier',
};

const GEMMA_E4B: ModelChoice = {
  provider: 'ollama',
  modelId: 'gemma4:e4b',
  estimatedCostPer1kOutput: 0,
  fallback: [],
  rationale: 'local mid tier',
};

const DEEPSEEK_FLASH: ModelChoice = {
  provider: 'openrouter',
  modelId: 'deepseek/deepseek-v4-flash',
  estimatedCostPer1kOutput: 0.00028,
  fallback: [],
  rationale: 'cheap cloud mid-quality',
};

const SONNET: ModelChoice = {
  provider: 'openrouter',
  modelId: 'anthropic/claude-sonnet-4-6',
  estimatedCostPer1kOutput: 0.015,
  fallback: [],
  rationale: 'senior reasoning / brand voice',
};

const OPUS: ModelChoice = {
  provider: 'openrouter',
  modelId: 'anthropic/claude-opus-4-7',
  estimatedCostPer1kOutput: 0.075,
  fallback: [],
  rationale: 'highest-stakes synthesis',
};

/** Build a fresh ModelChoice with a custom fallback chain. */
function withFallback(primary: ModelChoice, fallback: ModelChoice[], rationale?: string): ModelChoice {
  return {
    ...primary,
    fallback,
    rationale: rationale ?? primary.rationale,
  };
}

/** Routing matrix — single source of truth. */
const MATRIX: Record<TaskIntent, ModelChoice> = {
  // Routine — Gemma local first, DeepSeek fallback for prod
  'classify-text': withFallback(GEMMA_E2B, [DEEPSEEK_FLASH, SONNET], 'classify: local-first'),
  'extract-entities': withFallback(GEMMA_E2B, [DEEPSEEK_FLASH], 'extract: local-first'),
  'summarise-batch': withFallback(GEMMA_E4B, [DEEPSEEK_FLASH], 'summarise: local mid tier'),
  'format-conversion': withFallback(GEMMA_E2B, [], 'format: deterministic — fail loud, no cloud fallback'),
  'linting-suggest': withFallback(GEMMA_E4B, [DEEPSEEK_FLASH], 'lint suggestions'),

  // Mid-quality cloud
  'boilerplate-generate': withFallback(DEEPSEEK_FLASH, [GEMMA_E4B], 'boilerplate: cheap cloud, local fallback'),
  'draft-blog-post': withFallback(DEEPSEEK_FLASH, [SONNET], 'blog draft: cheap cloud, sonnet on quality miss'),
  'draft-social-post': withFallback(DEEPSEEK_FLASH, [SONNET], 'social draft: cheap cloud, sonnet on quality miss'),
  'draft-email-sequence': withFallback(DEEPSEEK_FLASH, [SONNET], 'email draft: cheap cloud, sonnet on quality miss'),
  'research-synthesis': withFallback(DEEPSEEK_FLASH, [SONNET], 'research synthesis: 1M context, cheap'),
  'code-generation': withFallback(DEEPSEEK_FLASH, [SONNET], 'code-gen: 81% SWE-bench, cheap'),

  // Senior tier — Sonnet primary, Opus fallback
  'code-review': withFallback(SONNET, [OPUS], 'senior review'),
  'brand-voice-enforce': withFallback(SONNET, [OPUS], 'brand voice gate — needs reasoning'),
  'senior-strategy-draft': withFallback(SONNET, [OPUS], 'senior strategist L7'),

  // Triangulation / high-stakes
  'boardroom-decision': withFallback(SONNET, [OPUS], 'boardroom synthesis (panel resolved upstream)'),
  'architecture-decision': withFallback(SONNET, [OPUS], 'architecture synthesis (panel resolved upstream)'),
  'high-stakes-creative': withFallback(OPUS, [], 'opus only — ship or revise'),
};

/**
 * Resolve an intent to a concrete `ModelChoice`.
 * The returned object includes the primary's fallback chain so callers can
 * retry without re-running the router.
 */
export function routeIntent(intent: TaskIntent, opts: RouteOptions = {}): ModelChoice {
  const base = MATRIX[intent];
  if (!base) {
    throw new Error(`task-routing: unknown intent "${intent}"`);
  }

  let choice = base;

  // Quality override — push to highest-quality option in chain when requested
  if (opts.quality === 'premium') {
    const chain = [base, ...base.fallback];
    const best = chain.reduce((best, m) => (m.estimatedCostPer1kOutput > best.estimatedCostPer1kOutput ? m : best), chain[0]);
    choice = best ?? base;
  } else if (opts.quality === 'fast') {
    // Pick lowest-cost in chain (often local Gemma)
    const chain = [base, ...base.fallback];
    const cheapest = chain.reduce((cheap, m) => (m.estimatedCostPer1kOutput < cheap.estimatedCostPer1kOutput ? m : cheap), chain[0]);
    choice = cheapest ?? base;
  }

  // Budget ceiling — escalate downward if primary too expensive
  if (
    opts.budgetCeilingPer1kOutput !== undefined &&
    choice.estimatedCostPer1kOutput > opts.budgetCeilingPer1kOutput
  ) {
    const cheaper = [choice, ...choice.fallback].find(
      m => m.estimatedCostPer1kOutput <= opts.budgetCeilingPer1kOutput!,
    );
    if (cheaper) choice = cheaper;
  }

  return choice;
}

/** Expose matrix for tests / introspection. */
export function getRoutingMatrix(): Readonly<Record<TaskIntent, ModelChoice>> {
  return MATRIX;
}
