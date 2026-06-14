/**
 * Behavioural coverage for /api/cron/unite-hub-revenue — the daily Vercel cron
 * that pushes a revenue summary to the Unite-Hub dashboard.
 *
 * Reliability lock: the Unite-Hub event MUST complete before the handler
 * returns. On Vercel serverless the instance can freeze the moment the response
 * returns, so a fire-and-forget push could be silently dropped. These tests
 * assert the push is awaited (settled before the response) and that a push
 * failure never fails the cron.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockPrisma = {
  subscription: { findMany: jest.fn(), count: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

const mockVerifyCron = jest.fn();
jest.mock('@/lib/auth/cron-auth', () => ({
  verifyCronRequest: (...args: unknown[]) => mockVerifyCron(...args),
}));

const mockPushUniteHubEvent = jest.fn();
jest.mock('@/lib/unite-hub-connector', () => ({
  pushUniteHubEvent: (...args: unknown[]) => mockPushUniteHubEvent(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { GET } from '@/app/api/cron/unite-hub-revenue/route';
import { NextResponse } from 'next/server';

function req() {
  return createMockNextRequest({
    url: 'http://localhost/api/cron/unite-hub-revenue',
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyCron.mockReturnValue({ ok: true, scope: 'shared-fallback' });
  mockPrisma.subscription.findMany.mockResolvedValue([
    { plan: 'professional' },
    { plan: 'business' },
  ]);
  mockPrisma.subscription.count.mockResolvedValue(0);
  mockPushUniteHubEvent.mockResolvedValue(undefined);
});

describe('GET /api/cron/unite-hub-revenue', () => {
  it('returns 401 and never queries subscriptions for an unauthorised caller', async () => {
    mockVerifyCron.mockReturnValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }),
    });
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(mockPrisma.subscription.findMany).not.toHaveBeenCalled();
  });

  it('blocks on the Unite-Hub push until it settles (awaited, not fire-and-forget)', async () => {
    // Externally-controlled deferred push that the TEST gates. While it's
    // pending, an awaiting handler CANNOT resolve. A fire-and-forget handler
    // would resolve immediately. We prove the handler is still pending before
    // releasing the push, which only holds if the push is awaited.
    let releasePush!: () => void;
    const pushGate = new Promise<void>((resolve) => {
      releasePush = resolve;
    });
    mockPushUniteHubEvent.mockImplementation(() => pushGate);

    let getResolved = false;
    const getPromise = GET(req()).then((res) => {
      getResolved = true;
      return res;
    });

    // Flush microtasks: the handler has run through the push call but the push
    // is still pending. An awaited handler must still be pending here too.
    await new Promise((r) => setTimeout(r, 0));
    expect(mockPushUniteHubEvent).toHaveBeenCalledTimes(1);
    expect(getResolved).toBe(false); // awaited — cannot return while push pending

    // Release the push; now the handler can finish.
    releasePush();
    const res = await getPromise;
    const body = await res.json();

    expect(getResolved).toBe(true);
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockPushUniteHubEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'revenue.daily', customers: 2 })
    );
  });

  it('still returns 200 when the Unite-Hub push rejects (push failure never fails the cron)', async () => {
    mockPushUniteHubEvent.mockRejectedValue(new Error('network down'));

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockPushUniteHubEvent).toHaveBeenCalledTimes(1);
  });
});
