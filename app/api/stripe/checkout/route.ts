/**
 * ENVIRONMENT VARIABLES REQUIRED:
 * - STRIPE_SECRET_KEY: Stripe secret key for API operations (CRITICAL)
 * - NEXT_PUBLIC_APP_URL: Application URL for redirects (PUBLIC)
 * - JWT_SECRET: For verifying user authentication (CRITICAL)
 *
 * FAILURE MODE: Returns error response if missing
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import Stripe from 'stripe';
import { stripe, PRODUCTS, isBasePlanPriceId } from '@/lib/stripe/config';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import {
  validatePromoCode,
  buildCheckoutDiscount,
  recordPromoUsage,
} from '@/lib/stripe/promo-code';
import { billing } from '@/lib/middleware/api-rate-limit';
import { logger } from '@/lib/logger';

const checkoutSchema = z.object({
  priceId: z.string().optional(),
  planName: z.string().optional(),
  promoCode: z.string().trim().min(1).max(64).optional(),
});

export async function POST(request: NextRequest) {
  // Distributed rate limiting via Upstash Redis
  return billing(request, async () => {
    try {
      // Check if Stripe is configured
      if (!stripe) {
        return NextResponse.json(
          {
            error: 'Payment processing not configured',
            message:
              'Stripe is not set up yet. Contact support for manual subscription.',
            bypass: true,
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

      const rawBody = await request.json();
      const validation = checkoutSchema.safeParse(rawBody);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Invalid request data', details: validation.error.issues },
          { status: 400 }
        );
      }
      const { priceId, planName, promoCode } = validation.data;

      // Validate the plan
      const product = planName
        ? PRODUCTS[planName.toLowerCase() as keyof typeof PRODUCTS]
        : null;
      const finalPriceId = priceId || product?.priceId;

      if (!finalPriceId) {
        return NextResponse.json(
          { error: 'Invalid plan selected' },
          { status: 400 }
        );
      }

      // Server-side price allowlist (fail closed). Only the BASE subscription
      // price of a configured product in PRODUCTS may open a subscription — a
      // client cannot submit an arbitrary/foreign `priceId`, NOR an add-on
      // `tierPriceId` (e.g. the Enterprise per-location $99 add-on) as the sole
      // line item to buy the full tier's entitlement for the add-on price. This
      // also prevents an unknown price from being defaulted downstream
      // (see lib/stripe/subscription-service.ts).
      if (!isBasePlanPriceId(finalPriceId)) {
        logger.warn('Rejected checkout with unknown price ID', {
          priceId: finalPriceId,
          planName,
          userId,
        });
        return NextResponse.json(
          { error: 'Invalid plan selected' },
          { status: 400 }
        );
      }

      // Guard against placeholder price IDs that would cause Stripe API errors
      if (finalPriceId.includes('placeholder')) {
        logger.error('Stripe checkout attempted with placeholder price ID', {
          priceId: finalPriceId,
          planName,
          userId,
        });
        return NextResponse.json(
          {
            error: 'Billing not fully configured',
            message:
              'Subscription plans have not been set up in Stripe yet. Contact support.',
            bypass: true,
          },
          { status: 503 }
        );
      }

      const isIntroductory = planName?.toLowerCase() === 'introductory';

      // Promo / discount code (backlog #14). Validate org-scoped, then hand
      // Stripe a coupon so it reduces the checkout — never reduce the price
      // ourselves. `discounts` and `allow_promotion_codes` are mutually
      // exclusive, so a validated code replaces the open promotion-code field.
      let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
      let redeemedPromoId: string | undefined;
      if (promoCode) {
        const orgId = await getEffectiveOrganizationId(userId);
        if (!orgId) {
          return NextResponse.json(
            { error: 'No organisation context found' },
            { status: 403 }
          );
        }
        const result = await validatePromoCode(promoCode, orgId);
        if (!result.ok) {
          return NextResponse.json(
            { error: 'Invalid promo code', reason: result.reason },
            { status: 400 }
          );
        }
        discounts = await buildCheckoutDiscount(result.promo);
        redeemedPromoId = result.promo.id;
      }

      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price: finalPriceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}&success=true`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
        client_reference_id: userId,
        metadata: {
          userId,
          planName: product?.name || planName,
          ...(isIntroductory ? { isIntroductory: 'true' } : {}),
          ...(redeemedPromoId ? { promoCode: promoCode! } : {}),
        },
        // Apply our org-scoped coupon, OR fall back to Stripe's open
        // promotion-code field when no code was submitted (mutually exclusive).
        ...(discounts ? { discounts } : { allow_promotion_codes: true }),
        billing_address_collection: 'required',
        subscription_data: {
          trial_period_days: 14, // 14-day free trial
          metadata: {
            userId,
            planName: product?.name || planName,
            ...(isIntroductory ? { isIntroductory: 'true' } : {}),
          },
        },
      } as Stripe.Checkout.SessionCreateParams);

      // Session created — count the redemption. Capped + race-safe; a failure
      // here must not undo a created checkout, so we log and continue.
      if (redeemedPromoId) {
        try {
          await recordPromoUsage(redeemedPromoId);
        } catch (usageError) {
          logger.error('Failed to record promo usage', {
            promoId: redeemedPromoId,
            error: usageError,
          });
        }
      }

      return NextResponse.json({
        sessionId: session.id,
        url: session.url,
      });
    } catch (error) {
      logger.error('Stripe checkout error', { error });
      return NextResponse.json(
        { error: 'Failed to create checkout session' },
        { status: 500 }
      );
    }
  });
}
