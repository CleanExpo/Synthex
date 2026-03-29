import { createClient } from '@supabase/supabase-js';

export interface TrackCostParams {
  pipelineName: string;
  clientId?: string | null;
  runId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

// Pricing per 1M tokens: [input_rate_usd, output_rate_usd]
const MODEL_PRICING: Record<string, [number, number]> = {
  'claude-opus-4-6':    [15,    75],
  'claude-sonnet-4-6':  [3,     15],
  'claude-haiku-4-5':   [0.25,  1.25],
};

/**
 * Calculate USD cost for a model and token counts.
 * Returns 0 for unknown models — does not throw.
 */
export function calculateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const rates = MODEL_PRICING[model];
  if (!rates) return 0;
  const [inputRate, outputRate] = rates;
  const cost = (inputTokens * inputRate) / 1_000_000 + (outputTokens * outputRate) / 1_000_000;
  return parseFloat(cost.toFixed(6));
}

/**
 * Track pipeline cost: write to structured log + Supabase pipeline_cost_ledger.
 * Never throws — Supabase failures are logged, not re-thrown.
 *
 * Usage:
 *   await trackPipelineCost({
 *     pipelineName: 'brand-intelligence',
 *     clientId: client.id,
 *     runId: crypto.randomUUID(),
 *     model: 'claude-opus-4-6',
 *     inputTokens: usage.input_tokens,
 *     outputTokens: usage.output_tokens,
 *   });
 */
export async function trackPipelineCost(params: TrackCostParams): Promise<void> {
  const { pipelineName, clientId, runId, model, inputTokens, outputTokens } = params;
  const costUsd = calculateCostUsd(model, inputTokens, outputTokens);

  // Always write structured log first — survives DB failure
  console.log(JSON.stringify({
    event: 'pipeline_cost',
    timestamp: new Date().toISOString(),
    pipeline_name: pipelineName,
    client_id: clientId ?? null,
    run_id: runId,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: costUsd,
  }));

  // Write to Supabase
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      console.error(JSON.stringify({
        event: 'pipeline_cost_skipped',
        reason: 'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
        run_id: runId,
      }));
      return;
    }

    const supabase = createClient(url, key);
    const { error } = await supabase.from('pipeline_cost_ledger').insert({
      pipeline_name: pipelineName,
      client_id: clientId ?? null,
      run_id: runId,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
    });

    if (error) {
      console.error(JSON.stringify({
        event: 'pipeline_cost_write_failed',
        timestamp: new Date().toISOString(),
        error: { code: error.code, message: error.message },
        run_id: runId,
        pipeline_name: pipelineName,
      }));
    }
  } catch (err) {
    console.error(JSON.stringify({
      event: 'pipeline_cost_exception',
      timestamp: new Date().toISOString(),
      error: err instanceof Error ? { name: err.name, message: err.message } : String(err),
      run_id: runId,
      pipeline_name: pipelineName,
    }));
  }
}
