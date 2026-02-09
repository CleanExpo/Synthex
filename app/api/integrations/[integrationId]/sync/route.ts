/**
 * Integration Sync API
 *
 * Handles manual sync triggers for platform integrations.
 * Real platform API integration for Twitter, LinkedIn, and Instagram.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 * - Platform-specific credentials (see lib/social/*)
 *
 * @module app/api/integrations/[integrationId]/sync/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { auditLogger } from '@/lib/security/audit-logger';
import {
  createPlatformService,
  isPlatformSupported,
  PLATFORM_INFO,
  PlatformCredentials,
  SyncAnalyticsResult,
  SyncPostsResult,
  SyncProfileResult,
} from '@/lib/social';

// =============================================================================
// Auth Helper - Uses centralized JWT utilities (no fallback secrets)
// =============================================================================

import { verifyToken } from '@/lib/auth/jwt-utils';

async function getUserFromRequest(request: NextRequest): Promise<{ id: string; email: string } | null> {
  const authHeader = request.headers.get('authorization');
  const cookieToken = request.cookies.get('auth-token')?.value;
  const token = authHeader?.replace('Bearer ', '') || cookieToken;

  if (!token) return null;

  try {
    const decoded = verifyToken(token);
    return { id: decoded.userId, email: decoded.email || '' };
  } catch {
    return null;
  }
}

// =============================================================================
// Validation Schemas
// =============================================================================

const SyncRequestSchema = z.object({
  type: z.enum(['full', 'analytics', 'posts', 'profile']).default('full'),
  days: z.number().int().min(1).max(365).default(30),
  limit: z.number().int().min(1).max(100).default(50),
});

// =============================================================================
// POST - Trigger Manual Sync
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { integrationId: string } }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { integrationId } = params;

    // Validate ID
    if (!z.string().cuid().or(z.string().uuid()).safeParse(integrationId).success) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid integration ID' },
        { status: 400 }
      );
    }

    // Get the integration with credentials
    const integration = await prisma.platformConnection.findFirst({
      where: {
        id: integrationId,
        userId: user.id,
      },
    });

    if (!integration) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Integration not found' },
        { status: 404 }
      );
    }

    if (!integration.isActive) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Integration is not active' },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (integration.expiresAt && integration.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Integration token has expired. Please reconnect.' },
        { status: 400 }
      );
    }

    // Parse request body for sync options
    const body = await request.json().catch(() => ({}));
    const parseResult = SyncRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { type: syncType, days, limit } = parseResult.data;
    const platform = integration.platform.toLowerCase();

    // Check if platform is supported
    if (!isPlatformSupported(platform)) {
      return NextResponse.json(
        {
          error: 'Unsupported Platform',
          message: `Sync is not yet supported for ${platform}`,
          supportedPlatforms: Object.entries(PLATFORM_INFO)
            .filter(([, info]) => info.syncSupported)
            .map(([p, info]) => ({ platform: p, name: info.name })),
        },
        { status: 400 }
      );
    }

    // Build credentials from integration data
    const credentials: PlatformCredentials = {
      accessToken: integration.accessToken,
      refreshToken: integration.refreshToken || undefined,
      expiresAt: integration.expiresAt || undefined,
      platformUserId: integration.profileId || undefined,
      platformUsername: integration.profileName || undefined,
      scopes: integration.scope ? integration.scope.split(',') : undefined,
    };

    // Create platform service
    const platformService = createPlatformService(platform, credentials);

    if (!platformService) {
      return NextResponse.json(
        { error: 'Service Error', message: `Failed to initialize ${platform} service` },
        { status: 500 }
      );
    }

    // Validate credentials before sync
    const credentialsValid = await platformService.validateCredentials();
    if (!credentialsValid) {
      // Try to refresh token if available
      if (platformService.refreshToken) {
        try {
          const newCredentials = await platformService.refreshToken();

          // Update stored credentials
          await prisma.platformConnection.update({
            where: { id: integrationId },
            data: {
              accessToken: newCredentials.accessToken,
              refreshToken: newCredentials.refreshToken,
              expiresAt: newCredentials.expiresAt,
            },
          });

          // Re-initialize with new credentials
          platformService.initialize(newCredentials);
        } catch (refreshError) {
          logger.error('Token refresh failed', { error: refreshError, integrationId });
          return NextResponse.json(
            { error: 'Authentication Error', message: 'Token refresh failed. Please reconnect.' },
            { status: 401 }
          );
        }
      } else {
        return NextResponse.json(
          { error: 'Authentication Error', message: 'Invalid credentials. Please reconnect.' },
          { status: 401 }
        );
      }
    }

    // Perform sync based on type
    let syncResult: {
      analytics?: SyncAnalyticsResult;
      posts?: SyncPostsResult;
      profile?: SyncProfileResult;
    } = {};

    const startTime = Date.now();

    switch (syncType) {
      case 'analytics': {
        syncResult.analytics = await platformService.syncAnalytics(days);
        break;
      }

      case 'posts': {
        syncResult.posts = await platformService.syncPosts(limit);
        break;
      }

      case 'profile': {
        syncResult.profile = await platformService.syncProfile();
        break;
      }

      case 'full':
      default: {
        // Full sync - all data in parallel
        const [analyticsResult, postsResult, profileResult] = await Promise.all([
          platformService.syncAnalytics(days),
          platformService.syncPosts(limit),
          platformService.syncProfile(),
        ]);

        syncResult = {
          analytics: analyticsResult,
          posts: postsResult,
          profile: profileResult,
        };
        break;
      }
    }

    const syncDuration = Date.now() - startTime;

    // Store synced data in database
    await storeSyncResults(integrationId, syncResult);

    // Update last sync time and metadata
    const existingMetadata = (integration.metadata as Record<string, unknown>) || {};
    await prisma.platformConnection.update({
      where: { id: integrationId },
      data: {
        lastSync: new Date(),
        metadata: {
          ...existingMetadata,
          lastSyncType: syncType,
          lastSyncDuration: syncDuration,
          lastSyncSuccess: Object.values(syncResult).every(r => r?.success !== false),
          lastSyncMetrics: syncResult.analytics?.success ? syncResult.analytics.metrics : undefined,
        },
      },
    });

    // Audit log
    await auditLogger.log({
      userId: user.id,
      action: 'integration.synced',
      resource: 'platformConnection',
      resourceId: integrationId,
      category: 'api',
      severity: 'low',
      outcome: 'success',
      details: {
        platform,
        syncType,
        syncDuration,
        analyticsSuccess: syncResult.analytics?.success,
        postsCount: syncResult.posts?.posts?.length,
        profileSuccess: syncResult.profile?.success,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Sync completed successfully',
      data: {
        integrationId,
        platform,
        platformName: PLATFORM_INFO[platform]?.name || platform,
        syncType,
        syncedAt: new Date().toISOString(),
        duration: syncDuration,
        result: {
          analytics: syncResult.analytics ? {
            success: syncResult.analytics.success,
            metrics: syncResult.analytics.success ? syncResult.analytics.metrics : undefined,
            period: syncResult.analytics.period,
            error: syncResult.analytics.error,
          } : undefined,
          posts: syncResult.posts ? {
            success: syncResult.posts.success,
            count: syncResult.posts.posts.length,
            total: syncResult.posts.total,
            hasMore: syncResult.posts.hasMore,
            error: syncResult.posts.error,
          } : undefined,
          profile: syncResult.profile ? {
            success: syncResult.profile.success,
            profile: syncResult.profile.success ? {
              username: syncResult.profile.profile.username,
              displayName: syncResult.profile.profile.displayName,
              followers: syncResult.profile.profile.followers,
            } : undefined,
            error: syncResult.profile.error,
          } : undefined,
        },
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Integration sync error:', { error });
    return NextResponse.json(
      { error: 'Internal Server Error', message: errorMessage },
      { status: 500 }
    );
  }
}

// =============================================================================
// Store Sync Results
// =============================================================================

async function storeSyncResults(
  integrationId: string,
  results: {
    analytics?: SyncAnalyticsResult;
    posts?: SyncPostsResult;
    profile?: SyncProfileResult;
  }
): Promise<void> {
  try {
    // Store synced posts as PlatformPost
    if (results.posts?.success && results.posts.posts.length > 0) {
      for (const post of results.posts.posts) {
        // Check if post already exists
        const existing = await prisma.platformPost.findFirst({
          where: {
            connectionId: integrationId,
            platformId: post.platformId,
          },
        });

        if (existing) {
          // Update existing post
          await prisma.platformPost.update({
            where: { id: existing.id },
            data: {
              content: post.content,
              mediaUrls: post.mediaUrls || [],
              publishedAt: post.publishedAt,
              // Store metrics in metadata as backup
              metadata: {
                lastSyncedMetrics: post.metrics,
                lastSyncedAt: new Date().toISOString(),
              },
            },
          });

          // Upsert metrics record
          if (post.metrics) {
            await prisma.platformMetrics.upsert({
              where: {
                id: `${existing.id}_latest`, // Use convention for latest metrics
              },
              create: {
                id: `${existing.id}_latest`,
                postId: existing.id,
                likes: post.metrics.likes || 0,
                comments: post.metrics.comments || 0,
                shares: post.metrics.shares || 0,
                impressions: post.metrics.impressions || 0,
                reach: post.metrics.reach || 0,
                recordedAt: new Date(),
              },
              update: {
                likes: post.metrics.likes || 0,
                comments: post.metrics.comments || 0,
                shares: post.metrics.shares || 0,
                impressions: post.metrics.impressions || 0,
                reach: post.metrics.reach || 0,
                recordedAt: new Date(),
              },
            });
          }
        } else {
          // Create new post with metrics
          const newPost = await prisma.platformPost.create({
            data: {
              connectionId: integrationId,
              platformId: post.platformId,
              content: post.content,
              mediaUrls: post.mediaUrls || [],
              hashtags: [], // Would extract from content
              status: 'published',
              publishedAt: post.publishedAt,
              metadata: {
                lastSyncedMetrics: post.metrics,
                lastSyncedAt: new Date().toISOString(),
              },
            },
          });

          // Create metrics record for new post
          if (post.metrics) {
            await prisma.platformMetrics.create({
              data: {
                id: `${newPost.id}_latest`,
                postId: newPost.id,
                likes: post.metrics.likes || 0,
                comments: post.metrics.comments || 0,
                shares: post.metrics.shares || 0,
                impressions: post.metrics.impressions || 0,
                reach: post.metrics.reach || 0,
                recordedAt: new Date(),
              },
            });
          }
        }
      }
    }

    // Update profile information
    if (results.profile?.success && results.profile.profile) {
      const profile = results.profile.profile;

      await prisma.platformConnection.update({
        where: { id: integrationId },
        data: {
          profileId: profile.id,
          profileName: profile.username,
          metadata: {
            displayName: profile.displayName,
            bio: profile.bio,
            avatarUrl: profile.avatarUrl,
            coverUrl: profile.coverUrl,
            followers: profile.followers,
            following: profile.following,
            postsCount: profile.postsCount,
            verified: profile.verified,
            profileUrl: profile.url,
            lastProfileSync: new Date().toISOString(),
          },
        },
      });
    }
  } catch (error) {
    logger.error('Failed to store sync results', { error, integrationId });
    // Don't throw - sync was successful even if storage fails
  }
}

// =============================================================================
// GET - Get Sync Status
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { integrationId: string } }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { integrationId } = params;

    const integration = await prisma.platformConnection.findFirst({
      where: {
        id: integrationId,
        userId: user.id,
      },
      select: {
        id: true,
        platform: true,
        isActive: true,
        lastSync: true,
        expiresAt: true,
        metadata: true,
        profileId: true,
        profileName: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!integration) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Integration not found' },
        { status: 404 }
      );
    }

    const metadata = (integration.metadata as Record<string, unknown>) || {};
    const platform = integration.platform.toLowerCase();

    // Get recent posts count
    const recentPostsCount = await prisma.platformPost.count({
      where: {
        connectionId: integrationId,
        publishedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: integration.id,
        platform: integration.platform,
        platformName: PLATFORM_INFO[platform as keyof typeof PLATFORM_INFO]?.name || platform,
        username: integration.profileName,
        profileId: integration.profileId,
        isActive: integration.isActive,
        lastSync: integration.lastSync,
        lastSyncType: metadata.lastSyncType,
        lastSyncDuration: metadata.lastSyncDuration,
        lastSyncSuccess: metadata.lastSyncSuccess,
        tokenExpires: integration.expiresAt,
        isTokenValid: !integration.expiresAt || integration.expiresAt > new Date(),
        syncSupported: isPlatformSupported(platform) && PLATFORM_INFO[platform as keyof typeof PLATFORM_INFO]?.syncSupported,
        profile: {
          displayName: metadata.displayName,
          avatarUrl: metadata.avatarUrl,
          followers: metadata.followers,
          following: metadata.following,
          postsCount: metadata.postsCount,
          verified: metadata.verified,
        },
        metrics: metadata.lastSyncMetrics,
        recentPostsCount,
        createdAt: integration.createdAt,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Integration sync status error:', { error });
    return NextResponse.json(
      { error: 'Internal Server Error', message: errorMessage },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
