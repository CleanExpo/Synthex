/**
 * ENVIRONMENT VARIABLES REQUIRED:
 * - TWITTER_API_KEY: Twitter API key (SECRET)
 * - TWITTER_API_SECRET: Twitter API secret (SECRET)
 * - TWITTER_ACCESS_TOKEN: Twitter access token (SECRET)
 * - TWITTER_ACCESS_SECRET: Twitter access token secret (SECRET)
 * - JWT_SECRET: For verifying user authentication (CRITICAL)
 *
 * FAILURE MODE: Returns error response if missing
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { twitterService } from '@/lib/social/twitter-service';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import { writeDefault } from '@/lib/rate-limit';
import { scheduleViaPost } from '@/lib/social/schedule-via-post';
import {
  notProvisionedResponse,
  NOT_PROVISIONED_STATUS,
} from '@/lib/api/not-provisioned';

const twitterPostSchema = z.object({
  text: z.string().optional(),
  thread: z.array(z.string()).optional(),
  mediaUrls: z.array(z.string()).optional(),
  scheduledTime: z.string().optional(),
});

// Immediate tweets go out via the shared app-level account and used to be
// logged to a Supabase `social_posts` table (plus `usage_tracking`) that has no
// Prisma model. Without a per-user record the route cannot publish honestly, so
// it reports the gap instead of posting and silently dropping the record.
const NOT_PROVISIONED_REASON =
  'Direct X/Twitter post history is not provisioned (social_posts table missing). Use /api/social/post to publish from your connected account.';

export async function POST(request: NextRequest) {
  return writeDefault(request, async () => {
    try {
      // Security check
      const security = await APISecurityChecker.check(
        request,
        DEFAULT_POLICIES.AUTHENTICATED_WRITE
      );

      if (!security.allowed) {
        return APISecurityChecker.createSecureResponse(
          { error: security.error },
          403
        );
      }

      // Get user from token
      const userId = await getUserIdFromRequestOrCookies(request);
      if (!userId) return unauthorizedResponse();

      // Legacy direct-publish kill-switch. This route posts via a single
      // static app-level X account (twitterService singleton) for ALL users —
      // a cross-tenant hazard. Disabled by default; the correct per-user path
      // is /api/social/post -> createPlatformService('twitter'), which uses the
      // caller's own OAuth2 token. Mirrors the facebook/instagram/linkedin gates.
      if (process.env.SYNTHEX_ENABLE_LEGACY_DIRECT_SOCIAL_POSTS !== 'true') {
        return NextResponse.json(
          {
            error: 'Direct X/Twitter publishing route disabled',
            message:
              'Use /api/social/post so Synthex posts as the connected user’s own account (organization-scoped), not a shared app account.',
          },
          { status: 409 }
        );
      }

      // Get and validate request body
      const rawBody = await request.json();
      const validation = twitterPostSchema.safeParse(rawBody);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Invalid request data', details: validation.error.issues },
          { status: 400 }
        );
      }
      const { text, thread, mediaUrls, scheduledTime } = validation.data;

      if (!text && !thread?.length) {
        return NextResponse.json(
          { error: 'Tweet text or thread is required' },
          { status: 400 }
        );
      }

      if (!scheduledTime) {
        return notProvisionedResponse(NOT_PROVISIONED_REASON);
      }

      // Handle media uploads if provided
      const mediaIds: string[] = [];
      const mediaFailed: string[] = [];
      if (mediaUrls && mediaUrls.length > 0) {
        for (const url of mediaUrls) {
          try {
            const mediaId = await twitterService.uploadMedia(url);
            mediaIds.push(mediaId);
          } catch (error) {
            logger.error('Media upload failed:', error);
            mediaFailed.push(url);
          }
        }
      }

      // A post scheduled without its media is not the post that was asked for.
      if (mediaFailed.length > 0) {
        return NextResponse.json(
          {
            error: 'Media upload failed',
            message: 'The post was not scheduled because some media failed.',
            scheduled: false,
            mediaFailed,
          },
          { status: 502 }
        );
      }

      // Route through the WORKING scheduler (Post + cron). The previous path
      // inserted into the `scheduled_posts` table drained by a BullMQ worker
      // that is never booted, so scheduled tweets were silently lost (P1).
      const scheduled = await scheduleViaPost({
        userId,
        platform: 'twitter',
        content: text || thread!.join('\n\n'),
        scheduledTime: new Date(scheduledTime),
        metadata: { mediaIds },
      });

      return NextResponse.json({
        success: true,
        scheduled: true,
        data: {
          id: scheduled.id,
          scheduledTime: scheduled.scheduledAt,
          status: scheduled.status,
        },
      });
    } catch (error: unknown) {
      logger.error('Twitter post error:', error);
      return NextResponse.json(
        {
          error: 'Failed to post to Twitter',
          message: 'An unexpected error occurred. Please try again.',
        },
        { status: 500 }
      );
    }
  });
}

// Get user's Twitter posts
export async function GET(request: NextRequest) {
  try {
    // Security check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_READ
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        403
      );
    }

    // Get user from token
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) return unauthorizedResponse();

    return NextResponse.json(
      {
        available: false,
        error: 'FEATURE_NOT_PROVISIONED',
        reason: NOT_PROVISIONED_REASON,
      },
      { status: NOT_PROVISIONED_STATUS }
    );
  } catch (error) {
    logger.error('Get posts error:', error);
    return NextResponse.json(
      { error: 'Failed to get Twitter posts' },
      { status: 500 }
    );
  }
}
