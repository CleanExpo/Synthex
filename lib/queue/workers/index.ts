/**
 * Queue Workers Index
 *
 * @description Exports all workers and provides a unified startup function
 */

import { Worker } from 'bullmq';
// NOTE (P1 / syn-p1-retire-dead-scheduler): the scheduled-posts BullMQ worker
// was removed. It was never booted (`startAllWorkers` is called nowhere), and it
// drained the `scheduled_posts` table — a path that silently swallowed posts.
// Scheduled posts now flow exclusively through the `Post` table + the Vercel cron
// `/api/cron/publish-scheduled`. Do NOT re-add a worker that drains
// `scheduled_posts`; route through `lib/social/schedule-via-post` instead.
import { createAnalyticsWorker } from './analytics-worker';
import { createWorkflowStepWorker } from './workflow-step.worker';
import { createAutonomousTaskWorker } from './autonomous-task-worker';
import { logger } from '@/lib/logger';

// Store worker instances for graceful shutdown
const workers: Worker[] = [];

/**
 * Start all queue workers
 */
export function startAllWorkers(): Worker[] {
  logger.info('Starting all queue workers...');

  // NOTE (P1): no scheduled-posts worker — see file header. Scheduled posts are
  // published by the Vercel cron `/api/cron/publish-scheduled`, not BullMQ.

  // Start analytics collection worker
  const analyticsWorker = createAnalyticsWorker();
  workers.push(analyticsWorker);

  // Start workflow step worker
  const workflowStepWorker = createWorkflowStepWorker();
  workers.push(workflowStepWorker);

  // Start autonomous task worker (Phase 118 — Headless Task-Runner)
  const autonomousWorker = createAutonomousTaskWorker();
  workers.push(autonomousWorker);

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
// (createScheduledPostsWorker removed — see file header, P1)
export { createAnalyticsWorker } from './analytics-worker';
export { createWorkflowStepWorker } from './workflow-step.worker';
export { createAutonomousTaskWorker } from './autonomous-task-worker';
