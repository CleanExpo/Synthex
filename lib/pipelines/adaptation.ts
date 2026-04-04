/**
 * AdaptationChain and PipelineMemory interfaces — SYN-653
 *
 * Enriches the createEdgeFunctionRunner spec with structured recovery strategies
 * and per-run memory persistence to the Knowledge Graph.
 *
 * Inspired by: oh-my-codex $ralph persistent completion loop + validateOutput() hook.
 *
 * Usage: import these types when implementing pipeline-specific adaptation strategies
 * or when wiring PipelineMemoryWriter into an Edge Function runner.
 */

// ---------------------------------------------------------------------------
// AdaptationChain — ordered recovery strategies keyed by failure type
// ---------------------------------------------------------------------------

/**
 * A named recovery action for a specific failure mode.
 * `execute` receives the original input and the caught error, and returns
 * a revised input (or throws to pass control to the next strategy).
 */
export interface AdaptationStrategy<TInput> {
  /** Human-readable label for observability logs */
  name: string;
  /** Perform recovery and return revised input, or throw to escalate */
  execute: (originalInput: TInput, error: Error) => Promise<TInput>;
}

/**
 * Ordered map of failure modes → recovery strategies.
 *
 * TFailureMode is a union of string literals identifying known failure categories
 * for this pipeline. Pipelines adapt on failure rather than blindly retrying.
 *
 * @example
 * type AdvisorFailures =
 *   | 'stale_algorithm_data'
 *   | 'knowledge_graph_sparse'
 *   | 'email_delivery_failed';
 *
 * const advisorChain: AdaptationChain<AdvisorFailures, AdvisorInput> = {
 *   stale_algorithm_data: {
 *     name: 'refetch-signals-and-rerun',
 *     execute: async (input) => ({ ...input, signals: await fetchFreshSignals(input.clientId) }),
 *   },
 *   knowledge_graph_sparse: {
 *     name: 'fallback-to-multi-query',
 *     execute: async (input) => ({ ...input, queryMode: 'multi' }),
 *   },
 *   email_delivery_failed: {
 *     name: 'queue-for-next-run',
 *     execute: async (input) => ({ ...input, queuedAt: new Date().toISOString(), priority: 'high' }),
 *   },
 * };
 */
export type AdaptationChain<TFailureMode extends string, TInput> = {
  [K in TFailureMode]: AdaptationStrategy<TInput>;
};

/**
 * Classify an error into a known failure mode, or return null for unknown errors.
 * Used by the runner to select the correct AdaptationStrategy.
 */
export type FailureModeClassifier<TFailureMode extends string> = (
  error: Error
) => TFailureMode | null;

// ---------------------------------------------------------------------------
// PipelineMemory — structured memory persistence after each successful run
// ---------------------------------------------------------------------------

/**
 * Payload written to the Knowledge Graph entity store after each pipeline run.
 * Stored as `entity_type: 'pipeline_memory'` with 90-day TTL.
 *
 * Enables future runs to retrieve prior execution context for continuity,
 * drift detection, and confidence scoring.
 */
export interface PipelineMemoryPayload {
  /** Pipeline identifier, e.g. 'ai-advisor', 'health-score', 'attribution' */
  pipelineName: string;
  /** ISO timestamp of this run */
  executedAt: string;
  /** Client/org this memory is scoped to */
  clientId: string;
  /** Number of AI recommendations or outputs generated */
  recommendationsGenerated: number;
  /** Keys identifying which data sources were consulted (e.g. ['authority_scores', 'posts', 'gbp_reviews']) */
  dataSourcesConsulted: string[];
  /** Names of AdaptationStrategy.name values that fired during this run */
  adaptationsTriggered: string[];
  /** 0–1 confidence in output quality from validateOutput() */
  outputConfidenceScore: number;
  /** Wall-clock duration of the pipeline run in milliseconds */
  executionDurationMs: number;
}

/**
 * Writes a PipelineMemoryPayload to the Knowledge Graph after a successful run.
 * Implementations may write to `client_knowledge_entities` (SYN-648) or a
 * temporary fallback store while KG schema is not yet deployed.
 */
export interface PipelineMemoryWriter {
  /**
   * Persist a memory payload. Non-fatal — implementations should catch and log
   * errors rather than propagating them to the caller.
   */
  write: (payload: PipelineMemoryPayload) => Promise<void>;

  /**
   * Retrieve the most recent memory payload for a given client + pipeline.
   * Returns null if no prior memory exists or if the KG is unavailable.
   */
  readLatest: (
    clientId: string,
    pipelineName: string
  ) => Promise<PipelineMemoryPayload | null>;
}
