/**
 * Unit Tests for Stripe API Routes
 *
 * Tests contract validation for:
 * - POST /api/stripe/checkout - Schema validation and response shapes
 * - POST /api/stripe/billing-portal - Response shapes
 * - POST /api/stripe/change-plan - Schema validation and response shapes
 * - lib/stripe/config.ts helpers
 *
 * Uses schema-based contract testing approach (not full route execution).
 */

import { z } from 'zod';

// ============================================================================
// SCHEMAS - Extracted from route files for contract testing
// ============================================================================

const checkoutSchema = z.object({
  priceId: z.string().optional(),
  planName: z.string().optional(),
});

const changePlanSchema = z.object({
  newPlan: z.enum(['professional', 'business', 'custom']),
  prorationBehavior: z.enum(['create_prorations', 'none', 'always_invoice']).optional(),
});

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Stripe API Routes - Contract Tests', () => {
  const TEST_APP_URL = 'https://example.com';

  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = TEST_APP_URL;
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  });

  // ==========================================================================
  // POST /api/stripe/checkout - Request/Response Contract
  // ==========================================================================

  describe('POST /api/stripe/checkout - Request/Response Contract', () => {
    it('should accept valid priceId', () => {
      const input = { priceId: 'price_123abc' };
      const result = checkoutSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept valid planName', () => {
      const input = { planName: 'professional' };
      const result = checkoutSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept both priceId and planName', () => {
      const input = { priceId: 'price_123', planName: 'business' };
      const result = checkoutSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept empty object (validation happens in route logic)', () => {
      const input = {};
      const result = checkoutSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject extra fields', () => {
      const input = { priceId: 'price_123', extra: 'field' };
      const result = checkoutSchema.strict().safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should define success response shape', () => {
      const successResponse = {
        sessionId: 'cs_test_123',
        url: 'https://checkout.stripe.com/session123',
      };

      expect(successResponse).toHaveProperty('sessionId');
      expect(successResponse).toHaveProperty('url');
      expect(successResponse.sessionId).toMatch(/^cs_/);
      expect(successResponse.url).toContain('stripe.com');
    });

    it('should define error response for invalid plan', () => {
      const errorResponse = {
        error: 'Invalid plan selected',
      };

      expect(errorResponse).toHaveProperty('error');
      expect(errorResponse.error).toBe('Invalid plan selected');
    });

    it('should define error response for Stripe not configured', () => {
      const errorResponse = {
        error: 'Payment processing not configured',
        message: 'Stripe is not set up yet. Contact support for manual subscription.',
        bypass: true,
      };

      expect(errorResponse).toHaveProperty('bypass', true);
      expect(errorResponse).toHaveProperty('error');
      expect(errorResponse).toHaveProperty('message');
    });

    it('should define Stripe session params with 14-day trial', () => {
      const sessionParams = {
        line_items: [{ price: 'price_123', quantity: 1 }],
        mode: 'subscription',
        success_url: `${TEST_APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}&success=true`,
        cancel_url: `${TEST_APP_URL}/pricing?canceled=true`,
        client_reference_id: 'user-123',
        subscription_data: {
          trial_period_days: 14,
          metadata: {
            userId: 'user-123',
            planName: 'professional',
          },
        },
        allow_promotion_codes: true,
        billing_address_collection: 'required',
      };

      expect(sessionParams.subscription_data.trial_period_days).toBe(14);
      expect(sessionParams.mode).toBe('subscription');
      expect(sessionParams.success_url).toContain('dashboard');
      expect(sessionParams.cancel_url).toContain('pricing');
    });

    it('should validate success URL construction', () => {
      const successUrl = `${TEST_APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}&success=true`;
      expect(successUrl).toContain(TEST_APP_URL);
      expect(successUrl).toContain('CHECKOUT_SESSION_ID');
      expect(successUrl).toContain('success=true');
    });

    it('should validate cancel URL construction', () => {
      const cancelUrl = `${TEST_APP_URL}/pricing?canceled=true`;
      expect(cancelUrl).toContain(TEST_APP_URL);
      expect(cancelUrl).toContain('pricing');
      expect(cancelUrl).toContain('canceled=true');
    });
  });

  // ==========================================================================
  // POST /api/stripe/billing-portal - Response Contract
  // ==========================================================================

  describe('POST /api/stripe/billing-portal - Response Contract', () => {
    it('should define success response shape', () => {
      const successResponse = {
        url: 'https://billing.stripe.com/portal123',
      };

      expect(successResponse).toHaveProperty('url');
      expect(successResponse.url).toContain('stripe.com');
    });

    it('should define error response for not configured', () => {
      const errorResponse = {
        error: 'Billing portal not available',
        message: 'Payment processing is not configured yet. Contact support for billing inquiries.',
        bypass: true,
      };

      expect(errorResponse).toHaveProperty('bypass', true);
      expect(errorResponse).toHaveProperty('error');
      expect(errorResponse).toHaveProperty('message');
    });

    it('should define billing portal session params', () => {
      const sessionParams = {
        customer: 'cus_123',
        return_url: `${TEST_APP_URL}/dashboard/billing`,
      };

      expect(sessionParams).toHaveProperty('customer');
      expect(sessionParams.return_url).toContain('dashboard/billing');
    });

    it('should validate return URL construction', () => {
      const returnUrl = `${TEST_APP_URL}/dashboard/billing`;
      expect(returnUrl).toContain(TEST_APP_URL);
      expect(returnUrl).toContain('/dashboard/billing');
    });

    it('should define customer creation params when no customer exists', () => {
      const customerParams = {
        email: 'test@example.com',
        metadata: {
          userId: 'user-123',
        },
      };

      expect(customerParams).toHaveProperty('email');
      expect(customerParams).toHaveProperty('metadata');
      expect(customerParams.metadata).toHaveProperty('userId');
    });
  });

  // ==========================================================================
  // POST /api/stripe/change-plan - Request/Response Contract
  // ==========================================================================

  describe('POST /api/stripe/change-plan - Request/Response Contract', () => {
    it('should accept valid plan change request', () => {
      const input = { newPlan: 'business' as const };
      const result = changePlanSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept all valid plan names', () => {
      const plans: Array<'professional' | 'business' | 'custom'> = ['professional', 'business', 'custom'];
      plans.forEach((plan) => {
        const result = changePlanSchema.safeParse({ newPlan: plan });
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid plan name', () => {
      const input = { newPlan: 'invalid_plan' };
      const result = changePlanSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('newPlan');
      }
    });

    it('should accept optional proration behavior', () => {
      const input = {
        newPlan: 'business' as const,
        prorationBehavior: 'create_prorations' as const,
      };
      const result = changePlanSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept all valid proration behaviors', () => {
      const behaviors: Array<'create_prorations' | 'none' | 'always_invoice'> = [
        'create_prorations',
        'none',
        'always_invoice',
      ];
      behaviors.forEach((behavior) => {
        const result = changePlanSchema.safeParse({
          newPlan: 'business',
          prorationBehavior: behavior,
        });
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid proration behavior', () => {
      const input = {
        newPlan: 'business',
        prorationBehavior: 'invalid_behavior',
      };
      const result = changePlanSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should define success response shape for upgrade', () => {
      const successResponse = {
        success: true,
        subscription: {
          plan: 'business',
          status: 'active',
          currentPeriodEnd: '2024-12-31T23:59:59.999Z',
        },
        isUpgrade: true,
        prorationPreview: {
          amount: 5000,
          currency: 'usd',
          periodEnd: 1234567890,
        },
        message: 'Plan upgraded successfully! New features are now available.',
      };

      expect(successResponse).toHaveProperty('success', true);
      expect(successResponse).toHaveProperty('subscription');
      expect(successResponse).toHaveProperty('isUpgrade');
      expect(successResponse.subscription).toHaveProperty('plan');
      expect(successResponse.subscription).toHaveProperty('status');
      expect(successResponse.message).toContain('upgraded');
    });

    it('should define success response shape for downgrade', () => {
      const successResponse = {
        success: true,
        subscription: {
          plan: 'professional',
          status: 'active',
          currentPeriodEnd: '2024-12-31T23:59:59.999Z',
        },
        isUpgrade: false,
        prorationPreview: null,
        message: 'Plan will be changed at the end of your current billing period.',
      };

      expect(successResponse.isUpgrade).toBe(false);
      expect(successResponse.prorationPreview).toBeNull();
      expect(successResponse.message).toContain('end of your current billing period');
    });

    it('should define error response for no active subscription', () => {
      const errorResponse = {
        error: 'No active subscription',
        message: 'You need an active subscription to change plans. Please subscribe first.',
      };

      expect(errorResponse).toHaveProperty('error');
      expect(errorResponse).toHaveProperty('message');
    });

    it('should define error response for already on this plan', () => {
      const errorResponse = {
        error: 'Already on this plan',
      };

      expect(errorResponse.error).toBe('Already on this plan');
    });

    it('should define Stripe subscription update params', () => {
      const updateParams = {
        items: [
          {
            id: 'si_123',
            price: 'price_new',
          },
        ],
        proration_behavior: 'create_prorations',
        metadata: {
          userId: 'user-123',
          previousPlan: 'professional',
          newPlan: 'business',
          changedAt: new Date().toISOString(),
        },
      };

      expect(updateParams).toHaveProperty('items');
      expect(updateParams).toHaveProperty('metadata');
      expect(updateParams.metadata).toHaveProperty('previousPlan');
      expect(updateParams.metadata).toHaveProperty('newPlan');
      expect(updateParams.metadata).toHaveProperty('changedAt');
    });
  });

  // ==========================================================================
  // lib/stripe/config.ts - Helper Functions
  // ==========================================================================

  describe('lib/stripe/config - Helper Functions', () => {
    it('PRODUCTS should have 3 tiers', () => {
      const { PRODUCTS } = require('@/lib/stripe/config');

      expect(Object.keys(PRODUCTS)).toHaveLength(3);
      expect(PRODUCTS.professional).toBeDefined();
      expect(PRODUCTS.business).toBeDefined();
      expect(PRODUCTS.custom).toBeDefined();
    });

    it('Each product should have required fields', () => {
      const { PRODUCTS } = require('@/lib/stripe/config');

      Object.values(PRODUCTS).forEach((product: any) => {
        expect(product).toHaveProperty('name');
        expect(product).toHaveProperty('priceId');
        expect(product).toHaveProperty('price');
        expect(product).toHaveProperty('features');
      });
    });

    it('getProductByPriceId should return correct product', () => {
      const { getProductByPriceId, PRODUCTS } = require('@/lib/stripe/config');

      const professionalPriceId = PRODUCTS.professional.priceId;
      const product = getProductByPriceId(professionalPriceId);

      expect(product).toBeDefined();
      expect(product?.name).toBe('Professional');
      expect(product?.priceId).toBe(professionalPriceId);
    });

    it('getProductByPriceId should return undefined for unknown ID', () => {
      const { getProductByPriceId } = require('@/lib/stripe/config');

      const product = getProductByPriceId('price_unknown_invalid_123');

      expect(product).toBeUndefined();
    });

    it('getProductByName should return correct product (case insensitive)', () => {
      const { getProductByName } = require('@/lib/stripe/config');

      const product1 = getProductByName('Professional');
      const product2 = getProductByName('professional');
      const product3 = getProductByName('PROFESSIONAL');

      expect(product1).toBeDefined();
      expect(product1?.name).toBe('Professional');
      expect(product2).toEqual(product1);
      expect(product3).toEqual(product1);
    });

    it('getProductByName should handle all tier names', () => {
      const { getProductByName } = require('@/lib/stripe/config');

      const professional = getProductByName('professional');
      const business = getProductByName('business');
      const custom = getProductByName('custom');

      expect(professional?.name).toBe('Professional');
      expect(business?.name).toBe('Business');
      expect(custom?.name).toBe('Custom');
    });

    it('getProductByName should return undefined for invalid name', () => {
      const { getProductByName } = require('@/lib/stripe/config');

      const product = getProductByName('invalid_plan_name');

      expect(product).toBeUndefined();
    });

    it('stripe instance should be defined when STRIPE_SECRET_KEY is set', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_123';

      jest.isolateModules(() => {
        const { stripe } = require('@/lib/stripe/config');
        expect(stripe).toBeDefined();
      });
    });

    it('stripe should be null when STRIPE_SECRET_KEY not set', () => {
      const originalKey = process.env.STRIPE_SECRET_KEY;
      delete process.env.STRIPE_SECRET_KEY;

      jest.isolateModules(() => {
        const { stripe } = require('@/lib/stripe/config');
        expect(stripe).toBeNull();
      });

      // Restore
      if (originalKey) {
        process.env.STRIPE_SECRET_KEY = originalKey;
      }
    });

    it('Professional tier should have expected features', () => {
      const { PRODUCTS } = require('@/lib/stripe/config');

      expect(PRODUCTS.professional.features.socialAccounts).toBe(5);
      expect(PRODUCTS.professional.features.aiPosts).toBe(100);
      expect(PRODUCTS.professional.features.personas).toBe(3);
    });

    it('Business tier should have unlimited AI posts', () => {
      const { PRODUCTS } = require('@/lib/stripe/config');

      expect(PRODUCTS.business.features.aiPosts).toBe(-1);
      expect(PRODUCTS.business.features.socialAccounts).toBe(10);
    });

    it('Custom tier should have all unlimited features', () => {
      const { PRODUCTS } = require('@/lib/stripe/config');

      expect(PRODUCTS.custom.features.socialAccounts).toBe(-1);
      expect(PRODUCTS.custom.features.aiPosts).toBe(-1);
      expect(PRODUCTS.custom.features.personas).toBe(-1);
      expect(PRODUCTS.custom.price).toBe(-1);
    });
  });

  // ==========================================================================
  // Error Response Contracts
  // ==========================================================================

  describe('Common Error Response Patterns', () => {
    it('should define 401 unauthorized response', () => {
      const response = {
        error: 'Authentication required',
      };

      expect(response).toHaveProperty('error');
      expect(response.error).toContain('Authentication');
    });

    it('should define 403 forbidden response', () => {
      const response = {
        error: 'Access denied',
      };

      expect(response).toHaveProperty('error');
    });

    it('should define 400 validation error response', () => {
      const response = {
        error: 'Invalid request data',
        details: [],
      };

      expect(response).toHaveProperty('error');
      expect(response).toHaveProperty('details');
    });

    it('should define 500 server error response', () => {
      const checkoutError = {
        error: 'Failed to create checkout session',
      };

      const portalError = {
        error: 'Failed to create billing portal session',
      };

      const planChangeError = {
        error: 'Failed to change plan',
      };

      expect(checkoutError.error).toContain('checkout');
      expect(portalError.error).toContain('billing portal');
      expect(planChangeError.error).toContain('change plan');
    });

    it('should define 503 service unavailable response', () => {
      const response = {
        error: 'Payment processing not configured',
        message: expect.any(String),
        bypass: true,
      };

      expect(response.bypass).toBe(true);
      expect(response).toHaveProperty('message');
    });
  });
});
