/**
 * DunningState lifecycle tests — Phase 3 PR 3
 *
 * Asserts that:
 *  1. invoice.payment_failed with attempt_count < 4 creates a `past_due` row.
 *  2. invoice.payment_failed with attempt_count >= 4 creates an `unpaid` row.
 *  3. A subsequent invoice.payment_failed updates the existing row.
 *  4. invoice.payment_succeeded on an existing dunning row marks it `recovered`.
 *  5. invoice.payment_succeeded with no prior dunning row is a no-op.
 *  6. A Prisma error inside the dunning upsert does NOT throw out of the
 *     handler (must not block Stripe webhook ack).
 *
 * @phase Synthex Phase 3 — Customer Self-Service
 * @mandate 493b042a-521c-44af-9cb2-43505593b65c
 */

import type Stripe from 'stripe';
import type { WebhookEvent } from '@/lib/webhooks/types';

// ============================================================================
// MOCKS — declared before imports
// ============================================================================

const mockWebhookHandlerOn = jest.fn();
const mockWebhookHandlerReceive = jest.fn();
const mockWebhookHandlerRegister = jest.fn();

jest.mock('@/lib/webhooks/webhook-handler', () => ({
  webhookHandler: {
    on: mockWebhookHandlerOn,
    receive: mockWebhookHandlerReceive,
    register: mockWebhookHandlerRegister,
  },
}));

const mockGetByStripeCustomerId = jest.fn();

jest.mock('@/lib/stripe/subscription-service', () => ({
  subscriptionService: {
    getByStripeCustomerId: mockGetByStripeCustomerId,
    updateFromStripeSubscription: jest.fn(),
    downgradeToFree: jest.fn(),
  },
}));

const mockAuditLog = jest.fn();
jest.mock('@/lib/security/audit-logger', () => ({
  auditLogger: { log: mockAuditLog },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockDunningUpsert = jest.fn();
const mockDunningFindUnique = jest.fn();
const mockDunningUpdate = jest.fn();
const mockUserFindUnique = jest.fn();

const prismaMock = {
  user: { findUnique: mockUserFindUnique },
  dunningState: {
    upsert: mockDunningUpsert,
    findUnique: mockDunningFindUnique,
    update: mockDunningUpdate,
  },
};

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock, default: prismaMock }));

jest.mock('@/lib/email/billing-emails', () => ({
  sendPaymentReceiptEmail: jest.fn(),
  sendPaymentFailedEmail: jest.fn(),
  sendSubscriptionCancelledEmail: jest.fn(),
}));

jest.mock('@/lib/unite-hub-connector', () => ({
  pushUniteHubEvent: jest.fn(),
}));

jest.mock('@/lib/stripe/config', () => ({
  stripe: null,
  PRODUCTS: {},
  getProductByPriceId: jest.fn(),
}));

// ============================================================================
// IMPORTS (after mocks)
// ============================================================================

import {
  handlePaymentFailed,
  handlePaymentSucceeded,
} from '@/lib/stripe/webhook-handlers';

// ============================================================================
// FIXTURES
// ============================================================================

function makeFailedInvoiceEvent(overrides: {
  attemptCount?: number;
  nextPaymentAttempt?: number | null;
} = {}): WebhookEvent {
  // Default nextPaymentAttempt to the test fixture timestamp ONLY if the
  // override key is absent. `null` must pass through verbatim.
  const nextAttempt =
    'nextPaymentAttempt' in overrides
      ? overrides.nextPaymentAttempt
      : 1747353600;

  const invoice = {
    id: 'in_test_123',
    object: 'invoice',
    customer: 'cus_test_123',
    amount_due: 9900,
    currency: 'usd',
    attempt_count: overrides.attemptCount ?? 1,
    next_payment_attempt: nextAttempt,
    subscription: 'sub_test_123',
  } as unknown as Stripe.Invoice;

  // Shape matches getWebhookData() — { id, type, data: { id, object, type, data: { object } } }
  return {
    id: 'evt_test',
    type: 'invoice.payment_failed',
    data: {
      id: 'evt_test',
      object: 'event',
      type: 'invoice.payment_failed',
      data: { object: invoice },
    },
  } as unknown as WebhookEvent;
}

function makeSucceededInvoiceEvent(): WebhookEvent {
  const invoice = {
    id: 'in_test_456',
    object: 'invoice',
    customer: 'cus_test_123',
    amount_paid: 9900,
    currency: 'usd',
    subscription: 'sub_test_123',
  } as unknown as Stripe.Invoice;

  return {
    id: 'evt_test',
    type: 'invoice.payment_succeeded',
    data: {
      id: 'evt_test',
      object: 'event',
      type: 'invoice.payment_succeeded',
      data: { object: invoice },
    },
  } as unknown as WebhookEvent;
}

const SUB_FIXTURE = {
  id: 'sub_internal_abc',
  userId: 'user_abc',
  plan: 'pro',
  status: 'past_due',
  cancelAtPeriodEnd: false,
  limits: { socialAccounts: 5, aiPosts: 100, personas: 3 },
  usage: { aiPosts: 0, lastResetAt: new Date() },
};

// ============================================================================
// TESTS
// ============================================================================

describe('DunningState lifecycle (PR 3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetByStripeCustomerId.mockResolvedValue(SUB_FIXTURE);
    mockUserFindUnique.mockResolvedValue({
      email: 'user@example.com',
      name: 'Test User',
    });
    mockDunningUpsert.mockResolvedValue({});
    mockDunningFindUnique.mockResolvedValue(null);
    mockDunningUpdate.mockResolvedValue({});
  });

  it('creates past_due row on first failure (attempt_count=1)', async () => {
    await handlePaymentFailed(makeFailedInvoiceEvent({ attemptCount: 1 }));

    expect(mockDunningUpsert).toHaveBeenCalledTimes(1);
    const call = mockDunningUpsert.mock.calls[0][0];
    expect(call.where).toEqual({ subscriptionId: 'sub_internal_abc' });
    expect(call.create.state).toBe('past_due');
    expect(call.create.failedAttempts).toBe(1);
    expect(call.update.state).toBe('past_due');
    expect(call.update.recoveredAt).toBeNull();
  });

  it('creates unpaid row after 4+ failed attempts', async () => {
    await handlePaymentFailed(makeFailedInvoiceEvent({ attemptCount: 4 }));

    const call = mockDunningUpsert.mock.calls[0][0];
    expect(call.create.state).toBe('unpaid');
    expect(call.update.state).toBe('unpaid');
  });

  it('records nextRetryAt from invoice.next_payment_attempt', async () => {
    await handlePaymentFailed(
      makeFailedInvoiceEvent({
        attemptCount: 2,
        nextPaymentAttempt: 1747353600,
      })
    );
    const call = mockDunningUpsert.mock.calls[0][0];
    expect(call.create.nextRetryAt).toEqual(new Date(1747353600 * 1000));
  });

  it('handles null next_payment_attempt gracefully', async () => {
    await handlePaymentFailed(
      makeFailedInvoiceEvent({ attemptCount: 1, nextPaymentAttempt: null })
    );
    const call = mockDunningUpsert.mock.calls[0][0];
    expect(call.create.nextRetryAt).toBeNull();
  });

  it('marks DunningState recovered when payment succeeds after past_due', async () => {
    mockDunningFindUnique.mockResolvedValue({
      subscriptionId: 'sub_internal_abc',
      state: 'past_due',
    });

    await handlePaymentSucceeded(makeSucceededInvoiceEvent());

    expect(mockDunningUpdate).toHaveBeenCalledTimes(1);
    const call = mockDunningUpdate.mock.calls[0][0];
    expect(call.where).toEqual({ subscriptionId: 'sub_internal_abc' });
    expect(call.data.state).toBe('recovered');
    expect(call.data.recoveredAt).toBeInstanceOf(Date);
    expect(call.data.nextRetryAt).toBeNull();
  });

  it('is a no-op on payment_succeeded with no prior dunning row', async () => {
    mockDunningFindUnique.mockResolvedValue(null);

    await handlePaymentSucceeded(makeSucceededInvoiceEvent());

    expect(mockDunningUpdate).not.toHaveBeenCalled();
  });

  it('does not re-mark an already-recovered row', async () => {
    mockDunningFindUnique.mockResolvedValue({
      subscriptionId: 'sub_internal_abc',
      state: 'recovered',
    });
    await handlePaymentSucceeded(makeSucceededInvoiceEvent());
    expect(mockDunningUpdate).not.toHaveBeenCalled();
  });

  it('does not throw if dunning upsert fails (webhook ack must not block)', async () => {
    mockDunningUpsert.mockRejectedValue(new Error('DB down'));

    await expect(
      handlePaymentFailed(makeFailedInvoiceEvent({ attemptCount: 1 }))
    ).resolves.not.toThrow();
  });
});
