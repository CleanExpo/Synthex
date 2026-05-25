/**
 * Marketing Agency Agent — Queue Handler.
 *
 * Registers the MARKETING_AGENT_RUN job type with the Synthex job queue
 * (lib/queue.ts) so agent runs can be invoked asynchronously rather than
 * holding open a Vercel function for 60s+ of LLM latency.
 *
 * Solves code-review findings:
 *   - #2 Vercel 60s timeout on synchronous runAgent
 *   - #6 Campaign slug race (queue naturally serializes runs per agent)
 *
 * Usage:
 *   import { queueMarketingAgentRun, registerMarketingAgentHandler } from './queue-handler';
 *
 *   // Once at app start:
 *   registerMarketingAgentHandler();
 *
 *   // To enqueue a run:
 *   await queueMarketingAgentRun({ agentId, triggeredById });
 *
 * The handler defers to lib/marketing-agency/agent/runner.ts which is
 * already queue-friendly (pure async function, no HTTP coupling).
 */
import {
  enqueue,
  registerHandler,
  JobTypes,
  type Job,
  type JobOptions,
} from '@/lib/queue';
import { runAgent } from './runner';
import { logger } from '@/lib/logger';

export interface MarketingAgentRunJobData {
  agentId: string;
  triggeredById: string;
  /** Reason this was enqueued; for observability. */
  trigger: 'manual' | 'cadence-daily' | 'cadence-weekly' | 'cadence-hourly';
}

/**
 * Enqueue an agent run. Returns the job record immediately; the run
 * itself happens on a worker.
 */
export async function queueMarketingAgentRun(
  data: MarketingAgentRunJobData,
  options?: JobOptions,
): Promise<Job<MarketingAgentRunJobData>> {
  return enqueue(JobTypes.MARKETING_AGENT_RUN, data, {
    maxAttempts: 1, // The runner has its own try/catch and writes failed status — don't double-execute
    ...options,
  });
}

let handlerRegistered = false;

/**
 * Register the MARKETING_AGENT_RUN handler exactly once. Idempotent —
 * safe to call from multiple entry points.
 */
export function registerMarketingAgentHandler(): void {
  if (handlerRegistered) return;
  handlerRegistered = true;

  registerHandler<MarketingAgentRunJobData>(
    JobTypes.MARKETING_AGENT_RUN,
    async (job) => {
      const { agentId, triggeredById, trigger } = job.data;
      logger.info('marketing-agent: queue handler picked up run', {
        jobId: job.id,
        agentId,
        triggeredById,
        trigger,
      });
      const result = await runAgent({ agentId, triggeredById });
      logger.info('marketing-agent: queue handler completed run', {
        jobId: job.id,
        agentId,
        runId: result.runId,
        status: result.status,
      });
      return result;
    },
  );
}
