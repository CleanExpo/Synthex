/**
 * Promo-code service (backlog #14) — validate + apply org-scoped discount codes
 * at Stripe checkout.
 *
 * A submitted code is validated against the org-scoped `PromoCode` row (active,
 * not expired, under its usage cap), translated into a single-use Stripe coupon,
 * and returned as a checkout `discounts` entry. On a successful checkout-session
 * create the caller calls `recordPromoUsage` to atomically increment usageCount —
 * the increment is itself capped so a race cannot push usageCount past usageCap.
 *
 * discountType:
 *   - 'percent' → discountValue is 1–100 (% off)
 *   - 'amount'  → discountValue is cents AUD off the subtotal
 *
 * Stripe is the source of truth for the actual discount maths; we never hardcode
 * a price reduction — we hand Stripe a coupon and let it reduce the checkout.
 */

import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe/config';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/** Currency used for `amount`-type coupons. AUD per project convention. */
const PROMO_CURRENCY = 'aud';

/** Reason a code failed validation (machine-readable, for the API response). */
export type PromoRejectionReason =
  | 'not_found'
  | 'inactive'
  | 'expired'
  | 'usage_cap_reached'
  | 'wrong_organisation'
  | 'invalid_config';

export interface PromoValidationSuccess {
  ok: true;
  promo: {
    id: string;
    code: string;
    discountType: 'percent' | 'amount';
    discountValue: number;
  };
}

export interface PromoValidationFailure {
  ok: false;
  reason: PromoRejectionReason;
}

export type PromoValidationResult =
  | PromoValidationSuccess
  | PromoValidationFailure;

/**
 * Validate a submitted promo code for an organisation.
 *
 * Checks, in order: existence → org ownership → active → not expired → under
 * usage cap → sane config. Returns a discriminated result; never throws on a
 * "code just isn't valid" outcome (only a genuine DB failure propagates).
 *
 * @param code  the raw code the customer submitted (matched case-insensitively
 *              by upper-casing — codes are stored upper-case by convention but
 *              we normalise the lookup to be forgiving).
 * @param organizationId  the redeeming org; a code from another org is rejected.
 */
export async function validatePromoCode(
  code: string,
  organizationId: string
): Promise<PromoValidationResult> {
  const normalised = code.trim().toUpperCase();

  const promo = await prisma.promoCode.findUnique({
    where: { code: normalised },
  });

  if (!promo) return { ok: false, reason: 'not_found' };
  if (promo.organizationId !== organizationId) {
    // Do not leak that the code exists for another org — same outward shape.
    return { ok: false, reason: 'wrong_organisation' };
  }
  if (!promo.active) return { ok: false, reason: 'inactive' };
  if (promo.expiresAt && promo.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: 'expired' };
  }
  if (promo.usageCount >= promo.usageCap) {
    return { ok: false, reason: 'usage_cap_reached' };
  }

  const discountType = promo.discountType;
  if (discountType !== 'percent' && discountType !== 'amount') {
    return { ok: false, reason: 'invalid_config' };
  }
  if (discountType === 'percent' && (promo.discountValue < 1 || promo.discountValue > 100)) {
    return { ok: false, reason: 'invalid_config' };
  }
  if (discountType === 'amount' && promo.discountValue < 1) {
    return { ok: false, reason: 'invalid_config' };
  }

  return {
    ok: true,
    promo: {
      id: promo.id,
      code: promo.code,
      discountType,
      discountValue: promo.discountValue,
    },
  };
}

/**
 * Translate a validated promo into a Stripe checkout `discounts` array by
 * creating a single-redemption Stripe coupon. The returned value is dropped
 * straight onto `checkout.sessions.create({ discounts })`.
 *
 * Note: `discounts` and `allow_promotion_codes` are mutually exclusive in the
 * Stripe API — the caller drops `allow_promotion_codes` when a discount is
 * applied this way.
 *
 * @throws if Stripe is not configured — callers already guard on `stripe`.
 */
export async function buildCheckoutDiscount(
  promo: PromoValidationSuccess['promo']
): Promise<Stripe.Checkout.SessionCreateParams.Discount[]> {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  const couponParams: Stripe.CouponCreateParams = {
    name: `Synthex promo ${promo.code}`,
    duration: 'once',
    max_redemptions: 1,
    metadata: { promoCode: promo.code },
    ...(promo.discountType === 'percent'
      ? { percent_off: promo.discountValue }
      : { amount_off: promo.discountValue, currency: PROMO_CURRENCY }),
  };

  const coupon = await stripe.coupons.create(couponParams);
  return [{ coupon: coupon.id }];
}

/**
 * Atomically increment usageCount for a redeemed promo, capped at usageCap so a
 * concurrent redemption cannot push the count past the cap. Returns true if the
 * increment was applied (a slot was still available), false if the cap had
 * already been reached between validation and this call (or the code vanished).
 *
 * Prisma cannot compare two columns (usageCount < usageCap) inside a `where`, so
 * the cap is read once and used as a concrete `lt` bound on a conditional
 * `updateMany`. The DB only bumps the row when usageCount is still below that
 * bound, so two concurrent redemptions on the last slot can't both succeed.
 *
 * Fire-and-forget-safe: callers may ignore the boolean, but should not let a
 * failure here block the checkout response — a logged warning is sufficient.
 */
export async function recordPromoUsage(promoId: string): Promise<boolean> {
  const promo = await prisma.promoCode.findUnique({
    where: { id: promoId },
    select: { usageCap: true },
  });
  if (!promo) {
    logger.warn('promo-code: usage increment skipped (code not found)', { promoId });
    return false;
  }

  const result = await prisma.promoCode.updateMany({
    where: { id: promoId, usageCount: { lt: promo.usageCap } },
    data: { usageCount: { increment: 1 } },
  });
  if (result.count === 0) {
    logger.warn('promo-code: usage increment skipped (cap reached)', { promoId });
    return false;
  }
  return true;
}
