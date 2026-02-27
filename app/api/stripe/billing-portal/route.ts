/**
 * Stripe Billing Portal API
 *
 * Creates a Stripe billing portal session for the authenticated user.
 * Uses Prisma to read/write subscription records (unified with webhook handlers).
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - STRIPE_SECRET_KEY: Stripe secret key for API operations (CRITICAL)
 * - NEXT_PUBLIC_APP_URL: Application URL for redirects (PUBLIC)
 * - JWT_SECRET: For verifying user authentication (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 *
 * FAILURE MODE: Returns error response if missing
 *
 * @module app/api/stripe/billing-portal/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/config';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { getUserIdFromRequestOrCookies, verifyTokenSafe, unauthorizedResponse } from '@/lib/auth/jwt-utils';
import { billing } from '@/lib/middleware/api-rate-limit';
import prisma from '@/lib/prisma';
import { subscriptionService } from '@/lib/stripe/subscription-service';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  // Distributed rate limiting via Upstash Redis
  return billing(request, async () => {
  try {
    // Check if Stripe is configured
    if (!stripe) {
      return NextResponse.json(
        {
          error: 'Billing portal not available',
          message: 'Payment processing is not configured yet. Contact support for billing inquiries.',
          bypass: true
        },
        { status: 503 }
      );
    }

    // Security check
    const security = await APISecurityChecker.check(
      request,
      DEFAULT_POLICIES.AUTHENTICATED_WRITE
    );

    if (!security.allowed) {
      return APISecurityChecker.createSecureResponse(
        { error: security.error },
        403
      );
    }

    // Get user from token
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) return unauthorizedResponse();

    // Get or create subscription record via Prisma
    const subscription = await subscriptionService.getOrCreateSubscription(userId);

    let customerId = subscription.stripeCustomerId;

    // If no Stripe customer exists, create one
    if (!customerId) {
      // Extract email from token for Stripe customer creation
      const authToken = request.headers.get('authorization')?.replace('Bearer ', '');
      const tokenPayload = authToken ? verifyTokenSafe(authToken) : null;
      let userEmail = tokenPayload?.email || '';

      // Fallback: fetch email from user record
      if (!userEmail) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true },
        });
        userEmail = user?.email || '';
      }

      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { userId },
      });
      customerId = customer.id;

      // Save customer ID via subscription service
      await subscriptionService.setStripeCustomerId(userId, customerId);
    }

    // Create billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logger.error('Billing portal error', { error });
    return NextResponse.json(
      { error: 'Failed to create billing portal session' },
      { status: 500 }
    );
  }
  });
}

export const runtime = 'nodejs';
