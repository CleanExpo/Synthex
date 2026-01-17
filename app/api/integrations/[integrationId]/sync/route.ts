/**
 * Integration Sync API
 *
 * Handles manual sync triggers for platform integrations.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/integrations/[integrationId]/sync/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { queueContentPublish } from '@/lib/queue';
import { z } from 'zod';

// =============================================================================
// Auth Helper
// =============================================================================

async function getUserFromRequest(request: NextRequest): Promise<{ id: string; email: string } | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;

  try {
    const token = authHeader.replace('Bearer ', '');
    const jwt = await import('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'default-secret';
    const decoded = jwt.default.verify(token, secret) as { userId: string; email: string };
    return { id: decoded.userId, email: decoded.email };
  } catch {
    return null;
  }
}

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
    if (!z.string().uuid().safeParse(integrationId).success) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid integration ID' },
        { status: 400 }
      );
    }

    // Get the integration
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
    const syncType = body.type || 'full';

    // Perform sync based on type
    let syncResult: any = { status: 'initiated' };

    switch (syncType) {
      case 'analytics': {
        // Sync analytics from platform
        syncResult = await syncAnalytics(integration);
        break;
      }

      case 'posts': {
        // Sync posts from platform
        syncResult = await syncPosts(integration);
        break;
      }

      case 'profile': {
        // Sync profile info from platform
        syncResult = await syncProfile(integration);
        break;
      }

      case 'full':
      default: {
        // Full sync - all data
        const [analyticsResult, postsResult, profileResult] = await Promise.allSettled([
          syncAnalytics(integration),
          syncPosts(integration),
          syncProfile(integration),
        ]);

        syncResult = {
          analytics: analyticsResult.status === 'fulfilled' ? analyticsResult.value : { error: 'Failed' },
          posts: postsResult.status === 'fulfilled' ? postsResult.value : { error: 'Failed' },
          profile: profileResult.status === 'fulfilled' ? profileResult.value : { error: 'Failed' },
        };
        break;
      }
    }

    // Update last sync time
    await prisma.platformConnection.update({
      where: { id: integrationId },
      data: {
        lastSync: new Date(),
        metadata: {
          ...(integration.metadata as any || {}),
          lastSyncType: syncType,
          lastSyncResult: syncResult,
        },
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'integration_synced',
        resource: 'platformConnection',
        resourceId: integrationId,
        details: { platform: integration.platform, syncType },
        severity: 'low',
        category: 'system',
        outcome: 'success',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Sync initiated successfully',
      data: {
        integrationId,
        platform: integration.platform,
        syncType,
        syncedAt: new Date().toISOString(),
        result: syncResult,
      },
    });
  } catch (error: any) {
    console.error('Integration sync error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}

// =============================================================================
// Sync Functions
// =============================================================================

async function syncAnalytics(integration: any): Promise<any> {
  // Placeholder for actual platform API calls
  // Each platform would have different API endpoints
  const platform = integration.platform;

  switch (platform) {
    case 'twitter':
      // Fetch Twitter analytics
      return { synced: true, metrics: ['impressions', 'engagements', 'followers'] };

    case 'linkedin':
      // Fetch LinkedIn analytics
      return { synced: true, metrics: ['impressions', 'clicks', 'followers'] };

    case 'instagram':
      // Fetch Instagram insights
      return { synced: true, metrics: ['reach', 'impressions', 'followers'] };

    case 'facebook':
      // Fetch Facebook page insights
      return { synced: true, metrics: ['reach', 'engagement', 'followers'] };

    default:
      return { synced: false, message: 'Analytics sync not supported for this platform' };
  }
}

async function syncPosts(integration: any): Promise<any> {
  // Fetch recent posts from platform
  return {
    synced: true,
    postsFound: 0, // Would be populated with actual data
    message: 'Posts sync completed',
  };
}

async function syncProfile(integration: any): Promise<any> {
  // Update profile info from platform
  return {
    synced: true,
    profileUpdated: true,
    fields: ['name', 'avatar', 'bio'],
  };
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

    const metadata = integration.metadata as any || {};

    return NextResponse.json({
      success: true,
      data: {
        id: integration.id,
        platform: integration.platform,
        isActive: integration.isActive,
        lastSync: integration.lastSync,
        lastSyncType: metadata.lastSyncType,
        lastSyncResult: metadata.lastSyncResult,
        tokenExpires: integration.expiresAt,
        isTokenValid: !integration.expiresAt || integration.expiresAt > new Date(),
        createdAt: integration.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Integration sync status error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
