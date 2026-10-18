/**
 * @internal Server-only endpoint — not called directly by frontend UI.
 * Used by: admin tooling and infrastructure diagnostics to inspect and reset rate limit state.
 */

/**
 * Rate Limit Management API
 * Provides endpoints for checking and managing rate limits
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRateLimitStatus, resetRateLimits } from '@/lib/rate-limit';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

// GET: Get rate limit status
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(req);

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const status = await getRateLimitStatus(userId);

    // Get the caller's own email and subscription plan
    const [user, subscription] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      }),
      prisma.subscription.findUnique({
        where: { userId },
        select: { plan: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      userId,
      email: user?.email,
      plan: subscription?.plan || 'free',
      // Per-user overrides are not provisioned (no users.rate_limit_override column)
      customLimit: null,
      customLimitAvailable: false,
      status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting rate limit status:', error);
    return NextResponse.json(
      { error: 'Failed to get rate limit status' },
      { status: 500 }
    );
  }
}

// POST: Reset rate limits (admin only)
export async function POST(req: NextRequest) {
  try {
    const adminKey = req.headers.get('x-admin-key');

    if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Reset rate limits
    await resetRateLimits(userId);

    // Log admin action
    await prisma.auditLog.create({
      data: {
        action: 'rate_limit_reset',
        resource: 'rate_limit',
        resourceId: userId,
        category: 'security',
        details: { adminId: 'system', reason: 'Admin manual reset' },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Rate limits reset for user ${user.email}`,
      userId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error resetting rate limits:', error);
    return NextResponse.json(
      { error: 'Failed to reset rate limits' },
      { status: 500 }
    );
  }
}

// PATCH: Update user's custom rate limit
export async function PATCH(req: NextRequest) {
  try {
    const adminKey = req.headers.get('x-admin-key');

    if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const { userId, limit } = await req.json();

    if (!userId || typeof limit !== 'number') {
      return NextResponse.json(
        { error: 'User ID and numeric limit required' },
        { status: 400 }
      );
    }

    if (limit < 0 || limit > 100000) {
      return NextResponse.json(
        { error: 'Limit must be between 0 and 100000' },
        { status: 400 }
      );
    }

    // NOT PROVISIONED: per-user overrides need a users.rate_limit_override
    // column, which prisma/schema.prisma does not define.
    return NextResponse.json(
      {
        error: 'FEATURE_NOT_PROVISIONED',
        message:
          'Custom rate limits are not provisioned: the users.rate_limit_override column does not exist.',
      },
      { status: 501 }
    );
  } catch (error) {
    logger.error('Error updating rate limit:', error);
    return NextResponse.json(
      { error: 'Failed to update rate limit' },
      { status: 500 }
    );
  }
}
