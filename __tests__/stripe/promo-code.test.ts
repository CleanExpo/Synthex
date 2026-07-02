/**
 * Promo-code service tests (backlog #14).
 *
 * Asserts that:
 *  1. A valid, org-scoped, under-cap code passes validation and builds a Stripe
 *     coupon discount that reduces the checkout (percent + amount variants).
 *  2. An expired code is rejected.
 *  3. A code at/over its usage cap is rejected.
 *  4. A code belonging to another organisation is rejected.
 *  5. recordPromoUsage atomically increments usageCount (capped) and reports
 *     when the cap is already reached.
 */

import type Stripe from 'stripe';

// ============================================================================
// MOCKS — declared before imports
// ============================================================================

const mockFindUnique = jest.fn();
const mockUpdateMany = jest.fn();

const prismaMock = {
  promoCode: {
    findUnique: mockFindUnique,
    updateMany: mockUpdateMany,
  },
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: prismaMock,
  default: prismaMock,
}));

const mockCouponsCreate = jest.fn();

jest.mock('@/lib/stripe/config', () => ({
  stripe: {
    coupons: { create: (...args: unknown[]) => mockCouponsCreate(...args) },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ============================================================================
// IMPORTS (after mocks)
// ============================================================================

import {
  validatePromoCode,
  buildCheckoutDiscount,
  recordPromoUsage,
} from '@/lib/stripe/promo-code';

// ============================================================================
// FIXTURES
// ============================================================================

const ORG = 'org_abc';

function makePromo(
  overrides: Partial<{
    id: string;
    code: string;
    discountType: string;
    discountValue: number;
    usageCap: number;
    usageCount: number;
    active: boolean;
    expiresAt: Date | null;
    organizationId: string;
  }> = {}
) {
  return {
    id: 'promo_1',
    code: 'SAVE20',
    discountType: 'percent',
    discountValue: 20,
    usageCap: 100,
    usageCount: 5,
    active: true,
    expiresAt: null,
    organizationId: ORG,
    createdAt: new Date(),
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('promo-code service (#14)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validatePromoCode', () => {
    it('accepts a valid, org-scoped, under-cap code (case-insensitive)', async () => {
      mockFindUnique.mockResolvedValue(makePromo());

      const result = await validatePromoCode(' save20 ', ORG);

      // Lookup is normalised to upper-case.
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { code: 'SAVE20' },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.promo).toEqual({
          id: 'promo_1',
          code: 'SAVE20',
          discountType: 'percent',
          discountValue: 20,
        });
      }
    });

    it('rejects an unknown code', async () => {
      mockFindUnique.mockResolvedValue(null);
      const result = await validatePromoCode('NOPE', ORG);
      expect(result).toEqual({ ok: false, reason: 'not_found' });
    });

    it('rejects an expired code', async () => {
      mockFindUnique.mockResolvedValue(
        makePromo({ expiresAt: new Date(Date.now() - 1000) })
      );
      const result = await validatePromoCode('SAVE20', ORG);
      expect(result).toEqual({ ok: false, reason: 'expired' });
    });

    it('rejects a code at its usage cap', async () => {
      mockFindUnique.mockResolvedValue(
        makePromo({ usageCap: 10, usageCount: 10 })
      );
      const result = await validatePromoCode('SAVE20', ORG);
      expect(result).toEqual({ ok: false, reason: 'usage_cap_reached' });
    });

    it('rejects a code that belongs to another organisation', async () => {
      mockFindUnique.mockResolvedValue(
        makePromo({ organizationId: 'other_org' })
      );
      const result = await validatePromoCode('SAVE20', ORG);
      expect(result).toEqual({ ok: false, reason: 'wrong_organisation' });
    });

    it('rejects an inactive code', async () => {
      mockFindUnique.mockResolvedValue(makePromo({ active: false }));
      const result = await validatePromoCode('SAVE20', ORG);
      expect(result).toEqual({ ok: false, reason: 'inactive' });
    });

    it('rejects a percent code outside 1–100', async () => {
      mockFindUnique.mockResolvedValue(
        makePromo({ discountType: 'percent', discountValue: 150 })
      );
      const result = await validatePromoCode('SAVE20', ORG);
      expect(result).toEqual({ ok: false, reason: 'invalid_config' });
    });
  });

  describe('buildCheckoutDiscount', () => {
    it('creates a percent-off Stripe coupon and returns it as a discount', async () => {
      mockCouponsCreate.mockResolvedValue({ id: 'coup_pct' });

      const discounts = await buildCheckoutDiscount({
        id: 'promo_1',
        code: 'SAVE20',
        discountType: 'percent',
        discountValue: 20,
      });

      const params = mockCouponsCreate.mock
        .calls[0][0] as Stripe.CouponCreateParams;
      expect(params.percent_off).toBe(20);
      expect(params.amount_off).toBeUndefined();
      expect(params.duration).toBe('once');
      expect(params.max_redemptions).toBe(1);
      expect(discounts).toEqual([{ coupon: 'coup_pct' }]);
    });

    it('creates an amount-off (AUD) coupon for amount-type promos', async () => {
      mockCouponsCreate.mockResolvedValue({ id: 'coup_amt' });

      const discounts = await buildCheckoutDiscount({
        id: 'promo_2',
        code: 'TENOFF',
        discountType: 'amount',
        discountValue: 1000, // $10.00 AUD in cents
      });

      const params = mockCouponsCreate.mock
        .calls[0][0] as Stripe.CouponCreateParams;
      expect(params.amount_off).toBe(1000);
      expect(params.currency).toBe('aud');
      expect(params.percent_off).toBeUndefined();
      expect(discounts).toEqual([{ coupon: 'coup_amt' }]);
    });
  });

  describe('recordPromoUsage', () => {
    it('increments usageCount when a slot is still available', async () => {
      mockFindUnique.mockResolvedValue({ usageCap: 100 });
      mockUpdateMany.mockResolvedValue({ count: 1 });

      const applied = await recordPromoUsage('promo_1');

      expect(applied).toBe(true);
      const call = mockUpdateMany.mock.calls[0][0];
      expect(call.where).toEqual({ id: 'promo_1', usageCount: { lt: 100 } });
      expect(call.data).toEqual({ usageCount: { increment: 1 } });
    });

    it('does not increment past the cap (race-safe no-op)', async () => {
      mockFindUnique.mockResolvedValue({ usageCap: 10 });
      mockUpdateMany.mockResolvedValue({ count: 0 });

      const applied = await recordPromoUsage('promo_1');

      expect(applied).toBe(false);
    });

    it('returns false when the code no longer exists', async () => {
      mockFindUnique.mockResolvedValue(null);
      const applied = await recordPromoUsage('promo_gone');
      expect(applied).toBe(false);
      expect(mockUpdateMany).not.toHaveBeenCalled();
    });
  });
});
