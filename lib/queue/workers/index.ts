/**
 * Queue Workers Index
 *
 * @description Exports all workers and provides a unified startup function
 */

import { Worker } from 'bullmq';
import { createScheduledPostsWorker } from './scheduled-posts-worker';
import { createAnalyticsWorker } from './analytics-worker';
import { logger } from '@/lib/logger';

// Store worker instances for graceful shutdown
const workers: Worker[] = [];

/**
 * Start all queue workers
 */
export function startAllWorkers(): Worker[] {
  logger.info('Starting all queue workers...');

  // Start scheduled posts worker
  const scheduledPostsWorker = createScheduledPostsWorker();
  workers.push(scheduledPostsWorker);

  // Start analytics collection worker
  const analyticsWorker = createAnalyticsWorker();
  workers.push(analyticsWorker);

  logger.info(`Started ${workers.length} workers`);

  return workers;
}

/**
 * Gracefully stop all workers
 */
export async function stopAllWorkers(): Promise<void> {
  logger.info('Stopping all queue workers...');

  const closePromises = workers.map((worker) => worker.close());
  await Promise.all(closePromises);

  workers.length = 0;

  logger.info('All workers stopped');
}

/**
 * Get worker status
 */
export function getWorkersStatus(): Array<{
  name: string;
  running: boolean;
}> {
  return workers.map((worker) => ({
    name: worker.name,
    running: worker.isRunning(),
  }));
}

// Export individual worker creators
export { createScheduledPostsWorker } from './scheduled-posts-worker';
export { createAnalyticsWorker } from './analytics-worker';
