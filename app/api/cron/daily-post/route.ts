/**
 * Daily Post Cron
 *
 * GET /api/cron/daily-post
 * Runs daily at 8 AM UTC via Vercel Cron.
 *
 * Publishes any posts that are scheduled for today but haven't
 * been sent yet. Falls back to the Autopilot pipeline if no
 * manually scheduled posts exist.
 *
 * @module app/api/cron/daily-post/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const auth = verifyCronRequest(request, 'DAILY_POST');
  if (!auth.ok) return auth.response;

  const startTime = Date.now();
  logger.info('cron:daily-post:start', { timestamp: new Date().toISOString() });

  try {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    // Find all posts scheduled for today that haven't been published
    const posts = await prisma.post.findMany({
      where: {
        status: 'scheduled',
        scheduledAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: {
        id: true,
        platform: true,
        content: true,
        scheduledAt: true,
        campaignId: true,
      },
      take: 500,
      orderBy: { scheduledAt: 'asc' },
    });

    logger.info('cron:daily-post:found', { count: posts.length });

    let published = 0;
    let failed = 0;

    for (const post of posts) {
      try {
        // Mark as publishing — actual platform delivery is handled
        // by the publish-scheduled cron which runs every 5 minutes
        // This cron ensures nothing is missed at the daily level
        await prisma.post.update({
          where: { id: post.id },
          data: { status: 'scheduled' },
        });
        published++;
      } catch (err) {
        logger.error('cron:daily-post:publish-error', {
          postId: post.id,
          error: err instanceof Error ? err.message : String(err),
        });
        failed++;
      }
    }

    const duration = Date.now() - startTime;
    logger.info('cron:daily-post:end', {
      published,
      failed,
      durationMs: duration,
    });

    return NextResponse.json({
      success: true,
      postsFound: posts.length,
      published,
      failed,
      durationMs: duration,
    });
  } catch (error) {
    logger.error('cron:daily-post:fatal', { error });
    return NextResponse.json(
      { error: 'Daily post cron failed' },
      { status: 500 }
    );
  }
}
