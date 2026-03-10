/**
 * Unite-Hub Daily Revenue Cron
 *
 * GET /api/cron/unite-hub-revenue
 * Runs daily at 6 AM UTC via Vercel Cron.
 *
 * Pushes daily revenue summary (MRR, customers, by-tier breakdown) to
 * the Unite-Group Nexus dashboard via the Unite-Hub connector.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - CRON_SECRET: Vercel cron secret for authorization (SECRET)
 * - UNITE_HUB_API_URL: Unite-Hub base URL (OPTIONAL — no-op if absent)
 * - UNITE_HUB_API_KEY: Unite-Hub API key (OPTIONAL — no-op if absent)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { pushUniteHubEvent } from '@/lib/unite-hub-connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<NextResponse> {
  // -- Auth (same pattern as other crons) ------------------------------------
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // -- Gather revenue data ---------------------------------------------------
  const startTime = Date.now();

  // Window: last 30 days for new/churned detection
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  try {
    const [activeSubscriptions, newSubscriptions, churnedSubscriptions] = await Promise.all([
      // All currently active subscriptions
      prisma.subscription.findMany({
        where: {
          status: { in: ['active', 'trialing'] },
        },
        select: {
          plan: true,
        },
      }),

      // New subscriptions in last 30 days
      prisma.subscription.count({
        where: {
          status: { in: ['active', 'trialing'] },
          createdAt: { gte: thirtyDaysAgo },
        },
      }),

      // Cancelled subscriptions in last 30 days
      prisma.subscription.count({
        where: {
          status: 'cancelled',
          cancelledAt: { gte: thirtyDaysAgo },
        },
      }),
    ]);

    // Approximate MRR per plan (AUD cents)
    const PLAN_MRR: Record<string, number> = {
      free: 0,
      professional: 24900,
      business: 49900,
      custom: 99900,
    };

    // Calculate MRR and by-tier breakdown
    const byTier: Record<string, number> = {};
    let mrr = 0;

    for (const sub of activeSubscriptions) {
      const planMrr = PLAN_MRR[sub.plan] ?? 0;
      mrr += planMrr;
      byTier[sub.plan] = (byTier[sub.plan] ?? 0) + 1;
    }

    const customers = activeSubscriptions.length;

    // -- Push to Unite-Hub (fire-and-forget) ----------------------------------
    void pushUniteHubEvent({
      type: 'revenue.daily',
      mrr,
      customers,
      newCustomers: newSubscriptions,
      churned: churnedSubscriptions,
      byTier,
    });

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      mrr,
      customers,
      newCustomers: newSubscriptions,
      churned: churnedSubscriptions,
      byTier,
      durationMs,
    });
  } catch (error) {
    console.error('[unite-hub-revenue] Fatal error:', error);
    return NextResponse.json(
      { error: 'Revenue cron failed' },
      { status: 500 }
    );
  }
}
