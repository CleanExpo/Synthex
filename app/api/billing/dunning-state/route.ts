/**
 * Dunning State API — Phase 3 PR 3
 *
 * Returns the current user's DunningState row (or { state: 'current' } if
 * none exists). Consumed by the global BillingStatusBanner.
 *
 * The DunningState table is owned by Stripe webhook handlers (service_role
 * write); end-users have RLS-scoped read access to their own row only.
 * This endpoint enforces that scoping at the application layer too — we
 * resolve the user's subscriptionId before looking up the row.
 *
 * @module app/api/billing/dunning-state/route
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_READ
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        403
      );
    }

    const userId = security.context.userId;
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Resolve subscription -> dunning state
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      select: { id: true, status: true, cancelAtPeriodEnd: true },
    });

    if (!subscription) {
      return NextResponse.json({ state: 'current' });
    }

    const dunning = await prisma.dunningState.findUnique({
      where: { subscriptionId: subscription.id },
    });

    if (!dunning) {
      // No dunning record. Derive state from subscription.status for the
      // banner's `cancelled_grace_period` + `paused` cases.
      if (subscription.cancelAtPeriodEnd && subscription.status !== 'cancelled') {
        return NextResponse.json({ state: 'cancelled_grace_period' });
      }
      if (subscription.status === 'paused') {
        return NextResponse.json({ state: 'paused' });
      }
      return NextResponse.json({ state: 'current' });
    }

    return NextResponse.json({
      state: dunning.state, // past_due | unpaid | recovered | cancelled
      failedAttempts: dunning.failedAttempts,
      nextRetryAt: dunning.nextRetryAt?.toISOString() ?? null,
      lastFailureAt: dunning.lastFailureAt?.toISOString() ?? null,
      recoveredAt: dunning.recoveredAt?.toISOString() ?? null,
    });
  } catch (error) {
    logger.error('Failed to fetch dunning state', { error });
    return NextResponse.json(
      { state: 'current', error: 'fetch_failed' },
      { status: 200 } // Banner must never crash the layout — default to current
    );
  }
}
