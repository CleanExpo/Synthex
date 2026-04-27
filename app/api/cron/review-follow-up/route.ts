/**
 * Review Follow-Up Cron
 *
 * GET /api/cron/review-follow-up
 * Runs daily at 9 AM UTC. Finds pending review requests sent ≥3 days ago
 * with no follow-up sent and no review received — sends a gentle reminder.
 *
 * ENVIRONMENT VARIABLES:
 * - CRON_SECRET: Vercel cron authorisation (SECRET)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendFollowUp } from '@/lib/reviews/review-request-service';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = verifyCronRequest(request, 'REVIEW_FOLLOW_UP');
  if (!auth.ok) return auth.response;

  const startTime = Date.now();
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  logger.info('cron:review-follow-up:start', {
    timestamp: new Date().toISOString(),
  });

  // Find pending requests sent 3+ days ago with no follow-up and no review received
  const pending = await prisma.reviewRequest.findMany({
    where: {
      status: 'pending',
      sentAt: { lte: threeDaysAgo },
      followUpSentAt: null,
      reviewReceivedAt: null,
    },
    select: { id: true },
  });

  let sent = 0;
  let failed = 0;

  for (const req of pending) {
    try {
      await sendFollowUp(req.id);
      sent++;
    } catch (error) {
      logger.error('cron:review-follow-up:error', {
        reviewRequestId: req.id,
        error: error instanceof Error ? error.message : String(error),
      });
      failed++;
    }
  }

  const duration = Date.now() - startTime;

  logger.info('cron:review-follow-up:complete', {
    duration,
    total: pending.length,
    sent,
    failed,
  });

  return NextResponse.json({
    success: true,
    duration,
    total: pending.length,
    sent,
    failed,
  });
}
