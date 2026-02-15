/**
 * Activity Feed API Route
 *
 * @description Returns recent activity for the authenticated user:
 * - Posts created/published/scheduled
 * - Engagement events
 * - Follower changes
 * - Campaign activities
 * - Real-time updates
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';

// ============================================================================
// TYPES
// ============================================================================

const VALID_ACTIVITY_TYPES = [
  'post_created',
  'post_published',
  'post_scheduled',
  'post_edited',
  'post_deleted',
  'engagement_spike',
  'new_follower',
  'comment_received',
  'mention',
  'team_member_joined',
  'team_member_action',
  'system_alert',
  'campaign_started',
  'campaign_ended',
  'milestone_reached',
  // Legacy types for backward compatibility
  'post',
  'engagement',
  'follower',
  'campaign',
  'comment',
] as const;

type ActivityType = (typeof VALID_ACTIVITY_TYPES)[number];

interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: string;
  platform?: string;
  userId?: string;
  userName?: string;
  userAvatar?: string;
  metadata?: Record<string, unknown>;
  read?: boolean;
}

// ============================================================================
// GET /api/activity
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Security check
    const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_READ);

    // Get limit from query params
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build user filter if authenticated
    const userId = security.context.userId;
    const userFilter = userId ? { userId } : {};
    const campaignFilter = userId ? { campaign: { userId } } : {};

    // Fetch recent activities from multiple sources
    const [posts, auditLogs] = await Promise.all([
      // Recent posts
      prisma.post.findMany({
        where: campaignFilter,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          platform: true,
          status: true,
          content: true,
          analytics: true,
          createdAt: true,
          publishedAt: true,
          campaign: {
            select: { name: true },
          },
        },
      }),

      // Audit logs for user (if authenticated)
      userId
        ? prisma.auditLog.findMany({
            where: {
              userId,
              category: { in: ['data', 'auth'] },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
          })
        : Promise.resolve([]),
    ]);

    // Transform posts to activity items
    const postActivities: ActivityItem[] = posts.map((post) => {
      const analytics = post.analytics as Record<string, number> | null;
      const hasEngagement = analytics && (analytics.likes || analytics.comments || analytics.shares);

      let type: ActivityType = 'post_created';
      let title = 'Draft created';
      let description = `Created a draft for ${post.platform}`;

      if (post.status === 'published') {
        if (hasEngagement && (analytics?.likes || 0) > 10) {
          type = 'engagement_spike';
          title = 'Post performing well';
          description = `Your ${post.platform} post got ${analytics?.likes || 0} likes`;
        } else {
          type = 'post_published';
          title = 'Post published';
          description = `Published to ${post.platform}`;
        }
      } else if (post.status === 'scheduled') {
        type = 'post_scheduled';
        title = 'Post scheduled';
        description = `Scheduled for ${post.platform}`;
      }

      return {
        id: `post-${post.id}`,
        type,
        title,
        description,
        timestamp: (post.publishedAt || post.createdAt).toISOString(),
        platform: post.platform,
        userId,
        metadata: {
          postId: post.id,
          campaignName: post.campaign?.name,
          analytics,
        },
        read: false,
      };
    });

    // Transform audit logs to activity items
    const auditActivities: ActivityItem[] = auditLogs.map((log) => ({
      id: `audit-${log.id}`,
      type: log.action.includes('campaign') ? 'campaign' : 'post',
      title: formatAuditAction(log.action),
      description: `${log.resource} ${log.outcome}`,
      timestamp: log.createdAt.toISOString(),
      metadata: log.details as Record<string, unknown>,
    }));

    // Merge and sort all activities
    const allActivities = [...postActivities, ...auditActivities]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    // Filter by types if specified (exact match only)
    const typesParam = searchParams.get('types');
    const filteredActivities = typesParam
      ? allActivities.filter((a) => {
          const requestedTypes = typesParam.split(',').map(t => t.trim());
          return requestedTypes.includes(a.type);
        })
      : allActivities;

    return NextResponse.json({
      activities: filteredActivities,
      total: filteredActivities.length,
      hasMore: filteredActivities.length === limit,
    });
  } catch (error) {
    console.error('Activity feed error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity feed' },
      { status: 500 }
    );
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function formatAuditAction(action: string): string {
  const actionMap: Record<string, string> = {
    'data.create': 'Created',
    'data.update': 'Updated',
    'data.delete': 'Deleted',
    'data.read': 'Viewed',
    'auth.login': 'Logged in',
    'auth.logout': 'Logged out',
  };

  return actionMap[action] || action.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ============================================================================
// POST /api/activity
// Create a new activity entry
// ============================================================================

const createActivitySchema = z.object({
  type: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  platform: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  teamId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Security check - requires authenticated write
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_WRITE
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        401
      );
    }

    const body = await request.json();
    const validation = createActivitySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }
    const { type, title, description, platform, metadata, teamId } = validation.data;

    // Validate type
    if (!VALID_ACTIVITY_TYPES.includes(type as typeof VALID_ACTIVITY_TYPES[number])) {
      return NextResponse.json(
        { error: 'Invalid activity type' },
        { status: 400 }
      );
    }

    // Create activity entry in audit log
    const userId = security.context.userId || 'anonymous';

    const activity = await prisma.auditLog.create({
      data: {
        userId,
        action: `activity.${type}`,
        resource: 'activity',
        resourceId: `activity-${Date.now()}`,
        outcome: 'success',
        category: 'data',
        details: {
          type,
          title,
          description,
          platform,
          teamId,
          ...metadata,
        },
      },
    });

    const activityItem: ActivityItem = {
      id: `activity-${activity.id}`,
      type: type as ActivityType,
      title,
      description,
      timestamp: activity.createdAt.toISOString(),
      platform,
      userId,
      metadata,
      read: false,
    };

    return NextResponse.json({
      activity: activityItem,
      success: true,
    });
  } catch (error) {
    console.error('Activity create error:', error);
    return NextResponse.json(
      { error: 'Failed to create activity' },
      { status: 500 }
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
