/** @jest-environment node */

/**
 * POST /api/stripe/change-plan — audit ordering. The request is audited before
 * Stripe or the database changes; a failed outcome audit after Stripe changed
 * the plan is reported (audit.recorded false), not turned into a failure.
 */

// Plain functions: the jest config resets jest.fn implementations.
let mockAuditFailOn: string | null = null;
const mockAuditActions: string[] = [];
const mockStripeUpdates: unknown[] = [];

jest.mock('@/lib/security/audit-logger', () => ({
  auditLogger: {
    log: async (e: { action: string }) => {
      mockAuditActions.push(e.action);
      if (e.action === mockAuditFailOn) throw new Error('audit down');
    },
  },
}));

jest.mock('@/lib/stripe/config', () => ({
  PRODUCTS: {
    pro: {
      priceId: 'price_pro',
      features: { socialAccounts: 5, aiPosts: 100, personas: 3 },
    },
  },
  stripe: {
    subscriptions: {
      retrieve: async () => ({
        items: { data: [{ id: 'si_1', price: { id: 'price_starter' } }] },
      }),
      update: async (_id: string, params: unknown) => {
        mockStripeUpdates.push(params);
        return {
          status: 'active',
          items: { data: [{ id: 'si_1', current_period_end: 1 }] },
        };
      },
    },
    invoices: {
      createPreview: async () => ({ amount_due: 0, currency: 'aud' }),
    },
  },
}));

jest.mock('@/lib/prisma', () => {
  const tx = {
    subscription: {
      findUnique: async () => ({
        id: 'sub_1',
        plan: 'starter',
        stripeSubscriptionId: 'stripe_sub_1',
        stripeCustomerId: 'cus_1',
      }),
      update: async () => ({}),
    },
  };
  return {
    prisma: { $transaction: async (fn: (t: unknown) => unknown) => fn(tx) },
  };
});

jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: async () => ({ allowed: true }),
    createSecureResponse: () => new Response(null, { status: 403 }),
  },
  DEFAULT_POLICIES: { AUTHENTICATED_WRITE: {} },
}));
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: async () => 'user-1',
}));
jest.mock('@/lib/middleware/api-rate-limit', () => ({
  billing: (_req: unknown, handler: () => unknown) => handler(),
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: () => {}, error: () => {}, warn: () => {} },
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/stripe/change-plan/route';

const req = () =>
  new NextRequest('http://localhost/api/stripe/change-plan', {
    method: 'POST',
    body: JSON.stringify({ newPlan: 'pro', prorationBehavior: 'none' }),
  });

beforeEach(() => {
  mockAuditFailOn = null;
  mockAuditActions.length = 0;
  mockStripeUpdates.length = 0;
});

describe('POST /api/stripe/change-plan audit ordering', () => {
  it('audits the request, changes the plan, audits the outcome', async () => {
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(mockAuditActions).toEqual([
      'billing.plan_change_requested',
      'billing.plan_changed',
    ]);
    expect(mockStripeUpdates).toHaveLength(1);
    expect((await res.json()).audit).toEqual({ recorded: true });
  });

  it('changes nothing when the request audit fails', async () => {
    mockAuditFailOn = 'billing.plan_change_requested';
    const res = await POST(req());
    expect(res.status).toBe(500);
    expect(mockStripeUpdates).toHaveLength(0);
  });

  it('reports an unaudited outcome instead of a failed plan change', async () => {
    mockAuditFailOn = 'billing.plan_changed';
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(mockStripeUpdates).toHaveLength(1);
    expect((await res.json()).audit).toEqual({ recorded: false });
  });
});
