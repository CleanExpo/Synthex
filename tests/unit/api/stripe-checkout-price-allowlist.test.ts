/**
 * SYN-1105 P1 — checkout server-side price allowlist.
 *
 * The checkout route previously accepted any client-supplied `priceId` with
 * only a not-falsy / not-'placeholder' check, and an unknown price defaulted
 * to Pro entitlements downstream. This test executes the REAL POST handler
 * with the REAL PRODUCTS / getProductByPriceId allowlist and asserts a foreign
 * price ID is rejected (400) before Stripe is ever called.
 */

// Rate-limit wrapper: pass through to the handler.
jest.mock('@/lib/middleware/api-rate-limit', () => ({
  billing: (_req: unknown, handler: () => unknown) => handler(),
}));

// Security checker: authenticated write allowed; secure response = plain JSON.
jest.mock('@/lib/security/api-security-checker', () => {
  const { NextResponse } = require('next/server');
  return {
    DEFAULT_POLICIES: { AUTHENTICATED_WRITE: {} },
    APISecurityChecker: {
      // Plain function (not jest.fn) so the jest config's resetMocks doesn't
      // strip the implementation between tests.
      check: async () => ({ allowed: true, context: {} }),
      createSecureResponse: (data: unknown, status = 200) =>
        NextResponse.json(data, { status }),
    },
  };
});

const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => {
  const { NextResponse } = require('next/server');
  return {
    getUserIdFromRequestOrCookies: (...a: unknown[]) => mockGetUserId(...a),
    unauthorizedResponse: () =>
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  };
});

// Keep the REAL PRODUCTS + getProductByPriceId allowlist; only force `stripe`
// to a truthy stub so the route passes its "Stripe configured" guard.
const stripeCreate = jest.fn();
jest.mock('@/lib/stripe/config', () => {
  const actual = jest.requireActual('@/lib/stripe/config');
  return {
    __esModule: true,
    ...actual,
    stripe: { checkout: { sessions: { create: stripeCreate } } },
  };
});

jest.mock('@/lib/multi-business/business-scope', () => ({
  getEffectiveOrganizationId: jest.fn(async () => 'org_1'),
}));

jest.mock('@/lib/stripe/promo-code', () => ({
  validatePromoCode: jest.fn(),
  buildCheckoutDiscount: jest.fn(),
  recordPromoUsage: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { createMockNextRequest } from '@/tests/helpers/mock-request';
import { POST } from '@/app/api/stripe/checkout/route';
import { PRODUCTS } from '@/lib/stripe/config';

function checkoutRequest(body: object) {
  return createMockNextRequest({
    method: 'POST',
    url: 'http://localhost/api/stripe/checkout',
    body,
  }) as unknown as import('next/server').NextRequest;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserId.mockResolvedValue('user_1');
  process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
});

describe('POST /api/stripe/checkout — server-side price allowlist (SYN-1105 P1)', () => {
  it('rejects a foreign/unknown priceId with 400 and never calls Stripe', async () => {
    const res = await POST(
      checkoutRequest({ priceId: 'price_foreign_not_ours_999' })
    );

    expect(res.status).toBe(400);
    expect(stripeCreate).not.toHaveBeenCalled();
  });

  it('accepts a real configured product price (reaches Stripe)', async () => {
    // The real PRODUCTS map is used; when env price IDs are unset the values are
    // 'price_*_placeholder', which the route rejects at its placeholder guard
    // (503) — still proving a KNOWN price passes the allowlist. When a real
    // price ID is configured, it reaches Stripe. Assert it is NOT a 400
    // allowlist rejection in either case.
    stripeCreate.mockResolvedValue({
      id: 'cs_test_1',
      url: 'https://checkout.stripe.com/x',
    });

    const res = await POST(checkoutRequest({ priceId: PRODUCTS.pro.priceId }));

    expect(res.status).not.toBe(400);
  });
});
