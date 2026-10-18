/**
 * Admin Subscription Upgrade Endpoint
 *
 * Upgrades a user's subscription to a specified plan.
 * Protected by admin API key or admin JWT.
 * Reads and writes users, subscriptions and audit_logs via Prisma.
 *
 * @route POST /api/admin/upgrade-subscription
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - ADMIN_API_KEY: Admin authentication key (SECRET)
 * - JWT_SECRET: Token verification key (CRITICAL)
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { PLAN_LIMITS } from '@/lib/stripe/subscription-service';
import { logger } from '@/lib/logger';

// =============================================================================
// Schema
// =============================================================================

const upgradeSchema = z.object({
  email: z.string().email(),
  plan: z.enum([
    'pro',
    'growth',
    'scale',
    'professional',
    'business',
    'custom',
  ]),
});

// =============================================================================
// Helpers
// =============================================================================

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// =============================================================================
// Admin Auth
// =============================================================================

async function verifyAdmin(request: NextRequest): Promise<{
  isAdmin: boolean;
  userId?: string;
  error?: string;
}> {
  const apiKey = request.headers.get('x-admin-api-key');
  if (apiKey && safeCompare(apiKey, process.env.ADMIN_API_KEY ?? '')) {
    return { isAdmin: true };
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return { isAdmin: false, error: 'Authentication required' };
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const { verifyToken } = await import('@/lib/auth/jwt-utils');
    const decoded = verifyToken(token) as {
      userId: string;
      role?: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, preferences: true },
    });

    const prefs = user?.preferences as { role?: string } | null;
    if (!user || (prefs?.role !== 'admin' && prefs?.role !== 'superadmin')) {
      return {
        isAdmin: false,
        userId: decoded.userId,
        error: 'Admin access required',
      };
    }

    return { isAdmin: true, userId: decoded.userId };
  } catch {
    return { isAdmin: false, error: 'Invalid token' };
  }
}

// =============================================================================
// POST - Upgrade Subscription
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if (!auth.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden', message: auth.error || 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = upgradeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { email, plan } = validation.data;
    const limits = PLAN_LIMITS[plan];

    if (!limits) {
      return NextResponse.json(
        { error: 'Invalid plan', message: `Plan "${plan}" not found` },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Not Found', message: `No user found with email: ${email}` },
        { status: 404 }
      );
    }

    const now = new Date();
    const oneYearFromNow = new Date(now);
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    const periodAndLimits = {
      plan,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: oneYearFromNow,
      maxSocialAccounts: limits.maxSocialAccounts,
      maxAiPosts: limits.maxAiPosts,
      maxPersonas: limits.maxPersonas,
    };

    // Update the existing subscription or create one (userId is unique)
    const subscription = await prisma.subscription.upsert({
      where: { userId: user.id },
      update: {
        ...periodAndLimits,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
      },
      create: { userId: user.id, ...periodAndLimits },
    });

    // Create audit log (userId is a FK to users; API-key callers have none)
    await prisma.auditLog.create({
      data: {
        userId: auth.userId ?? null,
        action: 'subscription_upgraded',
        resource: 'subscription',
        resourceId: subscription.id,
        details: {
          targetEmail: email,
          targetUserId: user.id,
          plan,
          limits: { ...limits },
        },
        severity: 'high',
        category: 'admin',
        outcome: 'success',
      },
    });

    return NextResponse.json({
      success: true,
      message: `Subscription upgraded to ${plan}`,
      data: {
        userId: user.id,
        email: user.email,
        name: user.name,
        subscription: {
          id: subscription.id,
          plan: subscription.plan,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          limits: {
            maxSocialAccounts: subscription.maxSocialAccounts,
            maxAiPosts: subscription.maxAiPosts,
            maxPersonas: subscription.maxPersonas,
          },
        },
      },
    });
  } catch (error: unknown) {
    logger.error('Admin upgrade subscription error:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'Failed to upgrade subscription. Please try again.',
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
