/**
 * Auto-Research Scheduler
 *
 * BullMQ-based scheduler for autonomous research runs.
 * Queue: auto-research
 * Daily job: 3:00 AM UTC (daily_trends)
 * Weekly job: Sunday 2:00 AM UTC (weekly_deep)
 *
 * FAILURE MODE: enqueue fails closed when Redis/BullMQ is unreachable —
 * never fabricates a research run or returns a fake job id.
 */
import { Queue } from 'bullmq';
import { logger } from '@/lib/logger';

const QUEUE_NAME = 'auto-research';
const REDIS_PING_TIMEOUT_MS = 2_000;

/** Thrown when Redis/BullMQ cannot accept a research job (map to HTTP 503). */
export class ResearchQueueUnavailableError extends Error {
  constructor(message = 'Research queue unavailable (Redis/BullMQ down)') {
    super(message);
    this.name = 'ResearchQueueUnavailableError';
  }
}

function isConnectionFailure(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|Connection is closed|Redis|timed?\s*out|NOAUTH|WRONGPASS/i.test(
    msg
  );
}

// Redis connection config — uses REDIS_URL or local fallback
function getRedisConnection() {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    // Parse redis://username:password@host:port or rediss:// (TLS)
    const url = new URL(redisUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port || '6379', 10),
      username: url.username || undefined,
      password: url.password || undefined,
      tls: url.protocol === 'rediss:' ? {} : undefined,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
    };
  }
  // Default local Redis
  return {
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
  };
}

let researchQueue: Queue | null = null;

export function getResearchQueue(): Queue {
  if (!researchQueue) {
    researchQueue = new Queue(QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        removeOnComplete: 100, // keep last 100 completed jobs
        removeOnFail: 50,
      },
    });
  }
  return researchQueue;
}

/**
 * Register the recurring scheduled jobs.
 * Call this once at application startup (from the worker process).
 */
export async function registerScheduledJobs(): Promise<void> {
  const queue = getResearchQueue();

  // Remove any existing repeating jobs to avoid duplicates on restart
  const existingJobs = await queue.getRepeatableJobs();
  for (const job of existingJobs) {
    await queue.removeRepeatableByKey(job.key);
  }

  // Daily trends: 3:00 AM UTC every day
  await queue.add(
    'daily_trends',
    { type: 'daily_trends', orgId: undefined },
    { repeat: { pattern: '0 3 * * *' } }
  );

  // Weekly deep: Sunday 2:00 AM UTC
  await queue.add(
    'weekly_deep',
    { type: 'weekly_deep', orgId: undefined },
    { repeat: { pattern: '0 2 * * 0' } }
  );

  logger.info('AutoResearch: scheduled jobs registered', {
    daily: '0 3 * * * (daily_trends)',
    weekly: '0 2 * * 0 (weekly_deep)',
  });
}

/**
 * Enqueue a manual one-off research run.
 * Probes Redis via a bounded queue.add — fail closed on timeout/connection
 * errors so we never invent a job id when the broker is down.
 * @throws {ResearchQueueUnavailableError} when Redis/BullMQ is unreachable
 */
export async function enqueueManualRun(
  type: 'daily_trends' | 'weekly_deep',
  orgId?: string
): Promise<string> {
  const queue = getResearchQueue();
  try {
    const job = await Promise.race([
      queue.add(type, { type, orgId }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new ResearchQueueUnavailableError('Redis enqueue timed out')
            ),
          REDIS_PING_TIMEOUT_MS
        )
      ),
    ]);
    if (!job.id) {
      throw new ResearchQueueUnavailableError(
        'BullMQ accepted the job but returned no id'
      );
    }
    logger.info('AutoResearch: manual run enqueued', {
      jobId: job.id,
      type,
      orgId,
    });
    return job.id;
  } catch (err) {
    if (err instanceof ResearchQueueUnavailableError) {
      logger.warn('AutoResearch: queue unavailable — fail closed', {
        type,
        orgId,
        error: err.message,
      });
      throw err;
    }
    if (isConnectionFailure(err)) {
      logger.warn('AutoResearch: Redis connection failure — fail closed', {
        type,
        orgId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new ResearchQueueUnavailableError(
        err instanceof Error ? err.message : 'Redis/BullMQ unreachable'
      );
    }
    throw err;
  }
}
