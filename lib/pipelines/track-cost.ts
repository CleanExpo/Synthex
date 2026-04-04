/**
 * Pipeline cost tracking utility — SYN-518
 *
 * Writes AI pipeline cost records to pipeline_cost_ledger (Supabase) AND
 * to structured JSON logs (belt-and-suspenders — DB failure does not lose data).
 *
 * At 1,000 clients × 3 weekly pipelines, monthly AI compute reaches ~$6k/mo.
 * Without this ledger, that figure is unauditable. See scripts/cost-report.sql.
 *
 * Model pricing (per 1M tokens):
 *   claude-opus-4-6:   $5.00 input / $25.00 output
 *   claude-sonnet-4-6: $3.00 input / $15.00 output
 *   claude-haiku-4-5:  $1.00 input /  $5.00 output
 */

import { createClient } from '@supabase/supabase-js';

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
}

/** Token-to-cost rates (USD per 1M tokens). Source: Anthropic pricing 2026-03. */
const MODEL_RATES: Record<string, { input: number; output: number }> = {
  'claude-opus-4-6': { input: 5.0, output: 25.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5': { input: 1.0, output: 5.0 },
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

  // Suspenders — write to Supabase ledger for dashboard queries
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.warn(
        JSON.stringify({
          event: 'pipeline_cost_ledger_skipped',
          reason:
            'NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set',
          ...params,
        })
      );
      return;
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await supabase.from('pipeline_cost_ledger').insert({
      id: crypto.randomUUID(),
      pipeline_name: params.pipeline_name,
      client_id: params.client_id,
      run_id: params.run_id,
      model: params.model,
      input_tokens: params.input_tokens,
      output_tokens: params.output_tokens,
      cost_usd: params.cost_usd,
    });

    if (error) {
      console.error(
        JSON.stringify({
          event: 'pipeline_cost_ledger_write_failed',
          error: error.message,
          ...params,
        })
      );
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        event: 'pipeline_cost_ledger_exception',
        error: String(err),
        ...params,
      })
    );
  }
}
