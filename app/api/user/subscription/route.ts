/**
 * User Subscription API
 *
 * Returns the current user's subscription details and plan features.
 * Uses Prisma to query the Subscription model (unified with webhook handlers).
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: For verifying user authentication (CRITICAL)
 *
 * FAILURE MODE: Returns error response if missing
 *
 * @module app/api/user/subscription/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { subscriptionService } from '@/lib/stripe/subscription-service';

export async function GET(request: NextRequest) {
  try {
    // Security check
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

    // Get user ID from security context (already verified by APISecurityChecker)
    const userId = security.context.userId;
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get or create subscription via Prisma (auto-creates free tier if none exists)
    const subscription = await subscriptionService.getOrCreateSubscription(userId);

    // Plan features map (matches billing page expectations)
    const planFeatures: Record<string, Record<string, unknown>> = {
      professional: {
        socialAccounts: 5,
        aiPosts: 100,
        personas: 3,
        analytics: 'professional',
        support: 'email',
        scheduling: true,
        contentLibrary: true,
      },
      business: {
        socialAccounts: 10,
        aiPosts: -1,
        personas: 10,
        analytics: 'advanced',
        support: 'priority',
        patternAnalysis: true,
        customAI: true,
        competitorAnalysis: true,
        abTesting: true,
        teamCollaboration: true,
      },
      custom: {
        socialAccounts: -1,
        aiPosts: -1,
        personas: -1,
        analytics: 'enterprise',
        support: 'dedicated',
        apiAccess: true,
        whiteLabel: true,
        customIntegrations: true,
        sla: true,
        onPremise: true,
      },
      free: {
        socialAccounts: 1,
        aiPosts: 5,
        personas: 1,
        analytics: 'basic',
        support: 'community',
      },
    };

    return NextResponse.json({
      plan: subscription.plan,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      trialEnd: subscription.trialEnd?.toISOString() ?? null,
      features: planFeatures[subscription.plan] || planFeatures.free,
    });
  } catch (error: unknown) {
    console.error('Subscription fetch error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: 'Failed to fetch subscription details',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
