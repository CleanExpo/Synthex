/**
 * Invoice History API
 *
 * @description Returns user's invoice history from Stripe
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - STRIPE_SECRET_KEY: Stripe secret key for API operations (CRITICAL)
 * - JWT_SECRET: For verifying user authentication (CRITICAL)
 *
 * FAILURE MODE: Returns error response if missing
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/config';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!stripe) {
      return NextResponse.json(
        {
          error: 'Billing not configured',
          message: 'Payment processing is not set up yet.',
          invoices: [],
        },
        { status: 200 }
      );
    }

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

    // Get user from centralised auth
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user's subscription to find Stripe customer ID
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      select: { stripeCustomerId: true },
    });

    if (!subscription?.stripeCustomerId) {
      return NextResponse.json({
        invoices: [],
        message: 'No billing history available',
      });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const startingAfter = searchParams.get('starting_after') || undefined;

    // Fetch invoices from Stripe
    const invoices = await stripe.invoices.list({
      customer: subscription.stripeCustomerId,
      limit,
      starting_after: startingAfter,
    });

    // Map to safe response format
    const safeInvoices = invoices.data.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      description: invoice.description,
      created: invoice.created,
      periodStart: invoice.period_start,
      periodEnd: invoice.period_end,
      pdfUrl: invoice.invoice_pdf,
      hostedUrl: invoice.hosted_invoice_url,
      lines: invoice.lines.data.map((line) => ({
        description: line.description,
        amount: line.amount,
        quantity: line.quantity,
      })),
    }));

    return NextResponse.json({
      invoices: safeInvoices,
      hasMore: invoices.has_more,
    });
  } catch (error) {
    logger.error('Invoice fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
