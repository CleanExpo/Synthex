/**
 * Unit tests — webhook signature verification FAIL CLOSED — SYN-703
 *
 * Security regression coverage for the platform webhook POST handler.
 *
 * The finding: the route's outer catch returns HTTP 200 on internal errors.
 * Critically, if signature verification THROWS (rather than returning false),
 * that exception used to propagate to the outer catch and a 200 was returned —
 * silently admitting an UNVERIFIED payload into the event queue.
 *
 * These tests exercise the real POST route together with the real
 * webhookHandler.receive() (only the leaf dependencies are mocked), and prove:
 *   (a) verification THROWS  -> request rejected (401), payload NOT enqueued
 *   (b) verification returns invalid -> request rejected (401), NOT enqueued
 *   (c) verification returns valid   -> payload processed (200), enqueued once
 */

// ---- Leaf-dependency mocks (shared by route + webhookHandler.receive) ----

const mockVerify = jest.fn();
jest.mock('@/lib/webhooks/signature-verifier', () => ({
  __esModule: true,
  signatureVerifier: { verify: (...args: unknown[]) => mockVerify(...args) },
  SignatureVerifier: class {},
}));

const mockEnqueue = jest.fn();
jest.mock('@/lib/webhooks/event-queue', () => ({
  __esModule: true,
  eventQueue: { enqueue: (...args: unknown[]) => mockEnqueue(...args) },
}));

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: { auditLog: { create: jest.fn().mockResolvedValue({}) } },
}));

jest.mock('@/lib/redis-client', () => ({
  __esModule: true,
  getRedisClient: () => ({ isConnected: false }),
}));

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { POST } from '@/app/api/webhooks/[platform]/route';

type RouteCtx = Parameters<typeof POST>[1];

function buildRequest(body: string, headers: Record<string, string>) {
  const h = new Headers(headers);
  return {
    text: async () => body,
    headers: h,
  } as unknown as Parameters<typeof POST>[0];
}

function buildContext(platform: string): RouteCtx {
  return { params: Promise.resolve({ platform }) } as unknown as RouteCtx;
}

// Twitter is used because its signature header + event parsing are simple.
const TWITTER_HEADERS = { 'x-twitter-webhooks-signature': 'sha256=whatever' };
const TWITTER_BODY = JSON.stringify({ tweet_create_events: [{ id: '1' }] });

describe('SYN-703 — webhook signature verification fails closed', () => {
  beforeEach(() => {
    mockVerify.mockReset();
    mockEnqueue.mockReset();
    mockEnqueue.mockResolvedValue('evt_test_123');
  });

  it('(a) verification THROWS -> rejected 401, payload NOT enqueued', async () => {
    mockVerify.mockImplementation(() => {
      throw new Error('verifier library exploded');
    });

    const res = await POST(
      buildRequest(TWITTER_BODY, TWITTER_HEADERS),
      buildContext('twitter')
    );

    // Must NOT be the old silent 200. Fail closed -> auth rejection.
    expect(res.status).toBe(401);
    expect(res.status).not.toBe(200);
    // The unverified payload must never reach the event queue.
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('(b) verification returns invalid -> rejected 401, payload NOT enqueued', async () => {
    mockVerify.mockReturnValue({ valid: false, error: 'Invalid signature' });

    const res = await POST(
      buildRequest(TWITTER_BODY, TWITTER_HEADERS),
      buildContext('twitter')
    );

    expect(res.status).toBe(401);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('(c) verification returns valid -> processed 200, payload enqueued once', async () => {
    mockVerify.mockReturnValue({ valid: true });

    const res = await POST(
      buildRequest(TWITTER_BODY, TWITTER_HEADERS),
      buildContext('twitter')
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; eventId: string };
    expect(body.success).toBe(true);
    expect(body.eventId).toBe('evt_test_123');
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
  });
});
