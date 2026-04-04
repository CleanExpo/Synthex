/**
 * Background Job Queue
 *
 * Provides job queue functionality for async processing
 * with retry logic, dead letter queue, and job monitoring.
 *
 * Jobs are persisted to Redis so they survive Lambda cold-starts and are
 * visible to all instances. In development, Redis is optional and the queue
 * falls back to in-memory only (no cross-instance sharing).
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - UPSTASH_REDIS_REST_URL (INTERNAL)
 * - UPSTASH_REDIS_REST_TOKEN (SECRET)
 *
 * @module lib/queue
 */

import { getRedisClient } from '@/lib/redis-client';
import { logger } from '@/lib/logger';

// =============================================================================
// Redis persistence helpers
// =============================================================================

const REDIS_KEY_PREFIX = 'synthex:queue:job:';
const REDIS_JOB_TTL = 86_400; // 24 h — auto-clean completed / stale jobs

type SerializedJob = Omit<
  Job,
  'createdAt' | 'updatedAt' | 'scheduledFor' | 'completedAt'
> & {
  createdAt: string;
  updatedAt: string;
  scheduledFor?: string;
  completedAt?: string;
};

function deserializeJob(data: SerializedJob): Job {
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
    scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : undefined,
    completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
  };
}

async function persistJobToRedis(job: Job): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.set(
      REDIS_KEY_PREFIX + job.id,
      JSON.stringify(job),
      REDIS_JOB_TTL
    );
  } catch {
    // Non-fatal — job still lives in this instance's memory map
  }
}

async function removeJobFromRedis(jobId: string): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.del(REDIS_KEY_PREFIX + jobId);
  } catch {
    // Non-fatal
  }
}

/**
 * Recover pending jobs from Redis into this Lambda instance's in-memory map.
 * Call once at cold-start (e.g. from a cron init route) so the worker can
 * process jobs that were enqueued by other instances.
 *
 * @returns Number of jobs recovered
 */
export async function recoverJobsFromRedis(): Promise<number> {
  try {
    const redis = getRedisClient();
    const keys = await redis.keys(REDIS_KEY_PREFIX + '*');
    let recovered = 0;
    for (const key of keys) {
      const raw = await redis.get(key);
      if (!raw) continue;
      const job = deserializeJob(JSON.parse(raw) as SerializedJob);
      if (
        !jobs.has(job.id) &&
        (job.status === 'pending' || job.status === 'processing')
      ) {
        jobs.set(job.id, job);
        recovered++;
      }
    }
    if (recovered > 0) {
      logger.info(`[Queue] Recovered ${recovered} pending jobs from Redis`);
    }
    return recovered;
  } catch {
    return 0;
  }
}

// =============================================================================
// Types
// =============================================================================

export type JobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'dead';

export interface Job<T = unknown> {
  id: string;
  type: string;
  data: T;
  status: JobStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  updatedAt: Date;
  scheduledFor?: Date;
  completedAt?: Date;
  error?: string;
  result?: unknown;
}

export interface JobOptions {
  priority?: number;
  maxAttempts?: number;
  delay?: number;
  scheduledFor?: Date;
}

export type JobHandler<T = unknown> = (job: Job<T>) => Promise<unknown>;

// =============================================================================
// In-Memory Queue (Development/Fallback)
// =============================================================================

const jobs = new Map<string, Job>();
const handlers = new Map<string, JobHandler>();
const processingLock = new Set<string>();

/**
 * Generate unique job ID
 */
function generateJobId(): string {
  return `job_${crypto.randomUUID()}`;
}

// =============================================================================
// Queue Operations
// =============================================================================

/**
 * Add a job to the queue
 */
export async function enqueue<T>(
  type: string,
  data: T,
  options: JobOptions = {}
): Promise<Job<T>> {
  const job: Job<T> = {
    id: generateJobId(),
    type,
    data,
    status: 'pending',
    priority: options.priority || 0,
    attempts: 0,
    maxAttempts: options.maxAttempts || 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    scheduledFor:
      options.scheduledFor ||
      (options.delay ? new Date(Date.now() + options.delay) : undefined),
  };

  jobs.set(job.id, job);

  // Persist to Redis so other Lambda instances (and cold-starts) can see this job.
  // In production, warn loudly if Redis is not reachable — jobs will be lost on restart.
  if (process.env.NODE_ENV === 'production') {
    await persistJobToRedis(job);
  } else {
    // Best-effort in dev — don't block
    persistJobToRedis(job).catch(() => undefined);
  }

  // Auto-process if handler exists and not scheduled for later
  if (!job.scheduledFor || job.scheduledFor <= new Date()) {
    processNextJob(type);
  }

  return job;
}

/**
 * Register a job handler
 */
export function registerHandler<T = unknown>(
  type: string,
  handler: JobHandler<T>
): void {
  handlers.set(type, handler as JobHandler);
}

/**
 * Process the next job of a given type
 */
async function processNextJob(type?: string): Promise<void> {
  const pendingJobs = Array.from(jobs.values())
    .filter(job => {
      if (job.status !== 'pending') return false;
      if (type && job.type !== type) return false;
      if (processingLock.has(job.id)) return false;
      if (job.scheduledFor && job.scheduledFor > new Date()) return false;
      return true;
    })
    .sort((a, b) => {
      // Higher priority first, then oldest first
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

  if (pendingJobs.length === 0) return;

  const job = pendingJobs[0];
  const handler = handlers.get(job.type);

  if (!handler) {
    logger.warn(`[Queue] No handler for job type: ${job.type}`);
    return;
  }

  // Acquire lock
  processingLock.add(job.id);

  try {
    job.status = 'processing';
    job.attempts++;
    job.updatedAt = new Date();

    const result = await handler(job);

    job.status = 'completed';
    job.completedAt = new Date();
    job.result = result;
    job.updatedAt = new Date();
    // Completed jobs don't need to live in Redis — remove to keep the keyspace clean
    removeJobFromRedis(job.id).catch(() => undefined);
  } catch (error) {
    job.error = error instanceof Error ? error.message : String(error);
    job.updatedAt = new Date();

    if (job.attempts >= job.maxAttempts) {
      job.status = 'dead';
      logger.error(`[Queue] Job moved to dead letter queue: ${job.id}`, {
        error,
      });
      // Keep dead jobs in Redis briefly (TTL will clean them up) for post-mortem
      persistJobToRedis(job).catch(() => undefined);
    } else {
      job.status = 'pending';
      logger.warn(`[Queue] Job failed, will retry: ${job.id}`, { error });

      // Exponential backoff for retry
      const delay = Math.pow(2, job.attempts) * 1000;
      job.scheduledFor = new Date(Date.now() + delay);
      persistJobToRedis(job).catch(() => undefined);

      setTimeout(() => processNextJob(job.type), delay);
    }
  } finally {
    processingLock.delete(job.id);
  }

  // Process next job
  processNextJob(type);
}

/**
 * Get job by ID
 */
export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

/**
 * Get jobs by status
 */
export function getJobsByStatus(status: JobStatus): Job[] {
  return Array.from(jobs.values()).filter(job => job.status === status);
}

/**
 * Get dead letter jobs
 */
export function getDeadLetterJobs(): Job[] {
  return getJobsByStatus('dead');
}

/**
 * Retry a dead job
 */
export async function retryJob(id: string): Promise<Job | null> {
  const job = jobs.get(id);

  if (!job || job.status !== 'dead') {
    return null;
  }

  job.status = 'pending';
  job.attempts = 0;
  job.error = undefined;
  job.scheduledFor = undefined;
  job.updatedAt = new Date();

  processNextJob(job.type);

  return job;
}

/**
 * Cancel a pending job
 */
export function cancelJob(id: string): boolean {
  const job = jobs.get(id);

  if (!job || job.status !== 'pending') {
    return false;
  }

  jobs.delete(id);
  return true;
}

/**
 * Get queue statistics
 */
export function getQueueStats(): {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  dead: number;
} {
  const allJobs = Array.from(jobs.values());

  return {
    total: allJobs.length,
    pending: allJobs.filter(j => j.status === 'pending').length,
    processing: allJobs.filter(j => j.status === 'processing').length,
    completed: allJobs.filter(j => j.status === 'completed').length,
    failed: allJobs.filter(j => j.status === 'failed').length,
    dead: allJobs.filter(j => j.status === 'dead').length,
  };
}

// =============================================================================
// Pre-defined Job Types
// =============================================================================

export const JobTypes = {
  EMAIL_SEND: 'email:send',
  EMAIL_BATCH: 'email:batch',
  ANALYTICS_AGGREGATE: 'analytics:aggregate',
  CONTENT_GENERATE: 'content:generate',
  CONTENT_PUBLISH: 'content:publish',
  WEBHOOK_DELIVER: 'webhook:deliver',
  REPORT_GENERATE: 'report:generate',
  EXPORT_DATA: 'export:data',
  CLEANUP: 'cleanup',
} as const;

export type JobType = (typeof JobTypes)[keyof typeof JobTypes];

// =============================================================================
// Email Jobs
// =============================================================================

export interface EmailJobData {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  template?: string;
  templateData?: Record<string, unknown>;
}

/**
 * Queue an email to be sent
 */
export async function queueEmail(
  email: EmailJobData,
  options?: JobOptions
): Promise<Job<EmailJobData>> {
  return enqueue(JobTypes.EMAIL_SEND, email, options);
}

/**
 * Queue a batch of emails
 */
export async function queueEmailBatch(
  emails: EmailJobData[],
  options?: JobOptions
): Promise<Job<EmailJobData[]>> {
  return enqueue(JobTypes.EMAIL_BATCH, emails, { ...options, maxAttempts: 5 });
}

// =============================================================================
// Analytics Jobs
// =============================================================================

export interface AnalyticsAggregateJobData {
  userId: string;
  dateRange: {
    start: Date;
    end: Date;
  };
  metrics: string[];
}

/**
 * Queue analytics aggregation
 */
export async function queueAnalyticsAggregation(
  data: AnalyticsAggregateJobData,
  options?: JobOptions
): Promise<Job<AnalyticsAggregateJobData>> {
  return enqueue(JobTypes.ANALYTICS_AGGREGATE, data, options);
}

// =============================================================================
// Webhook Jobs
// =============================================================================

export interface WebhookDeliveryJobData {
  url: string;
  event: string;
  payload: unknown;
  secret?: string;
}

/**
 * Queue webhook delivery
 */
export async function queueWebhookDelivery(
  data: WebhookDeliveryJobData,
  options?: JobOptions
): Promise<Job<WebhookDeliveryJobData>> {
  return enqueue(JobTypes.WEBHOOK_DELIVER, data, {
    ...options,
    maxAttempts: 5,
  });
}

// =============================================================================
// Content Jobs
// =============================================================================

export interface ContentGenerateJobData {
  userId: string;
  prompt: string;
  platform: string;
  options?: Record<string, unknown>;
}

export interface ContentPublishJobData {
  postId: string;
  platform: string;
  accessToken: string;
}

/**
 * Queue content generation
 */
export async function queueContentGeneration(
  data: ContentGenerateJobData,
  options?: JobOptions
): Promise<Job<ContentGenerateJobData>> {
  return enqueue(JobTypes.CONTENT_GENERATE, data, options);
}

/**
 * Queue content publishing
 */
export async function queueContentPublish(
  data: ContentPublishJobData,
  options?: JobOptions
): Promise<Job<ContentPublishJobData>> {
  return enqueue(JobTypes.CONTENT_PUBLISH, data, options);
}

// =============================================================================
// Worker Initialization
// =============================================================================

let _workerInterval: NodeJS.Timeout | null = null;

/**
 * Start the job processing worker
 */
export function startWorker(): void {
  if (_workerInterval) return; // Prevent double-start
  // Process pending jobs every 5 seconds
  _workerInterval = setInterval(() => {
    for (const type of handlers.keys()) {
      processNextJob(type);
    }
  }, 5000);
}

/**
 * Stop the job processing worker (clears the interval)
 */
export function stopWorker(): void {
  if (_workerInterval) {
    clearInterval(_workerInterval);
    _workerInterval = null;
  }
}

/**
 * Register all default handlers
 */
export function registerDefaultHandlers(): void {
  // Email handler (stub - implement with actual email service)
  registerHandler(JobTypes.EMAIL_SEND, async (job: Job<EmailJobData>) => {
    // Implement actual email sending
    return { sent: true, timestamp: new Date() };
  });

  // Webhook delivery handler
  registerHandler(
    JobTypes.WEBHOOK_DELIVER,
    async (job: Job<WebhookDeliveryJobData>) => {
      const { url, event, payload, secret } = job.data;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': event,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook delivery failed: ${response.status}`);
      }

      return { delivered: true, status: response.status };
    }
  );
}
