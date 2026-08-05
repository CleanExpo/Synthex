/**
 * Video Production API
 *
 * POST /api/video - Start a video production workflow
 * GET /api/video - Get system readiness and available workflows
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token signing key (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 *
 * ENVIRONMENT VARIABLES (OPTIONAL):
 * - YOUTUBE_CLIENT_ID: YouTube OAuth client ID
 * - YOUTUBE_CLIENT_SECRET: YouTube OAuth client secret
 * - YOUTUBE_REFRESH_TOKEN: YouTube OAuth refresh token
 * - ELEVENLABS_API_KEY: ElevenLabs API key for voiceover
 * - APP_URL: Application URL for capture service
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { requireEntitlement } from '@/lib/billing/require-entitlement';
import { logger } from '@/lib/logger';
import { getJob, recoverJobsFromRedis } from '@/lib/queue';
import { VideoOrchestrator } from '@/lib/video/video-orchestrator';
import {
  queueWorkflowProduction,
  registerWorkflowProductionHandler,
  type WorkflowProductionJobData,
} from '@/lib/video/workflow-production-job-handler';

// Register the queue handler once at module load (idempotent).
registerWorkflowProductionHandler();

// Available workflow names (mirrors SYNTHEX_WORKFLOWS keys)
const WORKFLOW_NAMES = [
  'platformOverview',
  'contentGenerator',
  'analyticsDashboard',
  'smartScheduler',
  'viralPatterns',
] as const;

const WORKFLOW_INFO: Record<
  string,
  { name: string; description: string; duration: number }
> = {
  platformOverview: {
    name: 'Platform Overview',
    description: 'Complete tour of Synthex dashboard showing all main features',
    duration: 60,
  },
  contentGenerator: {
    name: 'Content Generator',
    description: 'Demonstrate AI content generation for social media posts',
    duration: 45,
  },
  analyticsDashboard: {
    name: 'Analytics Dashboard',
    description: 'Show real-time analytics and engagement metrics',
    duration: 45,
  },
  smartScheduler: {
    name: 'Smart Scheduler',
    description: 'Demonstrate content scheduling with calendar views',
    duration: 45,
  },
  viralPatterns: {
    name: 'Viral Patterns',
    description: 'Show viral pattern analysis and insights',
    duration: 45,
  },
};

// Request validation
const ProduceRequestSchema = z.object({
  workflow: z.enum(WORKFLOW_NAMES),
  skipUpload: z.boolean().optional().default(false),
});

/**
 * GET /api/video
 * Returns system readiness status and available workflows
 */
export async function GET(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      security.error === 'Authentication required' ? 401 : 403
    );
  }

  try {
    const userId = security.context.userId;
    if (!userId) {
      return APISecurityChecker.createSecureResponse(
        { error: 'User ID not found' },
        401
      );
    }

    const jobId = new URL(request.url).searchParams.get('jobId');
    if (jobId) {
      let job = getJob(jobId);
      if (!job) {
        await recoverJobsFromRedis();
        job = getJob(jobId);
      }

      const jobData = job?.data as WorkflowProductionJobData | undefined;
      if (!job || jobData?.userId !== userId) {
        return APISecurityChecker.createSecureResponse(
          { error: 'Job not found' },
          404
        );
      }

      return APISecurityChecker.createSecureResponse({
        success: true,
        job: {
          id: job.id,
          status: job.status,
          createdAt: job.createdAt,
          completedAt: job.completedAt ?? null,
          error: job.error ?? null,
          result: job.result ?? null,
        },
      });
    }

    // Video production requires the Business tier. Central entitlement
    // resolves from plan AND status (fails closed for unpaid/past-due) and,
    // unlike the previous free-only check, correctly denies lower paid tiers
    // (starter/professional) that sit below Business.
    const entitlement = await requireEntitlement(userId, 'video_production');
    if (!entitlement.allowed) {
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error: 'Video production requires a Business subscription',
          upgradeRequired: true,
          requiredPlan: 'business',
        },
        402
      );
    }

    // Check readiness without importing heavy deps at module level
    const readiness = {
      ready: true,
      issues: [] as string[],
    };

    if (
      !process.env.YOUTUBE_CLIENT_ID ||
      !process.env.YOUTUBE_CLIENT_SECRET ||
      !process.env.YOUTUBE_REFRESH_TOKEN
    ) {
      readiness.issues.push('YouTube API credentials not configured');
    }
    if (!process.env.ELEVENLABS_API_KEY) {
      readiness.issues.push('ElevenLabs API key not configured');
    }
    readiness.ready = readiness.issues.length === 0;

    return APISecurityChecker.createSecureResponse({
      success: true,
      readiness,
      workflows: Object.entries(WORKFLOW_INFO).map(([key, info]) => ({
        id: key,
        ...info,
      })),
    });
  } catch (error) {
    logger.error('Video API GET error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to check video system status' },
      500
    );
  }
}

/**
 * POST /api/video
 * Start a video production workflow
 */
export async function POST(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      security.error === 'Authentication required' ? 401 : 403
    );
  }

  try {
    const userId = security.context.userId;
    if (!userId) {
      return APISecurityChecker.createSecureResponse(
        { error: 'User ID not found' },
        401
      );
    }

    // Video production requires the Business tier. Central entitlement
    // resolves from plan AND status (fails closed for unpaid/past-due) and
    // denies every tier below Business (previously starter slipped through —
    // only free + professional were rejected).
    const entitlement = await requireEntitlement(userId, 'video_production');
    if (!entitlement.allowed) {
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error: 'Video production requires a Business subscription',
          upgradeRequired: true,
          requiredPlan: 'business',
        },
        402
      );
    }

    // Parse request
    const body = await request.json();
    const validationResult = ProduceRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error: 'Invalid request',
          details: validationResult.error.issues,
        },
        400
      );
    }

    const { workflow, skipUpload } = validationResult.data;
    const workflowInfo = WORKFLOW_INFO[workflow];

    if (!workflowInfo) {
      return APISecurityChecker.createSecureResponse(
        { success: false, error: 'Unknown workflow' },
        400
      );
    }

    const orchestrator = new VideoOrchestrator();

    const readiness = await orchestrator.checkReadiness();
    if (!readiness.ready && !skipUpload) {
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error: 'Video production system is not fully configured',
          readinessIssues: readiness.issues,
        },
        503
      );
    }

    // Enqueue production — capture/process/upload runs on the job queue (AT-032).
    const job = await queueWorkflowProduction({
      userId,
      workflow,
      skipUpload,
    });

    return APISecurityChecker.createSecureResponse(
      {
        success: true,
        jobId: job.id,
        status: job.status,
        message: 'Video production queued',
      },
      202
    );
  } catch (error) {
    logger.error('Video production API error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to start video production' },
      500
    );
  }
}
