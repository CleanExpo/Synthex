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
 * Model pricing (per 1M tokens):
 *   claude-opus-4-6:   $5.00 input / $25.00 output
 *   claude-sonnet-4-6: $3.00 input / $15.00 output
 *   claude-haiku-4-5:  $1.00 input /  $5.00 output
 *   claude-opus-4-8:   $5.00 input / $25.00 output
 *   claude-sonnet-5:   $2.00 input / $10.00 output (intro; $3.00/$15.00 from 2026-09-01)
 *   claude-fable-5:    $10.00 input / $50.00 output (future-proofing only — not routable)
 */

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

/** Token-to-cost rates (USD per 1M tokens). Source: Anthropic pricing 2026-03. */
const MODEL_RATES: Record<string, { input: number; output: number }> = {
  'claude-opus-4-6': { input: 5.0, output: 25.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5': { input: 1.0, output: 5.0 },
  'claude-opus-4-8': { input: 5.0, output: 25.0 },
  // Intro pricing through 2026-08-31; rises to $3.00/$15.00 per MTok on 2026-09-01.
  'claude-sonnet-5': { input: 2.0, output: 10.0 },
  // Future-proofing only — not a routable default (Wave 3 is Board-gated).
  'claude-fable-5': { input: 10.0, output: 50.0 },
  // Legacy aliases
  'claude-haiku-4-5-20251001': { input: 1.0, output: 5.0 },
};

/**
 * Calculate cost in USD for a given model and token counts.
 * Falls back to Sonnet pricing for unknown models with a warning.
 */
export function calculatePipelineCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const rates = MODEL_RATES[model] ?? MODEL_RATES['claude-sonnet-4-6'];
  if (!MODEL_RATES[model]) {
    console.warn(
      JSON.stringify({
        event: 'pipeline_cost_unknown_model',
        model,
        fallback: 'claude-sonnet-4-6',
      })
    );
  }
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
