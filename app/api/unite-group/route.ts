/**
 * Unite-Group Pull Endpoint
 *
 * GET /api/unite-group
 *
 * What Unite-Group polls to get live health + usage stats for the Nexus dashboard.
 *
 * Authentication: x-unite-group-api-key header must match UNITE_GROUP_EVENTS_API_KEY env var.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - UNITE_GROUP_EVENTS_API_KEY: API key for authenticating inbound requests from Unite-Group
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  // -- Auth ------------------------------------------------------------------
  const apiKey = request.headers.get('x-unite-group-api-key');
  const expectedKey = process.env.UNITE_GROUP_EVENTS_API_KEY;

  if (!expectedKey || apiKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // -- Gather stats ----------------------------------------------------------
  const requestStart = Date.now();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  try {
    const [activeUsers, subscriptions, postsPublishedToday] = await Promise.all(
      [
        // Users who have an active subscription (past_due still count during grace period)
        prisma.subscription.count({
          where: {
            status: { in: ['active', 'past_due'] }, // QA-AUDIT-2026-03-14 (M7)
          },
        }),

        // All active subscriptions for MRR calculation
        prisma.subscription.findMany({
          where: {
            status: { in: ['active', 'trialing', 'past_due'] }, // QA-AUDIT-2026-03-14 (M7)
          },
          select: {
            plan: true,
          },
        }),

        // PlatformPosts published today
        prisma.platformPost.count({
          where: {
            publishedAt: {
              gte: startOfToday,
            },
          },
        }),
      ]
    );

    // Derive MRR from plan names (approximate — Stripe is source of truth)
    const PLAN_MRR: Record<string, number> = {
      free: 0,
      professional: 24900, // $249 AUD in cents
      business: 49900, // $499 AUD in cents
      custom: 99900, // $999 AUD in cents
    };

    const mrr = subscriptions.reduce((total, sub) => {
      return total + (PLAN_MRR[sub.plan] ?? 0);
    }, 0);

    const apiResponseTimeMs = Date.now() - requestStart;

    return NextResponse.json({
      health: {
        stripeConnected: Boolean(process.env.STRIPE_SECRET_KEY),
        activeUsers,
        mrr,
        postsPublishedToday,
        apiResponseTimeMs,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('[unite-group] Failed to gather health stats:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve health stats' },
      { status: 500 }
    );
  }
}
