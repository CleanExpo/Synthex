/**
 * Admin Job Queue Management API
 *
 * Provides endpoints for monitoring and managing background jobs.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET (CRITICAL)
 * - ADMIN_API_KEY (SECRET)
 *
 * @module app/api/admin/jobs/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sanitizeErrorForResponse } from '@/lib/utils/error-utils';
import {
  getQueueStats,
  getJobsByStatus,
  getDeadLetterJobs,
  retryJob,
  cancelJob,
  getJob,
  type JobStatus,
} from '@/lib/queue';
import { verifyAdmin } from '@/lib/admin/verify-admin';

// =============================================================================
// GET - Queue Statistics and Jobs
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if (!auth.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden', message: auth.error },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'stats': {
        const stats = getQueueStats();
        return NextResponse.json({
          success: true,
          data: stats,
        });
      }

      case 'dead-letter': {
        const deadJobs = getDeadLetterJobs();
        return NextResponse.json({
          success: true,
          data: deadJobs,
          count: deadJobs.length,
        });
      }

      case 'by-status': {
        const status = searchParams.get('status') as JobStatus;
        if (!status) {
          return NextResponse.json(
            { error: 'Bad Request', message: 'Status parameter required' },
            { status: 400 }
          );
        }
        const jobs = getJobsByStatus(status);
        return NextResponse.json({
          success: true,
          data: jobs,
          count: jobs.length,
        });
      }

      case 'job': {
        const jobId = searchParams.get('id');
        if (!jobId) {
          return NextResponse.json(
            { error: 'Bad Request', message: 'Job ID required' },
            { status: 400 }
          );
        }
        const job = getJob(jobId);
        if (!job) {
          return NextResponse.json(
            { error: 'Not Found', message: 'Job not found' },
            { status: 404 }
          );
        }
        return NextResponse.json({
          success: true,
          data: job,
        });
      }

      default: {
        // Return overview
        const stats = getQueueStats();
        const recentDead = getDeadLetterJobs().slice(0, 10);
        const recentPending = getJobsByStatus('pending').slice(0, 10);

        return NextResponse.json({
          success: true,
          data: {
            stats,
            recentDeadLetterJobs: recentDead,
            recentPendingJobs: recentPending,
          },
        });
      }
    }
  } catch (error: unknown) {
    console.error('Admin jobs GET error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to process job request') },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Job Actions
// =============================================================================

const jobActionSchema = z.object({
  action: z.string().min(1),
  jobId: z.string().optional(),
  jobIds: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if (!auth.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden', message: auth.error },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = jobActionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }
    const { action, jobId, jobIds } = validation.data;

    switch (action) {
      case 'retry': {
        if (!jobId) {
          return NextResponse.json(
            { error: 'Bad Request', message: 'Job ID required' },
            { status: 400 }
          );
        }

        const job = await retryJob(jobId);
        if (!job) {
          return NextResponse.json(
            { error: 'Not Found', message: 'Job not found or not in dead state' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Job queued for retry',
          data: job,
        });
      }

      case 'retry-all-dead': {
        const deadJobs = getDeadLetterJobs();
        const results = await Promise.all(
          deadJobs.map(async (job) => {
            const retried = await retryJob(job.id);
            return { id: job.id, retried: !!retried };
          })
        );

        const retriedCount = results.filter((r) => r.retried).length;

        return NextResponse.json({
          success: true,
          message: `${retriedCount} jobs queued for retry`,
          results,
        });
      }

      case 'cancel': {
        if (!jobId) {
          return NextResponse.json(
            { error: 'Bad Request', message: 'Job ID required' },
            { status: 400 }
          );
        }

        const cancelled = cancelJob(jobId);
        if (!cancelled) {
          return NextResponse.json(
            { error: 'Not Found', message: 'Job not found or not in pending state' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Job cancelled',
        });
      }

      case 'cancel-bulk': {
        if (!jobIds || jobIds.length === 0) {
          return NextResponse.json(
            { error: 'Bad Request', message: 'Job IDs array required' },
            { status: 400 }
          );
        }

        const results = jobIds.map((id: string) => ({
          id,
          cancelled: cancelJob(id),
        }));

        const cancelledCount = results.filter((r) => r.cancelled).length;

        return NextResponse.json({
          success: true,
          message: `${cancelledCount} jobs cancelled`,
          results,
        });
      }

      default:
        return NextResponse.json(
          { error: 'Bad Request', message: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error: unknown) {
    console.error('Admin jobs POST error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: sanitizeErrorForResponse(error, 'Failed to process job request') },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
