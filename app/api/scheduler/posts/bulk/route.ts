/**
 * Bulk Scheduler API
 *
 * Batch operations for queue management: reschedule, delete, set-status, retry.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/scheduler/posts/bulk/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import {
  getScheduleConnectionWarnings,
  type ScheduleWarning,
} from '@/lib/social/connection-warnings';
import { isFutureScheduledAt } from '../route';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// =============================================================================
// Schema
// =============================================================================

const bulkActionSchema = z.object({
  action: z.enum(['reschedule', 'delete', 'set-status', 'retry']),
  postIds: z.array(z.string()).min(1).max(50),
  // For reschedule — set all to exact time:
  scheduledAt: z.string().datetime().optional(),
  // For reschedule — shift each post's existing scheduledAt by N hours:
  offsetHours: z.number().optional(),
  // For set-status:
  status: z.enum(['draft', 'scheduled', 'cancelled']).optional(),
});

// =============================================================================
// POST - Bulk Operations
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = bulkActionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { action, postIds, scheduledAt, offsetHours, status } =
      validation.data;

    // -------------------------------------------------------------------------
    // Verify ownership + active-org scope of every post via its campaign.
    // SYN-SCHED: previously this only checked campaign.userId, so a bulk
    // operation issued while brand B was active could mutate brand A's posts.
    // We now also require the campaign to belong to the active organization
    // (falling back to ownership-only when there is no org context).
    // -------------------------------------------------------------------------
    const organizationId = await getEffectiveOrganizationId(userId);
    const posts = await prisma.post.findMany({
      where: { id: { in: postIds } },
      include: {
        campaign: { select: { userId: true, organizationId: true } },
      },
      take: 500,
    });

    const ownedPosts = posts.filter(
      p =>
        p.campaign.userId === userId &&
        (organizationId === null ||
          p.campaign.organizationId === organizationId)
    );
    const unauthorisedIds = postIds.filter(
      id => !ownedPosts.find(p => p.id === id)
    );

    if (unauthorisedIds.length === postIds.length) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'None of the specified posts belong to you',
        },
        { status: 403 }
      );
    }

    const ownedIds = ownedPosts.map(p => p.id);

    // -------------------------------------------------------------------------
    // Execute action
    // -------------------------------------------------------------------------
    type BulkResult = {
      id: string;
      status: 'updated' | 'deleted' | 'skipped';
      error?: string;
    };
    const results: BulkResult[] = [];
    let processed = 0;
    let failed = 0;
    // SYN-SCHED-CONNECTION-WARN: platforms of posts re-activated for publish by a
    // reschedule. Used after the switch to warn (non-blocking) about any platform
    // with no active connection — same contract as POST /api/scheduler/posts.
    const rescheduledPlatforms = new Set<string>();

    switch (action) {
      // -- RESCHEDULE ---------------------------------------------------------
      case 'reschedule': {
        if (!scheduledAt && offsetHours === undefined) {
          return NextResponse.json(
            {
              error: 'Validation Error',
              message:
                'Provide either scheduledAt or offsetHours for reschedule',
            },
            { status: 400 }
          );
        }

        if (scheduledAt) {
          // SYN-SCHED: reject an exact reschedule into the past — the cron would
          // publish those posts immediately/unexpectedly. Mirrors the create route.
          if (!isFutureScheduledAt(scheduledAt)) {
            return NextResponse.json(
              {
                error: 'Validation Error',
                message: 'scheduledAt must be in the future',
              },
              { status: 400 }
            );
          }
          // Set all posts to exact time
          await prisma.post.updateMany({
            where: { id: { in: ownedIds } },
            data: { scheduledAt: new Date(scheduledAt), status: 'scheduled' },
          });
          for (const post of ownedPosts) {
            results.push({ id: post.id, status: 'updated' });
            rescheduledPlatforms.add(post.platform);
            processed++;
          }
        } else if (offsetHours !== undefined) {
          // Shift each post individually
          for (const post of ownedPosts) {
            try {
              const currentDate = post.scheduledAt ?? new Date();
              const newDate = new Date(
                currentDate.getTime() + offsetHours * 60 * 60 * 1000
              );
              // SYN-SCHED: a negative/large offset can push a post into the past,
              // where the cron would publish it immediately. Skip those posts with
              // a clear reason rather than silently rescheduling into the past.
              if (!isFutureScheduledAt(newDate.toISOString())) {
                results.push({
                  id: post.id,
                  status: 'skipped',
                  error: 'Reschedule would place the post in the past',
                });
                failed++;
                continue;
              }
              await prisma.post.update({
                where: { id: post.id },
                data: { scheduledAt: newDate, status: 'scheduled' },
              });
              results.push({ id: post.id, status: 'updated' });
              rescheduledPlatforms.add(post.platform);
              processed++;
            } catch (err) {
              results.push({
                id: post.id,
                status: 'skipped',
                error: err instanceof Error ? err.message : 'Unknown error',
              });
              failed++;
            }
          }
        }
        break;
      }

      // -- DELETE --------------------------------------------------------------
      case 'delete': {
        await prisma.$transaction(async tx => {
          await tx.post.deleteMany({
            where: { id: { in: ownedIds } },
          });
        });
        for (const id of ownedIds) {
          results.push({ id, status: 'deleted' });
          processed++;
        }
        break;
      }

      // -- SET-STATUS ----------------------------------------------------------
      case 'set-status': {
        if (!status) {
          return NextResponse.json(
            {
              error: 'Validation Error',
              message: 'status is required for set-status action',
            },
            { status: 400 }
          );
        }

        await prisma.$transaction(async tx => {
          await tx.post.updateMany({
            where: { id: { in: ownedIds } },
            data: { status },
          });
        });
        for (const id of ownedIds) {
          results.push({ id, status: 'updated' });
          processed++;
        }
        break;
      }

      // -- RETRY ---------------------------------------------------------------
      case 'retry': {
        const failedPosts = ownedPosts.filter(p => p.status === 'failed');

        if (failedPosts.length === 0) {
          return NextResponse.json(
            {
              error: 'Validation Error',
              message: 'No failed posts found among the selected posts',
            },
            { status: 400 }
          );
        }

        const retryDate = new Date(Date.now() + 5 * 60 * 1000); // now + 5 min

        for (const post of failedPosts) {
          try {
            // Clear error metadata and reschedule
            const currentMeta =
              (post.metadata as Record<string, unknown>) ?? {};
            const {
              publishError: _pe,
              failedAt: _fa,
              ...cleanMeta
            } = currentMeta;

            await prisma.post.update({
              where: { id: post.id },
              data: {
                status: 'scheduled',
                scheduledAt: retryDate,
                metadata: cleanMeta as Record<
                  string,
                  string | number | boolean | null
                >,
              },
            });
            results.push({ id: post.id, status: 'updated' });
            processed++;
          } catch (err) {
            results.push({
              id: post.id,
              status: 'skipped',
              error: err instanceof Error ? err.message : 'Unknown error',
            });
            failed++;
          }
        }

        // Mark non-failed posts as skipped
        for (const post of ownedPosts.filter(p => p.status !== 'failed')) {
          results.push({
            id: post.id,
            status: 'skipped',
            error: 'Post is not in failed status',
          });
        }
        break;
      }

      default:
        return NextResponse.json(
          { error: 'Validation Error', message: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    // Add skipped entries for unauthorised posts
    for (const id of unauthorisedIds) {
      results.push({
        id,
        status: 'skipped',
        error: 'Post not found or not owned',
      });
      failed++;
    }

    // SYN-SCHED-CONNECTION-WARN: for posts a reschedule re-activated for publish,
    // warn (non-blocking) about any platform with no active connection — the cron
    // would otherwise fail those silently at publish time. Same warning contract
    // as POST /api/scheduler/posts; only attached when non-empty so existing
    // responses are unchanged for other actions / fully-connected platforms.
    const warnings: ScheduleWarning[] = [];
    for (const platform of rescheduledPlatforms) {
      warnings.push(
        ...(await getScheduleConnectionWarnings(
          userId,
          organizationId,
          platform
        ))
      );
    }

    return NextResponse.json({
      success: true,
      processed,
      failed,
      results,
      ...(warnings.length > 0 ? { warnings } : {}),
    });
  } catch (error) {
    logger.error('Error in bulk scheduler operation:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'Failed to process bulk operation',
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
