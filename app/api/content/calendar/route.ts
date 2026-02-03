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
 *
 * FAILURE MODE: Returns cached data on failure
 */

import { NextRequest, NextResponse } from 'next/server';
import { ResponseOptimizer } from '@/lib/api/response-optimizer';
import { logger } from '@/lib/logger';
import { CalendarService, type ScheduleOptions } from '@/src/services/content/calendar-service';

// ============================================================================
// GET - Get Calendar View
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Validate required fields
    if (!organizationId) {
      return ResponseOptimizer.createErrorResponse('Organization ID is required', 400);
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

    return ResponseOptimizer.createResponse(
      {
        success: true,
        calendar: {
          startDate: view.startDate,
          endDate: view.endDate,
          posts: view.posts,
          conflicts: view.conflicts,
          suggestions: view.suggestions.slice(0, 5), // Top 5 suggestions
          stats: {
            totalPosts: view.posts.length,
            scheduledPosts: view.posts.filter(p => p.status === 'scheduled').length,
            publishedPosts: view.posts.filter(p => p.status === 'published').length,
            conflictCount: view.conflicts.length,
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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
      autoOptimize = false,
      checkConflicts = true,
      createRecurrences = true,
      createdBy,
    } = body;

    // Validate required fields
    if (!organizationId) {
      return ResponseOptimizer.createErrorResponse('Organization ID is required', 400);
    }

    if (!content) {
      return ResponseOptimizer.createErrorResponse('Content is required', 400);
    }

    if (!platforms || platforms.length === 0) {
      return ResponseOptimizer.createErrorResponse('At least one platform is required', 400);
    }

    if (!scheduledFor) {
      return ResponseOptimizer.createErrorResponse('Scheduled time is required', 400);
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
        createdBy: createdBy || 'system',
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

    // Return specific error message for conflicts
    if (error instanceof Error && error.message.includes('conflict')) {
      return ResponseOptimizer.createErrorResponse(error.message, 409);
    }

    return ResponseOptimizer.createErrorResponse(
      error instanceof Error ? error.message : 'Failed to schedule post',
      500
    );
  }
}

// ============================================================================
// PATCH - Reschedule Post
// ============================================================================

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId, postId, newTime, updateRecurrences = false } = body;

    // Validate required fields
    if (!organizationId) {
      return ResponseOptimizer.createErrorResponse('Organization ID is required', 400);
    }

    if (!postId) {
      return ResponseOptimizer.createErrorResponse('Post ID is required', 400);
    }

    if (!newTime) {
      return ResponseOptimizer.createErrorResponse('New time is required', 400);
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
      return ResponseOptimizer.createErrorResponse(error.message, 409);
    }

    return ResponseOptimizer.createErrorResponse(
      error instanceof Error ? error.message : 'Failed to reschedule post',
      500
    );
  }
}
