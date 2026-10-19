/**
 * Pipeline cost tracking utility — SYN-518
 *
 * Writes AI pipeline cost records to pipeline_cost_ledger AND to structured
 * JSON logs (belt-and-suspenders — DB failure does not lose data).
 *
 * SYN-1115: the DB write goes through PRISMA, not a separately-constructed
 * platform-js client. `PipelineCostLedger` has been a Prisma model all along
 * (prisma/schema.prisma), so the platform-js path was a second, weaker route to
 * the same table: it needed LEGACY_PLATFORM_URL + LEGACY_PLATFORM_SERVICE_KEY
 * on top of DATABASE_URL, and when those were absent it logged
 * `pipeline_cost_ledger_skipped` and wrote nothing. The SYN-1115 image canary
 * hit exactly that — a real $0.021 generation produced a correct log line and
 * no ledger row. No consumer runs on the edge runtime and no Deno edge function
 * imports this module (checked), so nothing required the standalone client.
 *
 * The structured log stays the belt and is emitted FIRST, unchanged, so a DB
 * failure still cannot lose the record.
 *
 * At 1,000 clients × 3 weekly pipelines, monthly AI compute reaches ~$6k/mo.
 * Without this ledger, that figure is unauditable. See scripts/cost-report.sql.
 *
 * Model pricing comes from lib/ai/model-registry.ts (costPer1kTokens), the same
 * registry the Governor resolves models from; there is no private rate table.
 */

import {
  getModel,
  getModels,
  type AIProvider,
  type ModelConfig,
} from '@/lib/ai/model-registry';

export interface TrackCostParams {
  /** e.g. 'brand-intelligence', 'weekly-digest', 'authority-score', 'video-script' */
  pipeline_name: string;
  /** Organisation/client ID. null for board-level pipelines (video, cron). */
  client_id: string | null;
  /** Unique run identifier — used to correlate all agent costs in one run. */
  run_id: string;
  /** Anthropic model ID, e.g. 'claude-sonnet-4-6' */
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  /**
   * Failure classifier for zero-cost failed runs (e.g. 'UNAUTHORIZED' for the
   * auto-publish Failure State 1, SYN-540). Carried on the structured log line
   * only — pipeline_cost_ledger has no error_code column, so the log is the
   * queryable record until a schema migration adds one.
   */
  error_code?: string;
}

const PROVIDERS: AIProvider[] = [
  'anthropic',
  'openai',
  'google',
  'openrouter',
  'ollama',
];

/**
 * Look a model up in the single model registry (the one the Governor reads).
 * Exact id first; otherwise a dated registry id for an undated alias
 * (claude-haiku-4-5 -> claude-haiku-4-5-20251001). Rates are never guessed.
 */
function findRegistryModel(model: string): ModelConfig | null {
  for (const provider of PROVIDERS) {
    const exact = getModel(provider, model);
    if (exact) return exact;
  }
  for (const provider of PROVIDERS) {
    const dated = getModels(provider).find(m => m.id.startsWith(`${model}-`));
    if (dated) return dated;
  }
  return null;
}

/**
 * Calculate cost in USD for a given model and token counts, priced from the
 * model registry. A model the registry does not know is recorded at 0 USD with
 * a warning naming it — never at a guessed rate.
 */
export function calculatePipelineCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const config = findRegistryModel(model);
  if (!config) {
    console.warn(
      JSON.stringify({
        event: 'pipeline_cost_unknown_model',
        model,
        recorded_cost_usd: 0,
      })
    );
    return 0;
  }
  const rates = {
    input: config.costPer1kTokens.input * 1000,
    output: config.costPer1kTokens.output * 1000,
  };
  return parseFloat(
    (
      (inputTokens / 1_000_000) * rates.input +
      (outputTokens / 1_000_000) * rates.output
    ).toFixed(6)
  );
}

/**
 * Record a pipeline cost entry.
 *
 * Always writes a structured log line first (survives DB failure),
 * then attempts an insert into pipeline_cost_ledger.
 */
export async function trackPipelineCost(
  params: TrackCostParams
): Promise<void> {
  const logEntry = {
    event: 'pipeline_cost',
    timestamp: new Date().toISOString(),
    ...params,
  };

  // Belt — structured log survives any downstream failure
  console.info(JSON.stringify(logEntry));

  // Suspenders — persist to the ledger for dashboard/audit queries.
  // Imported lazily so a module-load-time Prisma failure can never break a
  // caller that only wanted the log line.
  try {
    const { default: prisma } = await import('@/lib/prisma');

    await prisma.pipelineCostLedger.create({
      data: {
        pipelineName: params.pipeline_name,
        clientId: params.client_id,
        runId: params.run_id,
        model: params.model,
        inputTokens: params.input_tokens,
        outputTokens: params.output_tokens,
        costUsd: params.cost_usd,
      },
    });
  } catch (err) {
    // Event name preserved from the platform-js implementation so existing
    // log-based observability keeps matching.
    console.error(
      JSON.stringify({
        event: 'pipeline_cost_ledger_write_failed',
        error: err instanceof Error ? err.message : String(err),
        ...params,
      })
    );
  }
}
