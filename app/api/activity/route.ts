/**
 * Activity Feed API Route
 *
 * @description Returns recent activity for the authenticated user:
 * - Posts created/published/scheduled
 * - Engagement events
 * - Follower changes
 * - Campaign activities
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: Token signing key (CRITICAL)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';

// ============================================================================
// TYPES
// ============================================================================

interface ActivityItem {
  id: string;
  type: 'post' | 'engagement' | 'follower' | 'campaign' | 'comment';
  title: string;
  description: string;
  timestamp: string;
  platform?: string;
  metadata?: Record<string, unknown>;
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

      let type: ActivityItem['type'] = 'post';
      let title = 'Draft created';
      let description = `Created a draft for ${post.platform}`;

      if (post.status === 'published') {
        if (hasEngagement && (analytics?.likes || 0) > 10) {
          type = 'engagement';
          title = 'Post performing well';
          description = `Your ${post.platform} post got ${analytics?.likes || 0} likes`;
        } else {
          title = 'Post published';
          description = `Published to ${post.platform}`;
        }
      } else if (post.status === 'scheduled') {
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
        metadata: {
          postId: post.id,
          campaignName: post.campaign?.name,
          analytics,
        },
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

    return NextResponse.json(allActivities);
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

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
