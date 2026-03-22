/**
 * lib/autopilot/launch-pipeline.ts
 *
 * Queues an Autopilot pipeline job for a single user via BullMQ.
 *
 * All BullMQ/Redis imports are LAZY so this module is safe to import
 * in Jest test files without requiring a live Redis connection.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AutopilotConfig {
  platforms?: string[];
  postFrequency?: 'daily' | 'weekly' | 'custom';
  topics?: string[];
  tone?: string;
  [key: string]: unknown;
}

export interface LaunchPipelineOptions {
  userId: string;
  config: AutopilotConfig;
  runId: string;
  priority?: number;
}

export interface LaunchPipelineResult {
  jobId: string;
  userId: string;
  queuedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lazy queue factory
// ─────────────────────────────────────────────────────────────────────────────

let _queue: import('bullmq').Queue | null = null;

async function getAutopilotQueue(): Promise<import('bullmq').Queue> {
  if (_queue) return _queue;

  // Lazy import — safe for Jest which never reaches this path in unit tests
  const { Queue } = await import('bullmq');

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl) {
    throw new Error('LaunchPipeline: UPSTASH_REDIS_REST_URL is required.');
  }

  // Upstash REST-compatible connection config
  const connection = redisToken
    ? {
        url: redisUrl,
        // Upstash REST uses a custom adapter — if using ioredis directly,
        // supply host/port/password parsed from the URL instead.
        tls: {},
        password: redisToken,
      }
    : { url: redisUrl };

  _queue = new Queue('autopilot-pipeline', {
    connection: connection as Parameters<typeof Queue>[1]['connection'],
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    },
  });

  return _queue;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enqueues an autopilot pipeline job for the given user.
 *
 * The job will be processed by the BullMQ worker in `workers/autopilot-worker.ts`.
 */
export async function launchAutopilotPipeline(
  options: LaunchPipelineOptions
): Promise<LaunchPipelineResult> {
  const { userId, config, runId, priority = 10 } = options;

  const queue = await getAutopilotQueue();
  const queuedAt = new Date().toISOString();

  const job = await queue.add(
    'run-autopilot',
    { userId, config, runId, queuedAt },
    {
      jobId: `autopilot:${runId}:${userId}`,
      priority,
    }
  );

  return {
    jobId: job.id ?? `autopilot:${runId}:${userId}`,
    userId,
    queuedAt,
  };
}
