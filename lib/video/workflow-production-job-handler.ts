/**
 * SYNTHEX Workflow Video Production — Queue Handler (AT-032).
 *
 * Registers the VIDEO_WORKFLOW_PRODUCTION job type with lib/queue.ts so
 * POST /api/video enqueues capture/process/upload instead of holding the
 * HTTP connection open for the full Playwright + FFmpeg pipeline.
 *
 * The handler return value is stored on job.result — that record is the
 * persistence GET ?jobId= reads from (same pattern as calendar-jobs).
 */
import {
  enqueue,
  registerHandler,
  JobTypes,
  type Job,
  type JobOptions,
} from '@/lib/queue';
import { logger } from '@/lib/logger';

export interface WorkflowProductionJobData {
  userId: string;
  workflow: string;
  skipUpload: boolean;
}

export interface WorkflowProductionJobResult {
  success: boolean;
  production: {
    workflowName: string;
    rawVideoPath: string;
    processedVideoPath: string;
    thumbnailPath?: string;
    youtubeResult: {
      videoId: string;
      videoUrl: string;
      embedUrl: string;
      thumbnailUrl: string;
    } | null;
    error: string | null;
  };
}

/**
 * Enqueue a SYNTHEX workflow video production run. Returns immediately;
 * capture runs on the queue worker.
 */
export async function queueWorkflowProduction(
  data: WorkflowProductionJobData,
  options?: JobOptions
): Promise<Job<WorkflowProductionJobData>> {
  return enqueue(JobTypes.VIDEO_WORKFLOW_PRODUCTION, data, {
    // Capture is expensive and not safely repeatable — no auto-retry.
    maxAttempts: 1,
    ...options,
  });
}

let handlerRegistered = false;

/** Register the VIDEO_WORKFLOW_PRODUCTION handler exactly once. */
export function registerWorkflowProductionHandler(): void {
  if (handlerRegistered) return;
  handlerRegistered = true;

  registerHandler<WorkflowProductionJobData>(
    JobTypes.VIDEO_WORKFLOW_PRODUCTION,
    async job => {
      const { workflow, skipUpload } = job.data;
      logger.info('video-workflow: handler picked up run', {
        jobId: job.id,
        workflow,
        skipUpload,
      });

      const { VideoOrchestrator } =
        await import('@/lib/video/video-orchestrator');
      const orchestrator = new VideoOrchestrator();
      const result = await orchestrator.produceVideo(workflow, { skipUpload });

      logger.info('video-workflow: handler completed run', {
        jobId: job.id,
        workflow,
        success: result.success,
      });

      return {
        success: result.success,
        production: {
          workflowName: result.workflowName,
          rawVideoPath: result.rawVideoPath,
          processedVideoPath: result.processedVideoPath,
          thumbnailPath: result.thumbnailPath,
          youtubeResult: result.youtubeResult ?? null,
          error: result.error ?? null,
        },
      } satisfies WorkflowProductionJobResult;
    }
  );
}
