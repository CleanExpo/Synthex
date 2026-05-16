/**
 * Billing Usage API — Phase 3 PR 2
 *
 * Returns the authenticated user's current-period usage + plan limits.
 * Aggregates from:
 *   - Subscription model (plan, limits, currentAiPosts, lastResetAt)
 *   - ApiUsage model (AI generations consumed since lastResetAt)
 *   - PlatformConnection model (active networks count)
 *   - lib/authority/feature-limits.ts (authority addon resource limits)
 *
 * @module app/api/billing/usage/route
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { prisma } from '@/lib/prisma';
import { subscriptionService } from '@/lib/stripe/subscription-service';
import { AUTHORITY_LIMITS } from '@/lib/authority/feature-limits';
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

    const subscription =
      await subscriptionService.getOrCreateSubscription(userId);

    // Active platform connections — "networks connected"
    const networksConnected = await prisma.platformConnection.count({
      where: {
        userId,
        isActive: true,
        deletedAt: null,
      },
    });

    // AI generations consumed in the current period (since lastResetAt).
    // subscription.usage.lastResetAt is the period anchor.
    const periodStart = subscription.usage.lastResetAt;
    const aiGenerationsConsumed = await prisma.apiUsage.count({
      where: {
        userId,
        status: 'success',
        createdAt: { gte: periodStart },
      },
    });

    // Period reset date — Stripe's currentPeriodEnd if present, else the
    // 30-day rolling window from lastResetAt.
    const periodResetAt =
      subscription.currentPeriodEnd ??
      new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Authority addon limits (live in feature-limits.ts).
    const hasAuthorityAddon =
      await subscriptionService.hasAuthorityAddon(userId);
    const authorityTier = hasAuthorityAddon ? 'addon' : 'free';

    return NextResponse.json({
      plan: subscription.plan,
      status: subscription.status,
      periodStart: periodStart.toISOString(),
      periodResetAt: periodResetAt.toISOString(),
      limits: {
        socialAccounts: subscription.limits.socialAccounts,
        aiPosts: subscription.limits.aiPosts,
        personas: subscription.limits.personas,
      },
      usage: {
        // Posts scheduled / AI posts published this period
        aiPosts: subscription.usage.aiPosts,
        // Distinct API usage count (independent metric — includes non-post
        // generations like captions, hashtags, sentiment)
        aiGenerations: aiGenerationsConsumed,
        networksConnected,
      },
      authority: {
        tier: authorityTier,
        limits: AUTHORITY_LIMITS[authorityTier],
      },
    });
  } catch (error) {
    logger.error('Failed to fetch billing usage', { error });
    return NextResponse.json(
      { error: 'Failed to fetch usage' },
      { status: 500 }
    );
  }
}
