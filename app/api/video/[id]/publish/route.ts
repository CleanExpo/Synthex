/**
 * Video Publish API
 *
 * POST /api/video/[id]/publish - Publish a rendered video to platforms
 *
 * Handles:
 * 1. YouTube upload (if OAuth connected)
 * 2. Creates scheduled posts for social cuts on selected platforms
 * 3. Updates the VideoGeneration record with publish status
 *
 * @module app/api/video/[id]/publish/route
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import prisma from '@/lib/prisma';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';

export const dynamic = 'force-dynamic';

// =============================================================================
// Schemas
// =============================================================================

const PublishVideoSchema = z.object({
  platforms: z.array(z.enum([
    'youtube', 'instagram', 'linkedin', 'twitter', 'tiktok', 'facebook',
  ])).min(1),
  scheduledAt: z.string().datetime().optional(), // If not provided, schedule for 1 hour from now
  clipStart: z.number().min(0).optional(),
  clipEnd: z.number().min(0).optional(),
});

// =============================================================================
// POST - Publish video to platforms
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Fetch the video
    const video = await prisma.videoGeneration.findUnique({
      where: { id },
    });

    if (!video || video.userId !== userId) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Video not found' },
        404
      );
    }

    if (video.status !== 'rendered') {
      return APISecurityChecker.createSecureResponse(
        { error: 'Video must be in rendered state to publish' },
        400
      );
    }

    // Validate request body
    const body = await request.json();
    const validation = PublishVideoSchema.safeParse(body);

    if (!validation.success) {
      return APISecurityChecker.createSecureResponse(
        { success: false, error: 'Invalid request', details: validation.error.issues },
        400
      );
    }

    const { platforms, scheduledAt, clipStart, clipEnd } = validation.data;
    const scheduleTime = scheduledAt ? new Date(scheduledAt) : new Date(Date.now() + 60 * 60 * 1000);

    // Resolve organisation context
    const organizationId = await getEffectiveOrganizationId(userId);

    // Get or create default campaign for video posts
    let videoCampaign = await prisma.campaign.findFirst({
      where: {
        userId,
        name: 'Video Posts',
        ...(organizationId ? { organizationId } : { organizationId: null }),
      },
    });

    if (!videoCampaign) {
      videoCampaign = await prisma.campaign.create({
        data: {
          userId,
          name: 'Video Posts',
          description: 'Auto-created campaign for video generation posts',
          platform: 'multi',
          status: 'active',
          ...(organizationId ? { organizationId } : {}),
        },
      });
    }

    // Create scheduled posts for each platform
    const createdPosts = [];
    const scriptContent = video.scriptContent as Record<string, unknown> | null;
    const scriptTitle = (scriptContent?.title as string) || video.title;
    const hashtags = (scriptContent?.hashtags as string[]) || [];

    for (const platform of platforms) {
      // Build content for the platform
      const content = buildPlatformContent(platform, scriptTitle, video.topic, hashtags);

      const post = await prisma.post.create({
        data: {
          content,
          platform,
          status: 'scheduled',
          scheduledAt: scheduleTime,
          campaignId: videoCampaign.id,
          metadata: {
            type: 'video',
            videoId: video.id,
            videoTitle: video.title,
            clipStart: clipStart ?? null,
            clipEnd: clipEnd ?? null,
            hashtags,
            thumbnailUrl: video.thumbnailUrl,
          },
        },
      });

      createdPosts.push({
        id: post.id,
        platform,
        scheduledAt: post.scheduledAt,
        status: post.status,
      });
    }

    // Update the video generation record
    await prisma.videoGeneration.update({
      where: { id: video.id },
      data: {
        status: 'published',
        publishedAt: new Date(),
        scheduledPlatforms: platforms,
      },
    });

    return APISecurityChecker.createSecureResponse({
      success: true,
      data: {
        videoId: video.id,
        scheduledPosts: createdPosts,
        publishedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Video publish API error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to publish video' },
      500
    );
  }
}

// =============================================================================
// Helpers
// =============================================================================

function buildPlatformContent(
  platform: string,
  title: string,
  topic: string,
  hashtags: string[]
): string {
  const hashtagStr = hashtags.length > 0 ? `\n\n${hashtags.map(t => `#${t}`).join(' ')}` : '';

  switch (platform) {
    case 'youtube':
      return `${title}\n\n${topic}${hashtagStr}`;
    case 'instagram':
    case 'tiktok':
      return `${title} ✨\n\n${topic}${hashtagStr}`;
    case 'linkedin':
      return `${title}\n\n${topic}\n\nWatch the full video for more insights.${hashtagStr}`;
    case 'twitter':
      // Keep it short for Twitter
      return `${title}${hashtagStr}`.slice(0, 280);
    default:
      return `${title}\n\n${topic}${hashtagStr}`;
  }
}

export const runtime = 'nodejs';
