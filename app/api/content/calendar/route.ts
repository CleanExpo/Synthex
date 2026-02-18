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
import { CalendarService, type ScheduleOptions } from '@/src/services/content/calendar-service';
import { verifyToken } from '@/lib/auth/jwt-utils';
import { prisma } from '@/lib/prisma';

// =============================================================================
// Auth Helpers - Verify user and organization membership
// =============================================================================

async function getUserFromRequest(request: NextRequest): Promise<{ id: string; email: string } | null> {
  // Try Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    try {
      const token = authHeader.replace('Bearer ', '');
      const decoded = verifyToken(token);
      return { id: decoded.userId, email: decoded.email || '' };
    } catch {
      // Fall through to cookie check
    }
  }

  // Try auth-token cookie
  const authToken = request.cookies.get('auth-token')?.value;
  if (authToken) {
    try {
      const decoded = verifyToken(authToken);
      return { id: decoded.userId, email: decoded.email || '' };
    } catch {
      return null;
    }
  }

  return null;
}

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

// ============================================================================
// GET - Get Calendar View
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request);
    if (!user) {
      return ResponseOptimizer.createErrorResponse('Authentication required', 401);
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Validate required fields
    if (!organizationId) {
      return ResponseOptimizer.createErrorResponse('Organization ID is required', 400);
    }

    // Verify user is a member of the organization
    const isMember = await isOrgMember(user.id, organizationId);
    if (!isMember) {
      return ResponseOptimizer.createErrorResponse('Organization not found or access denied', 404);
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
      return ResponseOptimizer.createErrorResponse('Date range cannot exceed 31 days', 400);
    }

    const calendar = new CalendarService(organizationId);
    const view = await calendar.getCalendarView(start, end);

    // Fetch approval requests for all posts in the view
    const postIds = view.posts.map(p => p.id);
    const approvalRequests = postIds.length > 0
      ? await prisma.approvalRequest.findMany({
          where: {
            contentId: { in: postIds },
            contentType: 'post',
          },
          select: {
            id: true,
            contentId: true,
            status: true,
          },
        })
      : [];

    // Create a map of post ID to approval info
    const approvalMap = new Map(
      approvalRequests.map(ar => [ar.contentId, { id: ar.id, status: ar.status }])
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
            scheduledPosts: view.posts.filter(p => p.status === 'scheduled').length,
            publishedPosts: view.posts.filter(p => p.status === 'published').length,
            conflictCount: view.conflicts.length,
            pendingApprovals,
          },
        },
      },
      { cacheType: 'api', cacheDuration: 60 }
    );
  } catch (error) {
    logger.error('Failed to get calendar view', { error });
    return ResponseOptimizer.createErrorResponse('Failed to get calendar view', 500);
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
    const user = await getUserFromRequest(request);
    if (!user) {
      return ResponseOptimizer.createErrorResponse('Authentication required', 401);
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
    const isMember = await isOrgMember(user.id, organizationId);
    if (!isMember) {
      return ResponseOptimizer.createErrorResponse('Organization not found or access denied', 404);
    }

    const calendar = new CalendarService(organizationId);

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
        createdBy: user.id, // Use authenticated user ID, not from request body
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
      userId: user.id,
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
      return ResponseOptimizer.createErrorResponse('Scheduling conflict detected', 409);
    }

    return ResponseOptimizer.createErrorResponse('Failed to schedule post', 500);
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
    const user = await getUserFromRequest(request);
    if (!user) {
      return ResponseOptimizer.createErrorResponse('Authentication required', 401);
    }

    const body = await request.json();
    const patchValidation = reschedulePostSchema.safeParse(body);
    if (!patchValidation.success) {
      return ResponseOptimizer.createErrorResponse(
        `Invalid request data: ${patchValidation.error.issues.map(i => i.message).join(', ')}`,
        400
      );
    }
    const { organizationId, postId, newTime, updateRecurrences } = patchValidation.data;

    // Verify user is a member of the organization
    const isMember = await isOrgMember(user.id, organizationId);
    if (!isMember) {
      return ResponseOptimizer.createErrorResponse('Organization not found or access denied', 404);
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
      userId: user.id,
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
      return ResponseOptimizer.createErrorResponse('Scheduling conflict detected', 409);
    }

    return ResponseOptimizer.createErrorResponse('Failed to reschedule post', 500);
  }
}

export const runtime = 'nodejs';
