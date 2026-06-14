/**
 * receiveAndProcess — billing-integrity retry/idempotency tests
 *
 * @description
 * Regression coverage for the HIGH-severity billing bug where a transient
 * processing failure (e.g. a DB write for `invoice.payment_succeeded` or a
 * subscription update throws) was acknowledged to Stripe with success AND had
 * its idempotency key stored — so Stripe would not retry, and a retry would be
 * deduplicated anyway, losing the billing change permanently.
 *
 * Invariants under test:
 *  - THROW   → returns { success:false, retryable:true } and does NOT store the
 *              idempotency key (so a Stripe retry can reprocess).
 *  - SUCCESS → returns { success:true }, stores the idempotency key, and a
 *              subsequent retry of the same payload is deduplicated.
 *  - NO-OP   → an event type with no registered handler is still acked (200 +
 *              key stored) — Stripe should stop retrying a legitimately ignored
 *              event.
 */

// --- Mock the signature verifier so we can force a valid Stripe signature ---
const mockVerify = jest.fn();
jest.mock('@/lib/webhooks/signature-verifier', () => ({
  signatureVerifier: {
    verify: (...args: unknown[]) => mockVerify(...args),
  },
}));

// --- Mock redis with an in-memory map so idempotency behaviour is observable --
const redisStore = new Map<string, string>();
const mockRedisGet = jest.fn(async (key: string) => redisStore.get(key) ?? null);
const mockRedisSet = jest.fn(async (key: string, value: string) => {
  redisStore.set(key, value);
});
jest.mock('@/lib/redis-client', () => ({
  getRedisClient: () => ({
    isConnected: true,
    get: mockRedisGet,
    set: mockRedisSet,
  }),
}));

// --- Silence logger -----------------------------------------------------------
jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// --- Stub audit logging (logEvent → prisma.auditLog.create) -------------------
jest.mock('@/lib/prisma', () => ({
  prisma: {
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  },
}));

// --- Stub retry manager calls made inside processEvent ------------------------
jest.mock('@/lib/webhooks/retry-manager', () => ({
  retryManager: {
    recordSuccess: jest.fn().mockResolvedValue(undefined),
    recordFailure: jest.fn().mockResolvedValue(undefined),
    shouldRetry: jest.fn().mockReturnValue(false),
    getRetryDelay: jest.fn().mockReturnValue(0),
    moveToDeadLetter: jest.fn().mockResolvedValue(undefined),
  },
}));

// Import after mocks
import { WebhookHandler } from '@/lib/webhooks/webhook-handler';

const HEADERS = { 'stripe-signature': 't=1,v1=deadbeef' };

// A minimal Stripe `invoice.payment_succeeded` payload. Each test uses its own
// invoice id so payload hashes (and therefore idempotency keys) are distinct.
function paymentPayload(invoiceId: string): string {
  return JSON.stringify({
    id: `evt_${invoiceId}`,
    object: 'event',
    // `invoice.paid` is mapped by parseStripeEventType → 'billing.payment_succeeded'.
    type: 'invoice.paid',
    data: {
      object: {
        id: invoiceId,
        customer: 'cus_456',
        amount_paid: 2900,
        currency: 'usd',
      },
    },
  });
}

describe('receiveAndProcess — billing-integrity retry & idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    redisStore.clear();
    mockVerify.mockReturnValue({ valid: true, platform: 'stripe' });
    // jest.worktree.cjs sets resetMocks: true, which wipes inline mock
    // implementations between tests — re-install the redis-backed impls so the
    // in-memory store stays observable.
    mockRedisGet.mockImplementation(async (key: string) => redisStore.get(key) ?? null);
    mockRedisSet.mockImplementation(async (key: string, value: string) => {
      redisStore.set(key, value);
    });
  });

  it('THROW: a forced processing failure returns retryable non-success AND does NOT store the idempotency key', async () => {
    const handler = new WebhookHandler();
    handler.on('billing.payment_succeeded', async () => {
      throw new Error('transient DB write failure');
    });

    const payload = paymentPayload('in_throw');
    const result = await handler.receiveAndProcess('stripe', payload, HEADERS);

    // Must NOT ack success — route maps this to a non-2xx so Stripe retries.
    expect(result.success).toBe(false);
    expect(result.retryable).toBe(true);

    // Idempotency key must NOT have been stored, so a retry can reprocess.
    expect(mockRedisSet).not.toHaveBeenCalled();
    expect(redisStore.size).toBe(0);

    // A retry (same payload) is NOT deduped — the handler runs again.
    let secondAttemptRan = false;
    const handler2 = new WebhookHandler();
    handler2.on('billing.payment_succeeded', async () => {
      secondAttemptRan = true; // now succeeds
    });
    const retry = await handler2.receiveAndProcess('stripe', payload, HEADERS);
    expect(secondAttemptRan).toBe(true);
    expect(retry.success).toBe(true);
  });

  it('SUCCESS: a successfully processed event acks success, stores the key, and a retry is deduplicated', async () => {
    let invocations = 0;
    const handler = new WebhookHandler();
    handler.on('billing.payment_succeeded', async () => {
      invocations += 1;
    });

    const payload = paymentPayload('in_success');

    const first = await handler.receiveAndProcess('stripe', payload, HEADERS);
    expect(first.success).toBe(true);
    expect(first.retryable).toBeUndefined();
    expect(invocations).toBe(1);

    // Idempotency key stored after success.
    expect(mockRedisSet).toHaveBeenCalledTimes(1);
    expect(redisStore.size).toBe(1);

    // A genuine Stripe retry of the same (already-applied) event is deduped:
    // the handler does NOT run a second time.
    const retry = await handler.receiveAndProcess('stripe', payload, HEADERS);
    expect(retry.success).toBe(true);
    expect(invocations).toBe(1); // still 1 — deduplicated
  });

  it('NO-OP: an event type with no registered handler is still acked (intentional ignore stores key)', async () => {
    // Fresh handler with NO handlers registered → processEvent is a no-op and
    // returns without throwing. This is a legitimate ignore, not a failure.
    const handler = new WebhookHandler();

    const payload = paymentPayload('in_noop');
    const result = await handler.receiveAndProcess('stripe', payload, HEADERS);

    expect(result.success).toBe(true);
    expect(result.retryable).toBeUndefined();
    // Acked + deduped so Stripe stops retrying a legitimately-ignored event.
    expect(mockRedisSet).toHaveBeenCalledTimes(1);
  });
});
