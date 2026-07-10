/**
 * Content Calendar Generation — Queue Handler (SYN-MCP-002).
 *
 * Registers the CALENDAR_GENERATION job type with the Synthex job queue
 * (lib/queue.ts) so calendar generation runs asynchronously instead of
 * holding a Vercel function open for days * platforms * postsPerDay
 * sequential LLM calls (the deprecated GET /api/ai/generate-content path).
 *
 * Usage:
 *   import { queueCalendarGeneration, registerCalendarGenerationHandler } from '@/lib/ai/calendar-job-handler';
 *
 *   // Once at app start (idempotent):
 *   registerCalendarGenerationHandler();
 *
 *   // To enqueue a run:
 *   const job = await queueCalendarGeneration({ userId, days, platforms, postsPerDay });
 *
 * The handler's return value is stored on the job record (job.result) by the
 * queue — that record IS the persistence the status endpoint reads from
 * (the synchronous calendar path has no other persistence).
 */
import {
  enqueue,
  registerHandler,
  JobTypes,
  type Job,
  type JobOptions,
} from '@/lib/queue';
import { aiContentGenerator } from '@/lib/ai/content-generator';
import { UsageTracker } from '@/lib/middleware/rate-limiter';
import { logger } from '@/lib/logger';

export interface CalendarGenerationJobData {
  userId: string;
  /** Org for brand context — threaded into generateContentCalendar. */
  organizationId?: string;
  days: number;
  platforms: string[];
  postsPerDay: number;
  /**
   * Accepted and recorded now; dedupe enforcement lands with the full
   * GenerationContext threading in SYN-MCP-003.
   */
  idempotencyKey?: string;
}

/**
 * Enqueue a calendar generation run. Returns the job record immediately;
 * generation happens on a worker.
 */
export async function queueCalendarGeneration(
  data: CalendarGenerationJobData,
  options?: JobOptions
): Promise<Job<CalendarGenerationJobData>> {
  return enqueue(JobTypes.CALENDAR_GENERATION, data, {
    // Calendar generation is expensive (many LLM calls) — never auto-retry
    // a partial failure; the caller can re-submit deliberately.
    maxAttempts: 1,
    ...options,
  });
}

let handlerRegistered = false;

/**
 * Register the CALENDAR_GENERATION handler exactly once. Idempotent —
 * safe to call from multiple entry points (same pattern as
 * registerMarketingAgentHandler).
 */
export function registerCalendarGenerationHandler(): void {
  if (handlerRegistered) return;
  handlerRegistered = true;

  registerHandler<CalendarGenerationJobData>(
    JobTypes.CALENDAR_GENERATION,
    async job => {
      const { userId, organizationId, days, platforms, postsPerDay } = job.data;
      logger.info('calendar-jobs: handler picked up run', {
        jobId: job.id,
        userId,
        days,
        platforms,
        postsPerDay,
      });

      const calendar = await aiContentGenerator.generateContentCalendar(
        days,
        platforms,
        postsPerDay,
        organizationId
      );

      // Convert Map to a plain object so it serialises into job.result.
      const calendarObject: Record<string, unknown> = {};
      let totalPosts = 0;
      calendar.forEach((value, key) => {
        calendarObject[key] = value;
        totalPosts += Array.isArray(value) ? value.length : 0;
      });

      // Per-post usage accounting — same feature key as the sync path.
      await UsageTracker.track(userId, 'ai_posts', totalPosts);

      logger.info('calendar-jobs: handler completed run', {
        jobId: job.id,
        userId,
        totalPosts,
      });

      return { calendar: calendarObject, totalPosts };
    }
  );
}
