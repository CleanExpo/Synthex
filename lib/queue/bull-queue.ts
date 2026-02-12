/**
 * BullMQ Queue Configuration
 *
 * @description Distributed job queue for background processing
 * Handles scheduled posts, analytics collection, notifications, and more.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - REDIS_URL: Redis connection URL (CRITICAL)
 *
 * FAILURE MODE: Falls back to in-memory queue for development
 */

import { Queue, Worker, Job, QueueEvents, ConnectionOptions } from 'bullmq';
import { logger } from '@/lib/logger';

// Queue names
export const QUEUE_NAMES = {
  SCHEDULED_POSTS: 'scheduled-posts',
  ANALYTICS_COLLECTION: 'analytics-collection',
  NOTIFICATIONS: 'notifications',
  MEDIA_PROCESSING: 'media-processing',
  REPORT_GENERATION: 'report-generation',
  CONTENT_OPTIMIZATION: 'content-optimization',
  PLATFORM_SYNC: 'platform-sync',
} as const;

// Job types
export type JobType =
  | 'publish-post'
  | 'collect-analytics'
  | 'send-notification'
  | 'process-media'
  | 'generate-report'
  | 'optimize-content'
  | 'sync-platform';

// Job data interfaces
export interface ScheduledPostJobData {
  type: 'publish-post';
  postId: string;
  userId: string;
  platform: string;
  content: string;
  mediaUrls?: string[];
  metadata?: Record<string, unknown>;
}

export interface AnalyticsJobData {
  type: 'collect-analytics';
  userId: string;
  platform: string;
  connectionId: string;
  dateRange?: { start: string; end: string };
}

export interface NotificationJobData {
  type: 'send-notification';
  userId: string;
  title: string;
  body: string;
  channel: 'email' | 'push' | 'in-app';
  metadata?: Record<string, unknown>;
}

export interface MediaProcessingJobData {
  type: 'process-media';
  userId: string;
  mediaUrl: string;
  operations: Array<'resize' | 'compress' | 'watermark' | 'transcode'>;
  outputPath?: string;
}

export interface ReportJobData {
  type: 'generate-report';
  userId: string;
  reportType: string;
  templateId?: string;
  dateRange: { start: string; end: string };
  format: 'pdf' | 'csv' | 'json';
}

export interface ContentOptimizationJobData {
  type: 'optimize-content';
  userId: string;
  contentId: string;
  optimizationType: 'hashtags' | 'timing' | 'engagement' | 'ab-test';
}

export interface PlatformSyncJobData {
  type: 'sync-platform';
  userId: string;
  platform: string;
  connectionId: string;
  syncType: 'posts' | 'analytics' | 'profile' | 'full';
}

export type QueueJobData =
  | ScheduledPostJobData
  | AnalyticsJobData
  | NotificationJobData
  | MediaProcessingJobData
  | ReportJobData
  | ContentOptimizationJobData
  | PlatformSyncJobData;

// Redis connection configuration
function getRedisConnection(): ConnectionOptions {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    logger.warn('REDIS_URL not set, using localhost for development');
    return {
      host: 'localhost',
      port: 6379,
    };
  }

  try {
    const url = new URL(redisUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port || '6379', 10),
      password: url.password || undefined,
      username: url.username || undefined,
      tls: url.protocol === 'rediss:' ? {} : undefined,
    };
  } catch {
    logger.error('Invalid REDIS_URL format');
    return {
      host: 'localhost',
      port: 6379,
    };
  }
}

const connection = getRedisConnection();

// Default job options
const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1000,
  },
  removeOnComplete: {
    age: 24 * 60 * 60, // Keep completed jobs for 24 hours
    count: 1000,
  },
  removeOnFail: {
    age: 7 * 24 * 60 * 60, // Keep failed jobs for 7 days
  },
};

// Queue instances
const queues: Map<string, Queue> = new Map();

/**
 * Get or create a queue instance
 */
export function getQueue(name: string): Queue {
  if (!queues.has(name)) {
    const queue = new Queue(name, {
      connection,
      defaultJobOptions,
    });

    queue.on('error', (error) => {
      logger.error(`Queue ${name} error:`, { error });
    });

    queues.set(name, queue);
  }

  return queues.get(name)!;
}

/**
 * Add a job to a queue
 */
export async function addJob<T extends QueueJobData>(
  queueName: string,
  jobData: T,
  options?: {
    delay?: number;
    priority?: number;
    repeat?: {
      pattern?: string;
      every?: number;
      limit?: number;
    };
    jobId?: string;
  }
): Promise<Job<T>> {
  const queue = getQueue(queueName);

  const jobOptions: Record<string, unknown> = {
    ...defaultJobOptions,
    ...options,
  };

  if (options?.delay) {
    jobOptions.delay = options.delay;
  }

  if (options?.priority) {
    jobOptions.priority = options.priority;
  }

  if (options?.repeat) {
    jobOptions.repeat = options.repeat;
  }

  if (options?.jobId) {
    jobOptions.jobId = options.jobId;
  }

  const job = await queue.add(jobData.type, jobData, jobOptions);

  logger.info(`Job added to queue ${queueName}`, {
    jobId: job.id,
    type: jobData.type,
  });

  return job as Job<T>;
}

/**
 * Schedule a post for future publication
 */
export async function schedulePost(
  postId: string,
  userId: string,
  platform: string,
  scheduledTime: Date,
  content: string,
  mediaUrls?: string[],
  metadata?: Record<string, unknown>
): Promise<Job<ScheduledPostJobData>> {
  const delay = Math.max(0, scheduledTime.getTime() - Date.now());

  return addJob<ScheduledPostJobData>(
    QUEUE_NAMES.SCHEDULED_POSTS,
    {
      type: 'publish-post',
      postId,
      userId,
      platform,
      content,
      mediaUrls,
      metadata,
    },
    {
      delay,
      jobId: `scheduled-post-${postId}`,
    }
  );
}

/**
 * Schedule recurring analytics collection
 */
export async function scheduleAnalyticsCollection(
  userId: string,
  platform: string,
  connectionId: string,
  intervalMs: number = 60 * 60 * 1000 // Default: hourly
): Promise<Job<AnalyticsJobData>> {
  return addJob<AnalyticsJobData>(
    QUEUE_NAMES.ANALYTICS_COLLECTION,
    {
      type: 'collect-analytics',
      userId,
      platform,
      connectionId,
    },
    {
      repeat: {
        every: intervalMs,
      },
      jobId: `analytics-${userId}-${platform}`,
    }
  );
}

/**
 * Queue a notification for delivery
 */
export async function queueNotification(
  userId: string,
  title: string,
  body: string,
  channel: 'email' | 'push' | 'in-app' = 'in-app',
  metadata?: Record<string, unknown>
): Promise<Job<NotificationJobData>> {
  return addJob<NotificationJobData>(
    QUEUE_NAMES.NOTIFICATIONS,
    {
      type: 'send-notification',
      userId,
      title,
      body,
      channel,
      metadata,
    },
    {
      priority: channel === 'push' ? 1 : 2,
    }
  );
}

/**
 * Queue media processing
 */
export async function queueMediaProcessing(
  userId: string,
  mediaUrl: string,
  operations: Array<'resize' | 'compress' | 'watermark' | 'transcode'>
): Promise<Job<MediaProcessingJobData>> {
  return addJob<MediaProcessingJobData>(
    QUEUE_NAMES.MEDIA_PROCESSING,
    {
      type: 'process-media',
      userId,
      mediaUrl,
      operations,
    }
  );
}

/**
 * Queue report generation
 */
export async function queueReportGeneration(
  userId: string,
  reportType: string,
  dateRange: { start: string; end: string },
  format: 'pdf' | 'csv' | 'json' = 'pdf'
): Promise<Job<ReportJobData>> {
  return addJob<ReportJobData>(
    QUEUE_NAMES.REPORT_GENERATION,
    {
      type: 'generate-report',
      userId,
      reportType,
      dateRange,
      format,
    }
  );
}

/**
 * Cancel a scheduled job
 */
export async function cancelJob(queueName: string, jobId: string): Promise<boolean> {
  const queue = getQueue(queueName);

  try {
    const job = await queue.getJob(jobId);
    if (job) {
      await job.remove();
      logger.info(`Job ${jobId} cancelled from queue ${queueName}`);
      return true;
    }
    return false;
  } catch (error) {
    logger.error(`Failed to cancel job ${jobId}:`, { error });
    return false;
  }
}

/**
 * Get queue statistics
 */
export async function getQueueStats(queueName: string): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const queue = getQueue(queueName);

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

/**
 * Clean up completed and failed jobs
 */
export async function cleanQueue(
  queueName: string,
  grace: number = 24 * 60 * 60 * 1000 // Default: 24 hours
): Promise<void> {
  const queue = getQueue(queueName);

  await queue.clean(grace, 1000, 'completed');
  await queue.clean(grace * 7, 1000, 'failed'); // Keep failed longer

  logger.info(`Queue ${queueName} cleaned`);
}

/**
 * Gracefully shutdown all queues
 */
export async function shutdownQueues(): Promise<void> {
  const closePromises = Array.from(queues.values()).map((queue) =>
    queue.close()
  );

  await Promise.all(closePromises);
  queues.clear();

  logger.info('All queues shut down');
}

// Export queue events for monitoring
export function getQueueEvents(queueName: string): QueueEvents {
  return new QueueEvents(queueName, { connection });
}
