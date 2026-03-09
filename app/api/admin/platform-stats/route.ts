/**
 * Admin Platform Stats API
 *
 * Returns aggregate subscription and user metrics for the Platform Health tab.
 *
 * Response shape:
 *   { totalUsers, activeSubscriptions, freeUsers, mrr }
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 *   - DATABASE_URL (CRITICAL)
 *   - JWT_SECRET (CRITICAL)
 *   - ADMIN_API_KEY (SECRET)
 *
 * @module app/api/admin/platform-stats/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sanitizeErrorForResponse } from '@/lib/utils/error-utils';
import { verifyAdmin } from '@/lib/admin/verify-admin';
import { admin as adminRateLimit } from '@/lib/middleware/api-rate-limit';

export async function GET(request: NextRequest) {
  return adminRateLimit(request, async () => {
    try {
      const auth = await verifyAdmin(request);
      if (!auth.isAdmin) {
        return NextResponse.json(
          { error: 'Forbidden', message: auth.error ?? 'Admin access required' },
          { status: 403 }
        );
      }

      // Run all counts in parallel for performance
      const [
        totalUsers,
        activeSubscriptions,
        cancelledSubscriptions,
        trialingSubscriptions,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.subscription.count({
          where: { status: 'active' },
        }),
        prisma.subscription.count({
          where: { status: { in: ['cancelled', 'inactive'] } },
        }),
        prisma.subscription.count({
          where: { status: 'trialing' },
        }),
      ]);

      // MRR estimate: $0 until Stripe amount field is added to schema (SYN-future)
      // The Subscription model currently tracks plan tier ('free', 'professional', 'business')
      // but does not store the billing amount — that lives in Stripe.
      const mrr = 0;

      const freeUsers = totalUsers - activeSubscriptions - trialingSubscriptions;

      return NextResponse.json({
        success: true,
        data: {
          totalUsers,
          activeSubscriptions,
          trialingSubscriptions,
          cancelledSubscriptions,
          freeUsers: Math.max(0, freeUsers),
          mrr,
        },
      });
    } catch (error: unknown) {
      console.error('Admin platform stats error:', error);
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message: sanitizeErrorForResponse(error, 'Failed to fetch platform stats'),
        },
        { status: 500 }
      );
    }
  });
}

export const runtime = 'nodejs';
