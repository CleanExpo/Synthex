/**
 * Plan Change API (Upgrade/Downgrade)
 *
 * @description Handles subscription plan changes with proration
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - STRIPE_SECRET_KEY: Stripe secret key for API operations (CRITICAL)
 * - JWT_SECRET: For verifying user authentication (CRITICAL)
 *
 * FAILURE MODE: Returns error response if missing
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { stripe, PRODUCTS } from '@/lib/stripe/config';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { prisma } from '@/lib/prisma';
import { auditLogger } from '@/lib/security/audit-logger';
import { logger } from '@/lib/logger';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import Stripe from 'stripe';

const changePlanSchema = z.object({
  newPlan: z.enum(['professional', 'business', 'custom']),
  prorationBehavior: z.enum(['create_prorations', 'none', 'always_invoice']).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!stripe) {
      return NextResponse.json(
        {
          error: 'Payment processing not configured',
          message: 'Stripe is not set up. Contact support for plan changes.',
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

    // Get user from centralised auth
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const rawBody = await request.json();
    const validation = changePlanSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }
    const { newPlan, prorationBehavior = 'create_prorations' } = validation.data;

    // Validate new plan
    const newProduct = PRODUCTS[newPlan as keyof typeof PRODUCTS];
    if (!newProduct) {
      return NextResponse.json(
        { error: 'Invalid plan selected' },
        { status: 400 }
      );
    }

    // Get current subscription
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription?.stripeSubscriptionId) {
      return NextResponse.json(
        {
          error: 'No active subscription',
          message: 'You need an active subscription to change plans. Please subscribe first.',
        },
        { status: 400 }
      );
    }

    // Get current Stripe subscription
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId
    );

    // Check if already on this plan
    const currentPriceId = stripeSubscription.items.data[0]?.price.id;
    if (currentPriceId === newProduct.priceId) {
      return NextResponse.json(
        { error: 'Already on this plan' },
        { status: 400 }
      );
    }

    // Determine if upgrade or downgrade
    const planOrder = ['free', 'professional', 'business', 'custom'];
    const currentPlanIndex = planOrder.indexOf(subscription.plan);
    const newPlanIndex = planOrder.indexOf(newPlan);
    const isUpgrade = newPlanIndex > currentPlanIndex;

    logger.info('Processing plan change', {
      userId,
      currentPlan: subscription.plan,
      newPlan,
      isUpgrade,
    });

    // Update subscription in Stripe
    const updatedStripeSubscription = await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        items: [
          {
            id: stripeSubscription.items.data[0].id,
            price: newProduct.priceId,
          },
        ],
        proration_behavior: prorationBehavior,
        // If downgrading, apply at end of period
        ...(isUpgrade ? {} : { proration_behavior: 'none' }),
        metadata: {
          userId,
          previousPlan: subscription.plan,
          newPlan,
          changedAt: new Date().toISOString(),
        },
      }
    );

    // Get period from first item
    const firstItem = updatedStripeSubscription.items.data[0];

    // Update local subscription record
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        plan: newPlan,
        stripePriceId: newProduct.priceId,
        // Update limits based on new plan
        maxSocialAccounts: newProduct.features.socialAccounts as number,
        maxAiPosts: newProduct.features.aiPosts as number,
        maxPersonas: newProduct.features.personas as number,
      },
    });

    // Log the plan change
    await auditLogger.log({
      userId,
      action: 'billing.plan_changed',
      resource: 'subscription',
      resourceId: subscription.id,
      category: 'compliance',
      severity: 'medium',
      outcome: 'success',
      details: {
        previousPlan: subscription.plan,
        newPlan,
        isUpgrade,
        prorationBehavior,
      },
    });

    // Calculate proration preview if upgrading
    let prorationPreview: { amount: number; currency: string; periodEnd?: number } | null = null;
    if (isUpgrade && prorationBehavior === 'create_prorations') {
      try {
        // Create invoice preview using the upcoming invoices endpoint
        const previewParams: Stripe.InvoiceCreatePreviewParams = {
          customer: subscription.stripeCustomerId!,
          subscription: subscription.stripeSubscriptionId!,
        };
        const upcomingInvoice = await stripe.invoices.createPreview(previewParams);
        prorationPreview = {
          amount: upcomingInvoice.amount_due,
          currency: upcomingInvoice.currency,
          periodEnd: firstItem?.current_period_end,
        };
      } catch {
        // Proration preview not available
      }
    }

    return NextResponse.json({
      success: true,
      subscription: {
        plan: newPlan,
        status: updatedStripeSubscription.status,
        currentPeriodEnd: firstItem?.current_period_end
          ? new Date(firstItem.current_period_end * 1000).toISOString()
          : null,
      },
      isUpgrade,
      prorationPreview,
      message: isUpgrade
        ? 'Plan upgraded successfully! New features are now available.'
        : 'Plan will be changed at the end of your current billing period.',
    });
  } catch (error) {
    logger.error('Plan change error', { error });
    return NextResponse.json(
      { error: 'Failed to change plan' },
      { status: 500 }
    );
  }
}

/**
 * Preview proration for plan change
 */
export async function GET(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe not configured' },
        { status: 503 }
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

    // Get target plan from query
    const { searchParams } = new URL(request.url);
    const targetPlan = searchParams.get('plan');

    if (!targetPlan || !PRODUCTS[targetPlan as keyof typeof PRODUCTS]) {
      return NextResponse.json(
        { error: 'Invalid plan specified' },
        { status: 400 }
      );
    }

    const targetProduct = PRODUCTS[targetPlan as keyof typeof PRODUCTS];

    // Get current subscription
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription?.stripeSubscriptionId || !subscription.stripeCustomerId) {
      return NextResponse.json({
        canChange: false,
        message: 'No active subscription to change',
      });
    }

    // Get proration preview from Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId
    );

    const previewParams: Stripe.InvoiceCreatePreviewParams = {
      customer: subscription.stripeCustomerId,
      subscription: subscription.stripeSubscriptionId,
      subscription_details: {
        items: [
          {
            id: stripeSubscription.items.data[0].id,
            price: targetProduct.priceId,
          },
        ],
        proration_behavior: 'create_prorations',
      },
    };
    const preview = await stripe.invoices.createPreview(previewParams);

    // Find proration line items
    // Note: Stripe API types vary across versions
    type LineItemWithProration = Stripe.InvoiceLineItem & { proration?: boolean };
    const prorationLines = preview.lines.data.filter(
      (line) => (line as unknown as LineItemWithProration).proration === true
    );

    const prorationAmount = prorationLines.reduce(
      (sum: number, line) => sum + line.amount,
      0
    );

    return NextResponse.json({
      canChange: true,
      currentPlan: subscription.plan,
      targetPlan,
      preview: {
        totalAmount: preview.amount_due,
        prorationAmount,
        currency: preview.currency,
        billingDate: preview.period_end,
        lines: preview.lines.data.map((line) => ({
          description: line.description,
          amount: line.amount,
          isProration: (line as unknown as LineItemWithProration).proration === true,
        })),
      },
    });
  } catch (error) {
    logger.error('Proration preview error', { error });
    return NextResponse.json(
      { error: 'Failed to calculate proration' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
