/**
 * Auto-Research BullMQ Worker
 *
 * Processes jobs from the auto-research queue.
 * Run as a separate process: npx tsx app/workers/auto-research.worker.ts
 *
 * ENVIRONMENT VARIABLES:
 * - REDIS_URL: Redis connection (required)
 * - APIFY_API_TOKEN: Apify scraping (required for real data)
 * - OPENROUTER_API_KEY / ANTHROPIC_API_KEY: AI analysis (required)
 */
import { Worker } from 'bullmq';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({
  path: path.join(__dirname, '..', '..', '.env.local'),
  override: true,
});
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

import {
  runDailyTrends,
  runWeeklyDeep,
  registerScheduledJobs,
} from '@/lib/auto-research';
import { logger } from '@/lib/logger';

const QUEUE_NAME = 'auto-research';

function getRedisConnection() {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const url = new URL(redisUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port || '6379', 10),
      username: url.username || undefined,
      password: url.password || undefined,
      tls: url.protocol === 'rediss:' ? {} : undefined,
    };
  }
  return { host: 'localhost', port: 6379 };
}

const worker = new Worker(
  QUEUE_NAME,
  async job => {
    const { type, orgId } = job.data as {
      type: 'daily_trends' | 'weekly_deep';
      orgId?: string;
    };

    logger.info('AutoResearch worker: processing job', {
      jobId: job.id,
      type,
      orgId,
    });

    if (type === 'daily_trends') {
      return runDailyTrends(orgId);
    } else if (type === 'weekly_deep') {
      return runWeeklyDeep(orgId);
    } else {
      throw new Error(`Unknown job type: ${type}`);
    }
  },
  {
    connection: getRedisConnection(),
    concurrency: 1, // one research run at a time
  }
);

worker.on('completed', job => {
  logger.info('AutoResearch worker: job completed', { jobId: job.id });
});

worker.on('failed', (job, err) => {
  logger.error('AutoResearch worker: job failed', {
    jobId: job?.id,
    error: err.message,
  });
});

// Register scheduled jobs once worker is ready
worker.on('ready', async () => {
  logger.info('AutoResearch worker: ready, registering scheduled jobs');
  await registerScheduledJobs();
});

logger.info('AutoResearch worker: started, listening on queue', {
  queue: QUEUE_NAME,
});
