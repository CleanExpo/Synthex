/**
 * Weekly Digest Cron Job
 *
 * GET /api/cron/weekly-digest
 * Runs Monday 8 AM UTC via Vercel Cron.
 * Generates AI weekly digests for all Business plan users.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - OPENROUTER_API_KEY: AI service key (SECRET)
 * - CRON_SECRET: Vercel cron secret for authorization (SECRET)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateWeeklyDigest } from '@/lib/ai/project-manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[Weekly Digest Cron] Starting generation...');
    const startTime = Date.now();

    // Get all Business/Custom plan users
    const users = await prisma.subscription.findMany({
      where: {
        status: { in: ['active', 'trialing'] },
        plan: { in: ['business', 'custom'] },
      },
      select: { userId: true },
    });

    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let generated = 0;
    let errors = 0;

    // Process sequentially to avoid rate limits on AI provider
    for (const user of users) {
      try {
        const digest = await generateWeeklyDigest(user.userId);

        await prisma.aIWeeklyDigest.create({
          data: {
            userId: user.userId,
            weekStart,
            weekEnd: now,
            summary: digest.summary,
            highlights: digest.highlights as any,
            actionItems: digest.actionItems as any,
            opportunities: digest.opportunities as any,
          },
        });

        generated++;
        // TODO: Send email via email service (SendGrid/Resend)
      } catch (err) {
        console.error(`[Weekly Digest] Failed for user ${user.userId}:`, err);
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `[Weekly Digest Cron] Complete: ${generated} digests generated, ${errors} errors in ${duration}ms`
    );

    return NextResponse.json({
      success: true,
      generated,
      errors,
      totalUsers: users.length,
      durationMs: duration,
    });
  } catch (error) {
    console.error('[Weekly Digest Cron] Fatal error:', error);
    return NextResponse.json(
      { error: 'Weekly digest generation failed' },
      { status: 500 }
    );
  }
}
