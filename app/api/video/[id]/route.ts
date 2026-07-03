/**
 * Video Generation Detail API
 *
 * GET /api/video/[id] - Get a specific video generation record
 *
 * @module app/api/video/[id]/route
 */

import { NextRequest } from 'next/server';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// =============================================================================
// GET - Fetch video generation by ID
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const video = await prisma.videoGeneration.findUnique({
      where: { id },
    });

    if (!video || video.userId !== userId) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Video not found' },
        404
      );
    }

    // Lazy poll-through: generative job past expected latency with no webhook yet.
    const EXPECTED_LATENCY_MS = 5 * 60 * 1000;
    let providerStatus: unknown = undefined;
    if (
      video.mode === 'generative' &&
      video.status === 'generating' &&
      video.providerJobId &&
      video.model &&
      Date.now() - new Date(video.updatedAt).getTime() > EXPECTED_LATENCY_MS
    ) {
      try {
        const { getFalStatus } =
          await import('@/lib/services/ai/video/fal-adapter');
        providerStatus = await getFalStatus(video.model, video.providerJobId);
      } catch {
        // best-effort; never fail the GET over a poll
      }
    }

    return APISecurityChecker.createSecureResponse({
      success: true,
      data: {
        id: video.id,
        title: video.title,
        topic: video.topic,
        style: video.style,
        duration: video.duration,
        status: video.status,
        errorMessage: video.errorMessage,
        scriptContent: video.scriptContent,
        videoUrl: video.videoUrl,
        thumbnailUrl: video.thumbnailUrl,
        youtubeVideoId: video.youtubeVideoId,
        scheduledPlatforms: video.scheduledPlatforms,
        publishedAt: video.publishedAt,
        metadata: video.metadata,
        createdAt: video.createdAt,
        updatedAt: video.updatedAt,
        ...(providerStatus !== undefined ? { providerStatus } : {}),
      },
    });
  } catch (error) {
    logger.error('Video detail API error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch video details' },
      500
    );
  }
}

export const runtime = 'nodejs';
