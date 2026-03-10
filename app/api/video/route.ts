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
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { subscriptionService, PLAN_LIMITS } from '@/lib/stripe/subscription-service';
import { logger } from '@/lib/logger';

// Available workflow names (mirrors SYNTHEX_WORKFLOWS keys)
const WORKFLOW_NAMES = [
  'platformOverview',
  'contentGenerator',
  'analyticsDashboard',
  'smartScheduler',
  'viralPatterns',
] as const;

const WORKFLOW_INFO: Record<string, { name: string; description: string; duration: number }> = {
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

    // Check subscription
    const subscription = await subscriptionService.getOrCreateSubscription(userId);
    if (subscription.plan === 'free') {
      return APISecurityChecker.createSecureResponse(
        {
          success: false,
          error: 'Video production requires a paid subscription',
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

    if (!process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_CLIENT_SECRET || !process.env.YOUTUBE_REFRESH_TOKEN) {
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

    // Check subscription - video production requires business plan
    const subscription = await subscriptionService.getOrCreateSubscription(userId);
    if (subscription.plan === 'free' || subscription.plan === 'professional') {
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
          details: validationResult.error.errors,
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

    // Dynamically import orchestrator to avoid loading heavy deps on every request
    const { VideoOrchestrator } = await import('@/lib/video/video-orchestrator');
    const orchestrator = new VideoOrchestrator();

    // Check system readiness
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

    // Start production (this is a long-running operation)
    // In production, this would be queued via a job system
    const result = await orchestrator.produceVideo(workflow, {
      skipUpload,
    });

    return APISecurityChecker.createSecureResponse({
      success: result.success,
      production: {
        workflowName: result.workflowName,
        rawVideoPath: result.rawVideoPath,
        processedVideoPath: result.processedVideoPath,
        thumbnailPath: result.thumbnailPath,
        youtubeResult: result.youtubeResult || null,
        error: result.error || null,
      },
    });
  } catch (error) {
    logger.error('Video production API error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to start video production' },
      500
    );
  }
}
