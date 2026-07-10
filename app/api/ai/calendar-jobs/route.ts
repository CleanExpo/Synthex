/**
 * Async Content Calendar Generation API (SYN-MCP-002).
 *
 * Replaces the deprecated synchronous calendar path
 * (GET /api/ai/generate-content) with an enqueue-then-poll flow:
 *   POST /api/ai/calendar-jobs      → 202 { jobId } (generation runs on the queue)
 *   GET  /api/ai/calendar-jobs?id=… → job status + result once completed
 *
 * The job's return value lives on the queue's job record (job.result) —
 * that is the persistence the GET reads from.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { withRateLimit } from '@/lib/middleware/rate-limiter';
import { prisma } from '@/lib/prisma';
import { getJob, recoverJobsFromRedis } from '@/lib/queue';
import {
  queueCalendarGeneration,
  registerCalendarGenerationHandler,
  type CalendarGenerationJobData,
} from '@/lib/ai/calendar-job-handler';
import { logger } from '@/lib/logger';
import {
  acquireIdempotencyKey,
  releaseIdempotencyKey,
  storeIdempotentResponse,
} from '@/lib/ai/generation-context';

export const runtime = 'nodejs';

/** Tenant-scoped idempotency namespace for this route (SYN-MCP-003). */
const IDEMPOTENCY_SCOPE = 'calendar-jobs';

// Register the queue handler once at module load (idempotent).
registerCalendarGenerationHandler();

// Same platform list the generate-content POST schema validates against.
const SUPPORTED_PLATFORMS = [
  'twitter',
  'instagram',
  'linkedin',
  'tiktok',
  'facebook',
  'youtube',
] as const;

const calendarJobSchema = z.object({
  days: z.number().int().min(1).max(14),
  platforms: z.array(z.enum(SUPPORTED_PLATFORMS)).min(1).max(4),
  postsPerDay: z.number().int().min(1).max(3),
  // SYN-MCP-003: ENFORCED — duplicate submissions (same user + key) return
  // the original jobId instead of enqueuing a second expensive run.
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export async function POST(request: NextRequest) {
  return withRateLimit(request, async () => {
    try {
      // Verify authentication via JWT — cookie existence alone is insufficient
      const userId = await getUserIdFromRequestOrCookies(request);
      if (!userId) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      const body = await request.json();
      const validation = calendarJobSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Invalid request data', details: validation.error.issues },
          { status: 400 }
        );
      }
      const { days, platforms, postsPerDay, idempotencyKey } = validation.data;

      // SYN-MCP-003: tenant-scoped dedupe — a duplicate submission with the
      // same idempotencyKey (same user) returns the original job envelope
      // instead of fanning out a second days×platforms×postsPerDay run.
      let acquiredIdempotencyKey: string | null = null;
      if (idempotencyKey) {
        const acquisition = await acquireIdempotencyKey(
          IDEMPOTENCY_SCOPE,
          userId,
          idempotencyKey
        );
        if (acquisition.state === 'replayed') {
          const replayResponse = NextResponse.json(
            JSON.parse(acquisition.payload),
            { status: 202 }
          );
          replayResponse.headers.set('Idempotent-Replay', 'true');
          return replayResponse;
        }
        if (acquisition.state === 'pending') {
          return NextResponse.json(
            {
              error: 'Duplicate request',
              message:
                'A calendar job with this idempotencyKey is already being enqueued.',
            },
            { status: 409 }
          );
        }
        acquiredIdempotencyKey = idempotencyKey;
      }

      // Resolve org for brand context (best-effort — generation still works
      // without it, matching the generate-content path).
      let organizationId: string | undefined;
      try {
        const userRecord = await prisma.user.findUnique({
          where: { id: userId },
          select: { organizationId: true },
        });
        organizationId = userRecord?.organizationId ?? undefined;
      } catch (orgLookupError) {
        logger.warn('calendar-jobs: organisation lookup failed', {
          error:
            orgLookupError instanceof Error
              ? orgLookupError.message
              : String(orgLookupError),
        });
      }

      let job;
      try {
        job = await queueCalendarGeneration({
          userId,
          organizationId,
          days,
          platforms: [...platforms],
          postsPerDay,
          idempotencyKey,
        });
      } catch (enqueueError) {
        // Enqueue failed: release the claimed key so the client can retry.
        if (acquiredIdempotencyKey) {
          await releaseIdempotencyKey(
            IDEMPOTENCY_SCOPE,
            userId,
            acquiredIdempotencyKey
          ).catch(() => {});
        }
        throw enqueueError;
      }

      const envelope = {
        success: true,
        jobId: job.id,
        status: job.status,
      };
      if (acquiredIdempotencyKey) {
        await storeIdempotentResponse(
          IDEMPOTENCY_SCOPE,
          userId,
          acquiredIdempotencyKey,
          JSON.stringify(envelope)
        ).catch(() => {});
      }

      return NextResponse.json(envelope, { status: 202 });
    } catch (error) {
      logger.error('Calendar job enqueue error', { error });
      return NextResponse.json(
        { error: 'Failed to enqueue calendar generation' },
        { status: 500 }
      );
    }
  });
}

export async function GET(request: NextRequest) {
  try {
    // Verify authentication via JWT — cookie existence alone is insufficient
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const id = new URL(request.url).searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing job id' }, { status: 400 });
    }

    // Read the job record from the queue's persistence: in-memory first,
    // then recover from Redis (another instance may have enqueued it).
    let job = getJob(id);
    if (!job) {
      await recoverJobsFromRedis();
      job = getJob(id);
    }

    // 404 both for unknown jobs and jobs owned by another user — do not
    // leak other tenants' job existence.
    const jobData = job?.data as CalendarGenerationJobData | undefined;
    if (!job || jobData?.userId !== userId) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        createdAt: job.createdAt,
        completedAt: job.completedAt ?? null,
        error: job.error ?? null,
        result: job.result ?? null,
      },
    });
  } catch (error) {
    logger.error('Calendar job status error', { error });
    return NextResponse.json(
      { error: 'Failed to read calendar job status' },
      { status: 500 }
    );
  }
}
