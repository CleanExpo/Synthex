/**
 * ModelRouter — cost-optimised 3-tier AI routing — SYN-652
 *
 * Routes every AI task to the cheapest model that meets its quality threshold.
 * All routing decisions are logged to pipeline_cost_ledger via trackPipelineCost().
 *
 * Expected distribution at scale: ~60% simple / ~30% standard / ~10% complex
 * which yields ~70% cost reduction versus routing everything to Opus.
 */

import { trackPipelineCost } from '@/lib/pipelines/track-cost';
import {
  DEFAULT_TASK_ROUTING,
  TIER_ESCALATION,
  TIER_MODELS,
} from './routing-config';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type TaskType =
  | 'hashtag_scoring'
  | 'posting_time_lookup'
  | 'signal_translation'
  | 'caption_generation'
  | 'brand_voice_enforcement'
  | 'entity_extraction'
  | 'advisor_synthesis'
  | 'knowledge_graph_inference'
  | 'content_strategy'
  | 'conversation_query_simple'
  | 'conversation_query_synthesis'
  | 'conversation_query_strategy';

export type RoutingTier = 'simple' | 'standard' | 'complex';

export interface AITask {
  taskType: TaskType;
  /** Estimated prompt token count — used for cost projection, not routing decisions */
  inputTokenEstimate: number;
  /** 'high' forces at least standard; 'low' allows simple even for normally-standard tasks */
  qualityThreshold: 'low' | 'medium' | 'high';
  /** Optional: client/org ID for cost ledger attribution */
  clientId?: string | null;
  /** Optional: pipeline run identifier for ledger correlation */
  runId?: string;
}

export interface RoutingDecision {
  model: string;
  tier: RoutingTier;
  /** Estimated cost in USD for the given inputTokenEstimate + assumed 300 output tokens */
  estimatedCost: number;
  reason: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Clamp tier upward if qualityThreshold demands it.
 * 'high' threshold → minimum 'standard'.
 * 'low' threshold  → no change (trust the routing table).
 */
function applyQualityFloor(
  tier: RoutingTier,
  qualityThreshold: AITask['qualityThreshold']
): RoutingTier {
  if (qualityThreshold === 'high' && tier === 'simple') return 'standard';
  return tier;
}

function estimateCost(tier: RoutingTier, inputTokenEstimate: number): number {
  const config = TIER_MODELS[tier];
  const estimatedOutputTokens = 300;
  return parseFloat(
    (
      (inputTokenEstimate / 1_000_000) * config.costPerMTokInput +
      (estimatedOutputTokens / 1_000_000) * config.costPerMTokOutput
    ).toFixed(6)
  );
}

/** Read optional JSON override from env — allows ops to re-route without deploys. */
function getRuntimeOverrides(): Partial<Record<TaskType, RoutingTier>> {
  try {
    const raw = process.env.ROUTING_OVERRIDES;
    return raw
      ? (JSON.parse(raw) as Partial<Record<TaskType, RoutingTier>>)
      : {};
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Core routing
// ---------------------------------------------------------------------------

/**
 * Route an AI task to the cheapest model that meets its quality requirements.
 *
 * @example
 * const { model, tier, estimatedCost } = routeTask({
 *   taskType: 'caption_generation',
 *   inputTokenEstimate: 800,
 *   qualityThreshold: 'medium',
 * });
 * // model → 'anthropic/claude-sonnet-4-6', tier → 'standard'
 */
export function routeTask(task: AITask): RoutingDecision {
  const overrides = getRuntimeOverrides();
  const baseTier =
    overrides[task.taskType] ?? DEFAULT_TASK_ROUTING[task.taskType];
  const tier = applyQualityFloor(baseTier, task.qualityThreshold);
  const config = TIER_MODELS[tier];

  const reason = overrides[task.taskType]
    ? `runtime override → ${tier}`
    : task.qualityThreshold === 'high' && baseTier === 'simple'
      ? `quality floor applied: ${baseTier} → standard`
      : `routing table: ${task.taskType} → ${tier}`;

  return {
    model: config.modelId,
    tier,
    estimatedCost: estimateCost(tier, task.inputTokenEstimate),
    reason,
  };
}

// ---------------------------------------------------------------------------
// Routed call with fallback escalation + cost logging
// ---------------------------------------------------------------------------

export interface RoutedCallOptions<T> {
  task: AITask;
  /** Caller executes the AI call with the resolved model ID; throw on failure. */
  execute: (modelId: string) => Promise<T>;
  /** Tokens actually consumed — logged to pipeline_cost_ledger */
  actualTokens?: { input: number; output: number };
}

/**
 * Execute an AI call with automatic tier-escalation on failure.
 * Logs cost to pipeline_cost_ledger after each successful call.
 *
 * Escalation chain: simple → standard → complex → throws
 */
export async function routedCall<T>(options: RoutedCallOptions<T>): Promise<T> {
  const { task, execute, actualTokens } = options;
  const initial = routeTask(task);

  let currentTier: RoutingTier | null = initial.tier;
  let lastError: unknown;

  while (currentTier !== null) {
    const config = TIER_MODELS[currentTier];
    const isEscalation = currentTier !== initial.tier;

    try {
      const result = await execute(config.modelId);

      // Log cost on success
      const inputTok = actualTokens?.input ?? task.inputTokenEstimate;
      const outputTok = actualTokens?.output ?? 300;
      const costUsd = parseFloat(
        (
          (inputTok / 1_000_000) * config.costPerMTokInput +
          (outputTok / 1_000_000) * config.costPerMTokOutput
        ).toFixed(6)
      );

      // Non-fatal: cost logging should never break the AI call.
      // Promise.resolve() guards against mocked/stub implementations that return void.
      Promise.resolve(
        trackPipelineCost({
          pipeline_name: task.taskType,
          client_id: task.clientId ?? null,
          run_id: task.runId ?? crypto.randomUUID(),
          model: config.modelId,
          input_tokens: inputTok,
          output_tokens: outputTok,
          cost_usd: costUsd,
        })
      ).catch(err =>
        console.error(
          JSON.stringify({
            event: 'model_router_cost_log_failed',
            error: String(err),
          })
        )
      );

      if (isEscalation) {
        console.warn(
          JSON.stringify({
            event: 'model_router_escalation',
            task_type: task.taskType,
            initial_tier: initial.tier,
            used_tier: currentTier,
          })
        );
      }

      return result;
    } catch (err) {
      lastError = err;
      console.warn(
        JSON.stringify({
          event: 'model_router_tier_failed',
          task_type: task.taskType,
          tier: currentTier,
          model: config.modelId,
          error: String(err),
        })
      );
      currentTier = TIER_ESCALATION[currentTier];
    }
  }

  throw new Error(
    `ModelRouter: all tiers exhausted for task "${task.taskType}". Last error: ${String(lastError)}`
  );
}
