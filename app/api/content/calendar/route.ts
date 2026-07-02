/**
 * Content Calendar API
 *
 * @description API endpoints for content calendar management:
 * - GET: Get calendar view for date range
 * - POST: Schedule a new post
 * - PATCH: Reschedule existing post (drag-and-drop)
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: For authentication (CRITICAL)
 *
 * SECURITY: All endpoints require authentication and organization membership
 *
 * FAILURE MODE: Returns cached data on failure
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ResponseOptimizer } from '@/lib/api/response-optimizer';
import { logger } from '@/lib/logger';
import {
  CalendarService,
  type ScheduleOptions,
} from '@/lib/content/calendar-service';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { prisma } from '@/lib/prisma';

// =============================================================================
// Auth Helpers - Verify user and organization membership
// =============================================================================

/**
 * Check if user is a member of the organization
 */
async function isOrgMember(userId: string, orgId: string): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      organizationId: orgId,
    },
  });
  return !!user;
}

/**
 * Resolve the organisation's stored IANA timezone so optimal-time suggestions
 * are computed in the team's real wall-clock zone (PR #416 made CalendarService
 * timezone-aware via its constructor; without this the stored
 * `Organization.timezone` was never threaded in and every org fell back to the
 * `Australia/Sydney` default). Falls back to undefined — which lets
 * CalendarService apply its own `Australia/Sydney` default — when the org has
 * no stored timezone or the lookup fails.
 */
async function getOrgTimezone(orgId: string): Promise<string | undefined> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { timezone: true },
    });
    return org?.timezone ?? undefined;
  } catch (error) {
    logger.error('Failed to resolve organisation timezone', { error, orgId });
    return undefined;
  }
}

// ============================================================================
// GET - Get Calendar View
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return ResponseOptimizer.createErrorResponse(
        'Authentication required',
        401
      );
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    // Optional team filter — restricts the view to one member's posts.
    // The UI sends this when a specific member is chosen in the "Team Filter"
    // dropdown; absent (or 'all') means show every member's posts.
    const memberFilterRaw = searchParams.get('userId');
    const memberFilter =
      memberFilterRaw && memberFilterRaw !== 'all'
        ? memberFilterRaw
        : undefined;

    // Validate required fields
    if (!organizationId) {
      return ResponseOptimizer.createErrorResponse(
        'Organization ID is required',
        400
      );
    }

    // Verify user is a member of the organization
    const isMember = await isOrgMember(userId, organizationId);
    if (!isMember) {
      return ResponseOptimizer.createErrorResponse(
        'Organization not found or access denied',
        404
      );
    }

    // Default to current week if no dates provided
    const start = startDate
      ? new Date(startDate)
      : new Date(new Date().setHours(0, 0, 0, 0));
    const end = endDate
      ? new Date(endDate)
      : new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Validate date range (max 31 days)
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 31) {
      return ResponseOptimizer.createErrorResponse(
        'Date range cannot exceed 31 days',
        400
      );
    }

    // Thread the org's stored timezone so optimal-time suggestions in the
    // calendar view are computed in the team's real wall-clock zone, not the
    // hard-coded Sydney default.
    const timezone = await getOrgTimezone(organizationId);
    const calendar = new CalendarService(organizationId, timezone);
    const view = await calendar.getCalendarView(start, end, memberFilter);

    // Fetch approval requests for all posts in the view.
    //
    // SECURITY: scope the lookup to the caller's effective organisation so an
    // ApprovalRequest belonging to another brand/org can never surface its
    // status here. `contentId` is a loose string reference (not a DB foreign
    // key), so without an org filter a foreign-org ApprovalRequest that shares
    // a contentId value would leak its approval status. The effective org is
    // the caller's active brand (`getEffectiveOrganizationId`), falling back to
    // the already-membership-verified request `organizationId`. ApprovalRequest
    // rows with a null organizationId carry no org and are intentionally not
    // matched (no-org rows are never exposed cross-org).
    const approvalOrgId =
      (await getEffectiveOrganizationId(userId)) ?? organizationId;
    const postIds = view.posts.map(p => p.id);
    const approvalRequests =
      postIds.length > 0
        ? await prisma.approvalRequest.findMany({
            where: {
              contentId: { in: postIds },
              contentType: 'post',
              organizationId: approvalOrgId,
            },
            select: {
              id: true,
              contentId: true,
              status: true,
            },
            take: 500,
          })
        : [];

    // Create a map of post ID to approval info
    const approvalMap = new Map(
      approvalRequests.map(ar => [
        ar.contentId,
        { id: ar.id, status: ar.status },
      ])
    );

    // Enhance posts with approval status
    const postsWithApproval = view.posts.map(post => ({
      ...post,
      approvalId: approvalMap.get(post.id)?.id,
      approvalStatus: approvalMap.get(post.id)?.status,
    }));

    // Count pending approvals
    const pendingApprovals = approvalRequests.filter(
      ar => ar.status === 'pending' || ar.status === 'in_review'
    ).length;

    return ResponseOptimizer.createResponse(
      {
        success: true,
        calendar: {
          startDate: view.startDate,
          endDate: view.endDate,
          posts: postsWithApproval,
          conflicts: view.conflicts,
          suggestions: view.suggestions.slice(0, 5), // Top 5 suggestions
          stats: {
            totalPosts: view.posts.length,
            scheduledPosts: view.posts.filter(p => p.status === 'scheduled')
              .length,
            publishedPosts: view.posts.filter(p => p.status === 'published')
              .length,
            conflictCount: view.conflicts.length,
            pendingApprovals,
          },
        },
      },
      { cacheType: 'api', cacheDuration: 60 }
    );
  } catch (error) {
    logger.error('Failed to get calendar view', { error });
    return ResponseOptimizer.createErrorResponse(
      'Failed to get calendar view',
      500
    );
  }
}

// ============================================================================
// POST - Schedule Post
// ============================================================================

const schedulePostSchema = z.object({
  organizationId: z.string().min(1),
  title: z.string().optional(),
  content: z.string().min(1),
  platforms: z.array(z.string()).min(1),
  scheduledFor: z.string().min(1),
  mediaUrls: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  campaignId: z.string().optional(),
  recurrence: z.any().optional(),
  autoOptimize: z.boolean().optional().default(false),
  checkConflicts: z.boolean().optional().default(true),
  createRecurrences: z.boolean().optional().default(true),
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return ResponseOptimizer.createErrorResponse(
        'Authentication required',
        401
      );
    }

    const body = await request.json();
    const validation = schedulePostSchema.safeParse(body);
    if (!validation.success) {
      return ResponseOptimizer.createErrorResponse(
        `Invalid request data: ${validation.error.issues.map(i => i.message).join(', ')}`,
        400
      );
    }
    const {
      organizationId,
      title,
      content,
      platforms,
      scheduledFor,
      mediaUrls,
      tags,
      campaignId,
      recurrence,
      autoOptimize,
      checkConflicts,
      createRecurrences,
    } = validation.data;

    // Verify user is a member of the organization
    const isMember = await isOrgMember(userId, organizationId);
    if (!isMember) {
      return ResponseOptimizer.createErrorResponse(
        'Organization not found or access denied',
        404
      );
    }

    // Thread the org's stored timezone so autoOptimize's optimal-time lookup
    // resolves peak hours in the team's real wall-clock zone.
    const timezone = await getOrgTimezone(organizationId);
    const calendar = new CalendarService(organizationId, timezone);

    const options: ScheduleOptions = {
      post: {
        title,
        content,
        platforms,
        scheduledFor: new Date(scheduledFor),
        mediaUrls,
        tags,
        campaignId,
        recurrence,
        createdBy: userId, // Use authenticated user ID, not from request body
      },
      autoOptimize,
      checkConflicts,
      createRecurrences,
    };

    const post = await calendar.schedulePost(options);

    logger.info('Post scheduled via API', {
      postId: post.id,
      organizationId,
      platforms,
      userId: userId,
    });

    return ResponseOptimizer.createResponse(
      {
        success: true,
        post,
      },
      { status: 201, cacheType: 'none' }
    );
  } catch (error) {
    logger.error('Failed to schedule post', { error });

    // Return generic error message for conflicts
    if (error instanceof Error && error.message.includes('conflict')) {
      return ResponseOptimizer.createErrorResponse(
        'Scheduling conflict detected',
        409
      );
    }

    return ResponseOptimizer.createErrorResponse(
      'Failed to schedule post',
      500
    );
  }
}

// ============================================================================
// PATCH - Reschedule Post
// ============================================================================

const reschedulePostSchema = z.object({
  organizationId: z.string().min(1),
  postId: z.string().min(1),
  newTime: z.string().min(1),
  updateRecurrences: z.boolean().optional().default(false),
});

export async function PATCH(request: NextRequest) {
  try {
    // Authenticate user
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return ResponseOptimizer.createErrorResponse(
        'Authentication required',
        401
      );
    }

    const body = await request.json();
    const patchValidation = reschedulePostSchema.safeParse(body);
    if (!patchValidation.success) {
      return ResponseOptimizer.createErrorResponse(
        `Invalid request data: ${patchValidation.error.issues.map(i => i.message).join(', ')}`,
        400
      );
    }
    const { organizationId, postId, newTime, updateRecurrences } =
      patchValidation.data;

    // Verify user is a member of the organization
    const isMember = await isOrgMember(userId, organizationId);
    if (!isMember) {
      return ResponseOptimizer.createErrorResponse(
        'Organization not found or access denied',
        404
      );
    }

    const calendar = new CalendarService(organizationId);

    const post = await calendar.reschedulePost({
      postId,
      newTime: new Date(newTime),
      updateRecurrences,
    });

    logger.info('Post rescheduled via API', {
      postId,
      newTime,
      organizationId,
      userId: userId,
    });

    return ResponseOptimizer.createResponse(
      {
        success: true,
        post,
      },
      { cacheType: 'none' }
    );
  } catch (error) {
    logger.error('Failed to reschedule post', { error });

    if (error instanceof Error && error.message.includes('conflict')) {
      return ResponseOptimizer.createErrorResponse(
        'Scheduling conflict detected',
        409
      );
    }

    return ResponseOptimizer.createErrorResponse(
      'Failed to reschedule post',
      500
    );
  }
}

export const runtime = 'nodejs';
