/**
 * Edge Function Runner Factory — SYN-626
 *
 * @description Generic wrapper for all Synthex autonomous pipeline execution.
 * Provides structured logging, automatic retry with exponential backoff,
 * Slack alerts on failure, and a validateOutput() hook for semantic correctness.
 *
 * ENVIRONMENT VARIABLES:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL (PUBLIC)
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key (SECRET)
 * - PIPELINE_SLACK_WEBHOOK: Slack webhook for failure alerts (SECRET, optional)
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface RunOptions {
  /** Max retry attempts per client on transient failure. Default: 3 */
  maxRetries?: number;
  /** Base delay in ms between retries (doubles each attempt). Default: 1000 */
  retryDelayMs?: number;
  /** Override PIPELINE_SLACK_WEBHOOK env var for this pipeline */
  slackWebhook?: string;
}

export interface EdgeFunctionResult<TOutput> {
  runId: string;
  status: 'success' | 'partial' | 'failed';
  clientsProcessed: number;
  clientsFailed: number;
  durationMs: number;
  outputs: Array<{ clientId: string; output?: TOutput; error?: string }>;
  validationMetadata?: Record<string, unknown>;
}

export interface EdgeFunctionError {
  clientId: string;
  error: string;
  attempt: number;
}

export interface ClientInput<TInput> {
  clientId: string;
  input: TInput;
}

// ============================================================================
// Supabase client (lazy singleton)
// ============================================================================

let _supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}

// ============================================================================
// Internal helpers
// ============================================================================

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postSlackAlert(
  webhook: string,
  functionName: string,
  status: string,
  clientsFailed: number,
  firstError: string | undefined
): Promise<void> {
  try {
    const text = [
      `*Synthex Pipeline Alert*`,
      `Pipeline: \`${functionName}\``,
      `Status: *${status.toUpperCase()}*`,
      `Clients failed: ${clientsFailed}`,
      firstError ? `First error: ${firstError.substring(0, 200)}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    // Slack alerts are non-fatal — log and continue
    logger.warn('Pipeline Slack alert failed', { functionName, error: err });
  }
}

async function writeLog(
  functionName: string,
  runId: string,
  status: 'success' | 'partial' | 'failed',
  durationMs: number,
  clientsProcessed: number,
  clientsFailed: number,
  errors: EdgeFunctionError[],
  outputMetadata?: Record<string, unknown>
): Promise<void> {
  try {
    const { error } = await (getSupabase() as ReturnType<typeof createClient<any>>)
      .from('edge_function_logs')
      .insert({
        function_name: functionName,
        run_id: runId,
        client_id: null, // aggregate row — no single client_id
        status,
        duration_ms: durationMs,
        clients_processed: clientsProcessed,
        clients_failed: clientsFailed,
        error_json: errors.length > 0 ? errors : null,
        output_metadata: outputMetadata ?? null,
      });

    if (error) {
      logger.error('edge_function_logs write failed', { functionName, error });
    }
  } catch (err) {
    // Log write failure is non-fatal — the pipeline still ran
    logger.error('edge_function_logs write threw', { functionName, error: err });
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Creates a reusable pipeline runner for a named Edge Function.
 *
 * @param functionName  - Identifies this pipeline in edge_function_logs
 * @param processFn     - Per-client processing callback
 * @param validateOutput - Optional semantic correctness check on aggregate output
 * @param options       - Retry + alert configuration
 *
 * @example
 * const runner = createEdgeFunctionRunner<OrgInput, HealthScoreOutput>(
 *   'health-score',
 *   async (input, clientId) => calculateScore(input),
 *   (output) => ({
 *     valid: output.composite >= 0 && output.composite <= 100,
 *     metadata: { composite: output.composite },
 *   })
 * );
 * const result = await runner.run(inputs);
 */
export function createEdgeFunctionRunner<TInput, TOutput>(
  functionName: string,
  processFn: (input: TInput, clientId: string) => Promise<TOutput>,
  validateOutput?: (output: TOutput) => { valid: boolean; metadata: Record<string, unknown> },
  options?: RunOptions
) {
  const maxRetries = options?.maxRetries ?? 3;
  const retryDelayMs = options?.retryDelayMs ?? 1000;
  const slackWebhook =
    options?.slackWebhook ?? process.env.PIPELINE_SLACK_WEBHOOK;

  return {
    /**
     * Process a batch of client inputs.
     * Returns a single EdgeFunctionResult summarising the run.
     */
    async run(
      inputs: ClientInput<TInput>[]
    ): Promise<EdgeFunctionResult<TOutput>> {
      const runId = crypto.randomUUID();
      const startTime = Date.now();

      logger.info(`pipeline:${functionName}:start`, {
        runId,
        clients: inputs.length,
      });

      const outputs: EdgeFunctionResult<TOutput>['outputs'] = [];
      const errors: EdgeFunctionError[] = [];

      // Process each client with retry
      for (const { clientId, input } of inputs) {
        let lastError: string | undefined;
        let succeeded = false;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const output = await processFn(input, clientId);
            outputs.push({ clientId, output });
            succeeded = true;
            break;
          } catch (err) {
            lastError = err instanceof Error ? err.message : String(err);
            logger.warn(`pipeline:${functionName}:retry`, {
              runId,
              clientId,
              attempt,
              error: lastError,
            });

            if (attempt < maxRetries) {
              await sleep(retryDelayMs * Math.pow(2, attempt - 1));
            }
          }
        }

        if (!succeeded) {
          outputs.push({ clientId, error: lastError });
          errors.push({ clientId, error: lastError!, attempt: maxRetries });
        }
      }

      const clientsProcessed = outputs.filter((o) => !o.error).length;
      const clientsFailed = errors.length;

      // Determine status
      let status: 'success' | 'partial' | 'failed';
      let validationMetadata: Record<string, unknown> | undefined;

      if (clientsFailed === inputs.length && inputs.length > 0) {
        // All clients failed
        status = 'failed';
      } else if (clientsFailed > 0) {
        // Some clients failed — partial regardless of validation
        status = 'partial';
      } else {
        // All clients succeeded — run semantic validation if provided
        status = 'success';

        if (validateOutput) {
          // Run validation on all successful outputs; 'partial' if any fail
          const allMetadata: Record<string, unknown>[] = [];
          let anyInvalid = false;

          for (const { output } of outputs.filter((o) => o.output !== undefined)) {
            const result = validateOutput(output!);
            allMetadata.push(result.metadata);
            if (!result.valid) {
              anyInvalid = true;
            }
          }

          if (anyInvalid) {
            status = 'partial';
          }

          validationMetadata =
            allMetadata.length === 1
              ? allMetadata[0]
              : { validations: allMetadata };
        }
      }

      const durationMs = Date.now() - startTime;

      logger.info(`pipeline:${functionName}:end`, {
        runId,
        status,
        clientsProcessed,
        clientsFailed,
        durationMs,
      });

      // Write execution log
      await writeLog(
        functionName,
        runId,
        status,
        durationMs,
        clientsProcessed,
        clientsFailed,
        errors,
        validationMetadata
      );

      // Slack alert on non-success
      const webhook = slackWebhook ?? process.env.PIPELINE_SLACK_WEBHOOK;
      if (status !== 'success' && webhook) {
        await postSlackAlert(
          webhook,
          functionName,
          status,
          clientsFailed,
          errors[0]?.error
        );
      }

      return {
        runId,
        status,
        clientsProcessed,
        clientsFailed,
        durationMs,
        outputs,
        validationMetadata,
      };
    },
  };
}
