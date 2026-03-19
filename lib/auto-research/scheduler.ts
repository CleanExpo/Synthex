/**
 * Auto-Research Scheduler
 *
 * BullMQ-based scheduler for autonomous research runs.
 * Queue: auto-research
 * Daily job: 3:00 AM UTC (daily_trends)
 * Weekly job: Sunday 2:00 AM UTC (weekly_deep)
 */
import { Queue } from 'bullmq';
import { logger } from '@/lib/logger';

const QUEUE_NAME = 'auto-research';

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
    };
  }
  // Default local Redis
  return { host: 'localhost', port: 6379 };
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
 */
export async function enqueueManualRun(
  type: 'daily_trends' | 'weekly_deep',
  orgId?: string
): Promise<string> {
  const queue = getResearchQueue();
  const job = await queue.add(type, { type, orgId });
  logger.info('AutoResearch: manual run enqueued', {
    jobId: job.id,
    type,
    orgId,
  });
  return job.id ?? 'unknown';
}
