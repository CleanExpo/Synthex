/**
 * Unite-Group Daily Revenue Cron
 *
 * GET /api/cron/unite-group-revenue
 * Runs daily at 6 AM UTC via Vercel Cron.
 *
 * Pushes daily revenue summary (MRR, customers, by-tier breakdown) to
 * the Unite-Group Nexus dashboard via the Unite-Group connector.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - CRON_SECRET: Vercel cron secret for authorization (SECRET)
 * - UNITE_GROUP_EVENTS_URL: Unite-Group base URL (OPTIONAL — no-op if absent)
 * - UNITE_GROUP_EVENTS_API_KEY: Unite-Group API key (OPTIONAL — no-op if absent)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { pushUniteGroupEvent } from '@/lib/unite-group-connector';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<NextResponse> {
  // -- Auth (same pattern as other crons) ------------------------------------
  const auth = verifyCronRequest(request, 'UNITE_GROUP_REVENUE');
  if (!auth.ok) return auth.response;

  // -- Gather revenue data ---------------------------------------------------
  const startTime = Date.now();
  logger.info('cron:unite-group-revenue:start', {
    timestamp: new Date().toISOString(),
  });

  // Window: last 30 days for new/churned detection
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  try {
    const [activeSubscriptions, newSubscriptions, churnedSubscriptions] =
      await Promise.all([
        // All currently active subscriptions (past_due still count — Stripe retries payment)
        prisma.subscription.findMany({
          where: {
            status: { in: ['active', 'trialing', 'past_due'] }, // QA-AUDIT-2026-03-14 (M7)
          },
          select: {
            plan: true,
          },
        }),

        // New subscriptions in last 30 days
        prisma.subscription.count({
          where: {
            status: { in: ['active', 'trialing', 'past_due'] }, // QA-AUDIT-2026-03-14 (M7)
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

    // -- Push to Unite-Group ----------------------------------------------------
    // Await so the event completes before the response returns and the Vercel
    // serverless instance freezes. pushUniteGroupEvent swallows its own errors and
    // never throws, so awaiting it can't fail the cron; the try/catch is belt-
    // and-braces against any future change to that contract.
    try {
      await pushUniteGroupEvent({
        type: 'revenue.daily',
        mrr,
        customers,
        newCustomers: newSubscriptions,
        churned: churnedSubscriptions,
        byTier,
      });
    } catch (pushError) {
      logger.error(
        '[unite-group-revenue] Failed to push revenue event:',
        pushError
      );
    }

    const durationMs = Date.now() - startTime;
    logger.info('cron:unite-group-revenue:end', {
      timestamp: new Date().toISOString(),
      durationMs,
      mrr,
      customers,
    });

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
    logger.error('[unite-group-revenue] Fatal error:', error);
    return NextResponse.json({ error: 'Revenue cron failed' }, { status: 500 });
  }
}
