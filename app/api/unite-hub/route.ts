/**
 * Unite-Hub Pull Endpoint
 *
 * GET /api/unite-hub
 *
 * What Unite-Hub polls to get live health + usage stats for the Nexus dashboard.
 *
 * Authentication: x-unite-hub-api-key header must match UNITE_HUB_API_KEY env var.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - UNITE_HUB_API_KEY: API key for authenticating inbound requests from Unite-Hub
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  // -- Auth ------------------------------------------------------------------
  const apiKey = request.headers.get('x-unite-hub-api-key');
  const expectedKey = process.env.UNITE_HUB_API_KEY;

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
    const [activeUsers, subscriptions, postsPublishedToday] = await Promise.all([
      // Users who have an active subscription
      prisma.subscription.count({
        where: {
          status: 'active',
        },
      }),

      // All active subscriptions for MRR calculation
      prisma.subscription.findMany({
        where: {
          status: { in: ['active', 'trialing'] },
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
    ]);

    // Derive MRR from plan names (approximate — Stripe is source of truth)
    const PLAN_MRR: Record<string, number> = {
      free: 0,
      professional: 24900, // $249 AUD in cents
      business: 49900,     // $499 AUD in cents
      custom: 99900,       // $999 AUD in cents
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
    logger.error('[unite-hub] Failed to gather health stats:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve health stats' },
      { status: 500 }
    );
  }
}
