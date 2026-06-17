/**
 * Route-level security-boundary tests for POST /api/webhooks/stripe (SYN-963 #2).
 *
 * The handler logic is covered elsewhere; this pins the ROUTE contract — the
 * payments security boundary — which was previously only exercised for Sentry:
 *   - missing signature        → 400, never processed
 *   - processed OK             → 200 { received, eventId }
 *   - retryable failure        → 500 { retry } so Stripe retries (+ Sentry alert)
 *   - permanent reject         → 400 (bad signature / unknown event)
 *   - unexpected throw         → 500
 */
const receiveAndProcess = jest.fn();
jest.mock('@/lib/webhooks', () => ({
  webhookHandler: { receiveAndProcess: (...a: unknown[]) => receiveAndProcess(...a) },
}));

// Side-effect import in the route — registers handlers; no-op it here.
jest.mock('@/lib/stripe/webhook-handlers', () => ({}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const captureServerException = jest.fn();
jest.mock('@/lib/observability/sentry-server', () => ({
  captureServerException: (...a: unknown[]) => captureServerException(...a),
}));

import { POST } from '@/app/api/webhooks/stripe/route';

function makeRequest(body: string, signature: string | null) {
  return {
    text: async () => body,
    headers: { get: (h: string) => (h === 'stripe-signature' ? signature : null) },
  } as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => jest.clearAllMocks());

describe('POST /api/webhooks/stripe', () => {
  it('rejects a request with no Stripe signature (400, never processed)', async () => {
    const res = await POST(makeRequest('{}', null));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Missing signature' });
    expect(receiveAndProcess).not.toHaveBeenCalled();
  });

  it('returns 200 with the eventId when processing succeeds', async () => {
    receiveAndProcess.mockResolvedValue({ success: true, eventId: 'evt_1' });
    const res = await POST(makeRequest('{"id":"evt_1"}', 'sig'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ received: true, eventId: 'evt_1' });
    // Raw body + signature are forwarded for verification.
    expect(receiveAndProcess).toHaveBeenCalledWith('stripe', '{"id":"evt_1"}', {
      'stripe-signature': 'sig',
    });
  });

  it('signals a retry (500) and alerts Sentry on a retryable processing failure', async () => {
    receiveAndProcess.mockResolvedValue({
      success: false,
      retryable: true,
      eventId: 'evt_2',
      error: 'DB write failed',
    });
    const res = await POST(makeRequest('{}', 'sig'));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'DB write failed', retry: true });
    expect(captureServerException).toHaveBeenCalledTimes(1);
  });

  it('returns 400 (no retry) on a permanent rejection like a bad signature', async () => {
    receiveAndProcess.mockResolvedValue({
      success: false,
      retryable: false,
      error: 'Invalid signature',
    });
    const res = await POST(makeRequest('{}', 'badsig'));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Invalid signature' });
    expect(captureServerException).not.toHaveBeenCalled();
  });

  it('returns 500 when the handler throws unexpectedly', async () => {
    receiveAndProcess.mockRejectedValue(new Error('boom'));
    const res = await POST(makeRequest('{}', 'sig'));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Webhook handler failed' });
    expect(captureServerException).toHaveBeenCalledTimes(1);
  });
});
