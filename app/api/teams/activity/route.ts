/**
 * Team Activity Feed API
 *
 * @description API endpoint for team activity feed:
 * - GET: Fetch recent team activity from audit logs
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: For validating auth tokens (CRITICAL)
 *
 * FAILURE MODE: Returns error responses on failure
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { ResponseOptimizer } from '@/lib/api/response-optimizer';
import { logger } from '@/lib/logger';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';

// Action type to human-readable description mapping
const actionDescriptions: Record<string, { action: string; icon: string }> = {
  'campaign.created': { action: 'created a new campaign', icon: 'plus-circle' },
  'campaign.updated': { action: 'updated campaign', icon: 'edit' },
  'campaign.deleted': { action: 'deleted campaign', icon: 'trash' },
  'campaign.published': { action: 'published campaign', icon: 'send' },
  'post.created': { action: 'created new content', icon: 'file-plus' },
  'post.published': { action: 'published content to', icon: 'share' },
  'post.scheduled': { action: 'scheduled content for', icon: 'calendar' },
  'ai.content_generated': { action: 'generated AI content for', icon: 'sparkles' },
  'teams.member_added': { action: 'added new team member', icon: 'user-plus' },
  'teams.member_removed': { action: 'removed team member', icon: 'user-minus' },
  'teams.role_changed': { action: 'changed role for', icon: 'shield' },
  'teams.invitation_sent': { action: 'sent invitation to', icon: 'mail' },
  'analytics.report_generated': { action: 'generated analytics report', icon: 'bar-chart' },
  'analytics.export': { action: 'exported analytics data', icon: 'download' },
};

// ============================================================================
// GET - Team Activity Feed
// ============================================================================

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

    // Get requesting user ID
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get requesting user's organization
    const requestingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    if (!requestingUser?.organizationId) {
      return NextResponse.json(
        { error: 'You must belong to an organization' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = (page - 1) * limit;
    const category = searchParams.get('category'); // 'campaign', 'post', 'ai', 'teams', 'analytics'

    // Get all users in the organization for user lookup
    const orgMembers = await prisma.user.findMany({
      where: { organizationId: requestingUser.organizationId },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
      },
    });

    const memberMap = new Map(orgMembers.map((m) => [m.id, m]));
    const memberIds = orgMembers.map((m) => m.id);

    // Build where clause for audit logs
    const whereClause: {
      userId: { in: string[] };
      category?: string;
    } = {
      userId: { in: memberIds },
    };

    if (category) {
      whereClause.category = category;
    }

    // Get total count
    const total = await prisma.auditLog.count({ where: whereClause });

    // Fetch audit logs for organization members
    const auditLogs = await prisma.auditLog.findMany({
      where: whereClause,
      select: {
        id: true,
        userId: true,
        action: true,
        resource: true,
        resourceId: true,
        category: true,
        details: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });

    // Transform audit logs to activity feed format
    const activities = auditLogs.map((log) => {
      const member = log.userId ? memberMap.get(log.userId) : undefined;
      const actionInfo = actionDescriptions[log.action] || {
        action: log.action.replace(/\./g, ' ').replace(/_/g, ' '),
        icon: 'activity',
      };

      // Extract target from details if available
      const details = (log.details as Record<string, unknown>) || {};
      let target = details.name || details.email || details.campaignName || log.resourceId || '';

      // For platform-related actions
      if (log.action.includes('published') && details.platform) {
        target = details.platform;
      }

      return {
        id: log.id,
        memberId: log.userId,
        memberName: member?.name || member?.email?.split('@')[0] || 'Unknown User',
        memberAvatar: member?.avatar || null,
        action: actionInfo.action,
        icon: actionInfo.icon,
        target,
        category: log.category,
        timestamp: log.createdAt.toISOString(),
        details: details,
      };
    });

    return ResponseOptimizer.createResponse(
      {
        success: true,
        data: activities,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      { cacheType: 'api', cacheDuration: 30 }
    );
  } catch (error) {
    logger.error('Failed to fetch team activity', { error });
    return ResponseOptimizer.createErrorResponse('Failed to fetch team activity', 500);
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';
