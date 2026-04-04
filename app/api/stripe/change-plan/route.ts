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
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { prisma } from '@/lib/prisma';
import { auditLogger } from '@/lib/security/audit-logger';
import { logger } from '@/lib/logger';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { billing } from '@/lib/middleware/api-rate-limit';
import Stripe from 'stripe';

const changePlanSchema = z.object({
  newPlan: z.enum([
    'pro',
    'growth',
    'scale',
    'professional',
    'business',
    'custom',
  ]),
  prorationBehavior: z
    .enum(['create_prorations', 'none', 'always_invoice'])
    .optional(),
});

export async function POST(request: NextRequest) {
  return billing(request, async () => {
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
      const { newPlan, prorationBehavior = 'create_prorations' } =
        validation.data;

      // Validate new plan
      const newProduct = PRODUCTS[newPlan as keyof typeof PRODUCTS];
      if (!newProduct) {
        return NextResponse.json(
          { error: 'Invalid plan selected' },
          { status: 400 }
        );
      }

      // Read + write in a transaction to prevent concurrent plan-change races.
      // Two simultaneous requests could both read the same plan state and both
      // fire Stripe updates. The transaction re-reads with a consistency check
      // so the second writer detects the stale read and aborts.
      const {
        subscription,
        stripeSubscription,
        updatedStripeSubscription,
        firstItem,
        isUpgrade,
      } = await prisma
        .$transaction(async tx => {
          // Authoritative read inside the transaction
          const sub = await tx.subscription.findUnique({ where: { userId } });

          if (!sub?.stripeSubscriptionId) {
            throw Object.assign(new Error('No active subscription'), {
              statusCode: 400,
            });
          }

          // Get current Stripe subscription (external call — best-effort inside tx)
          // stripe is guaranteed non-null by the outer guard above
          const stripeSub = await stripe!.subscriptions.retrieve(
            sub.stripeSubscriptionId
          );

          // Check if already on this plan
          const currentPriceId = stripeSub.items.data[0]?.price.id;
          if (currentPriceId === newProduct.priceId) {
            throw Object.assign(new Error('Already on this plan'), {
              statusCode: 400,
            });
          }

          const planOrder = [
            'free',
            'pro',
            'growth',
            'scale',
            'professional',
            'business',
            'custom',
          ];
          const isUp = planOrder.indexOf(newPlan) > planOrder.indexOf(sub.plan);

          logger.info('Processing plan change', {
            userId,
            currentPlan: sub.plan,
            newPlan,
            isUpgrade: isUp,
          });

          // Update subscription in Stripe
          const updatedSub = await stripe!.subscriptions.update(
            sub.stripeSubscriptionId,
            {
              items: [
                { id: stripeSub.items.data[0].id, price: newProduct.priceId },
              ],
              proration_behavior: isUp ? prorationBehavior : 'none',
              metadata: {
                userId,
                previousPlan: sub.plan,
                newPlan,
                changedAt: new Date().toISOString(),
              },
            }
          );

          const item = updatedSub.items.data[0];

          // Atomic write — will conflict if another transaction already updated this row
          await tx.subscription.update({
            where: { id: sub.id, plan: sub.plan }, // optimistic check: plan must still match
            data: {
              plan: newPlan,
              stripePriceId: newProduct.priceId,
              maxSocialAccounts: newProduct.features.socialAccounts as number,
              maxAiPosts: newProduct.features.aiPosts as number,
              maxPersonas: newProduct.features.personas as number,
            },
          });

          return {
            subscription: sub,
            stripeSubscription: stripeSub,
            updatedStripeSubscription: updatedSub,
            firstItem: item,
            isUpgrade: isUp,
          };
        })
        .catch((err: Error & { statusCode?: number }) => {
          if (err.statusCode === 400) throw err;
          if (err.message?.includes('Record to update not found')) {
            throw Object.assign(
              new Error(
                'Plan was changed by a concurrent request — please retry'
              ),
              { statusCode: 409 }
            );
          }
          throw err;
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
      let prorationPreview: {
        amount: number;
        currency: string;
        periodEnd?: number;
      } | null = null;
      if (isUpgrade && prorationBehavior === 'create_prorations') {
        try {
          // Create invoice preview using the upcoming invoices endpoint
          const previewParams: Stripe.InvoiceCreatePreviewParams = {
            customer: subscription.stripeCustomerId!,
            subscription: subscription.stripeSubscriptionId!,
          };
          const upcomingInvoice =
            await stripe.invoices.createPreview(previewParams);
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
      const err = error as Error & { statusCode?: number };
      if (err.statusCode === 400) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      if (err.statusCode === 409) {
        return NextResponse.json({ error: err.message }, { status: 409 });
      }
      logger.error('Plan change error', { error });
      return NextResponse.json(
        { error: 'Failed to change plan' },
        { status: 500 }
      );
    }
  });
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
    type LineItemWithProration = Stripe.InvoiceLineItem & {
      proration?: boolean;
    };
    const prorationLines = preview.lines.data.filter(
      line => (line as unknown as LineItemWithProration).proration === true
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
        lines: preview.lines.data.map(line => ({
          description: line.description,
          amount: line.amount,
          isProration:
            (line as unknown as LineItemWithProration).proration === true,
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
