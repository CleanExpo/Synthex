/**
 * Proves the background/critical failure paths newly instrumented in the
 * observability-extend PR report to Sentry with scrubbed context — closing the
 * prod-visibility gaps that #381 left open.
 *
 * Each block mocks the SDK-free Sentry client (lib/observability/sentry-server),
 * drives a cron/webhook into its failure path, and asserts that
 * captureServerException() fired with the right operation/tags — AND that no
 * token/secret/PII leaked into the capture context. It mirrors the reference
 * test tests/unit/api/cron-publish-sentry-capture.test.ts.
 *
 * Three catch-shapes are covered:
 *   - top-level fatal catch          → analytics-sync, stripe webhook
 *   - per-item loop catch (no outer) → gsc-monitor, review-follow-up
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

const mockPrisma = {
  organization: { findMany: jest.fn() },
  platformConnection: { update: jest.fn() },
  gSCProperty: { findMany: jest.fn() },
  gSCSnapshot: { upsert: jest.fn(), findFirst: jest.fn() },
  notification: { create: jest.fn() },
  reviewRequest: { findMany: jest.fn() },
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

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// The assertion target — shared across every route under test.
const mockCapture = jest.fn();
jest.mock('@/lib/observability/sentry-server', () => ({
  captureServerException: (...args: unknown[]) => mockCapture(...args),
  captureServerMessage: jest.fn(),
  isSentryServerEnabled: () => true,
}));

// Route-specific collaborators.
const mockIngest = jest.fn();
jest.mock('@/lib/analytics/ingest-post-metrics', () => ({
  ingestConnectionPostMetrics: (...a: unknown[]) => mockIngest(...a),
}));
jest.mock('@/lib/notifications/createFirstWinNotification', () => ({
  createFirstWinNotification: jest.fn(),
}));

const mockGetSearchAnalytics = jest.fn();
jest.mock('@/lib/google/search-console-oauth', () => ({
  getSearchAnalytics: (...a: unknown[]) => mockGetSearchAnalytics(...a),
}));

const mockSendFollowUp = jest.fn();
jest.mock('@/lib/reviews/review-request-service', () => ({
  sendFollowUp: (...a: unknown[]) => mockSendFollowUp(...a),
}));

const mockReceiveAndProcess = jest.fn();
jest.mock('@/lib/webhooks', () => ({
  webhookHandler: {
    receiveAndProcess: (...a: unknown[]) => mockReceiveAndProcess(...a),
  },
}));
jest.mock('@/lib/stripe/webhook-handlers', () => ({}), { virtual: true });

import { GET as analyticsSyncGET } from '@/app/api/cron/analytics-sync/route';
import { GET as gscMonitorGET } from '@/app/api/cron/gsc-monitor/route';
import { GET as reviewFollowUpGET } from '@/app/api/cron/review-follow-up/route';
import { POST as stripePOST } from '@/app/api/webhooks/stripe/route';

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyCron.mockReturnValue({ ok: true, scope: 'shared-fallback' });
});

/** Asserts no token/secret/PII string is present in the serialised context. */
function assertScrubbed(context: unknown) {
  const serialised = JSON.stringify(context).toLowerCase();
  expect(serialised).not.toContain('token');
  expect(serialised).not.toContain('secret');
  expect(serialised).not.toContain('password');
  expect(serialised).not.toContain('bearer');
}

// ---------------------------------------------------------------------------
// Top-level fatal catch — analytics-sync
// ---------------------------------------------------------------------------

describe('analytics-sync → Sentry capture on fatal failure', () => {
  it('captures with cron context when the org query throws', async () => {
    mockPrisma.organization.findMany.mockRejectedValue(
      new Error('DB connection lost')
    );

    const res = await analyticsSyncGET(
      createMockNextRequest({ url: 'http://localhost/api/cron/analytics-sync' })
    );

    expect(res.status).toBe(500);
    expect(mockCapture).toHaveBeenCalledTimes(1);
    const [error, context] = mockCapture.mock.calls[0];
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('DB connection lost');
    expect(context.operation).toBe('cron/analytics-sync');
    expect(context.tags.cron).toBe('analytics-sync');
    assertScrubbed(context);
  });

  it('does not call Sentry on a clean run', async () => {
    mockPrisma.organization.findMany.mockResolvedValue([]);
    const res = await analyticsSyncGET(
      createMockNextRequest({ url: 'http://localhost/api/cron/analytics-sync' })
    );
    expect(res.status).toBe(200);
    expect(mockCapture).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Per-item loop catch (no outer try/catch) — gsc-monitor
// ---------------------------------------------------------------------------

describe('gsc-monitor → Sentry capture on per-property failure', () => {
  it('captures with safe property ids when a property snapshot throws', async () => {
    mockPrisma.gSCProperty.findMany.mockResolvedValue([
      {
        id: 'prop-1',
        organizationId: 'org-1',
        connectionId: 'conn-secret-1',
        siteUrl: 'https://example.com',
      },
    ]);
    mockGetSearchAnalytics.mockRejectedValue(new Error('GSC 403 forbidden'));

    const res = await gscMonitorGET(
      createMockNextRequest({ url: 'http://localhost/api/cron/gsc-monitor' })
    );
    const body = await res.json();

    expect(res.status).toBe(200); // cron never crashes
    expect(body.failed).toBe(1);
    expect(mockCapture).toHaveBeenCalledTimes(1);
    const [error, context] = mockCapture.mock.calls[0];
    expect((error as Error).message).toBe('GSC 403 forbidden');
    expect(context.operation).toBe('cron/gsc-monitor');
    expect(context.tags.cron).toBe('gsc-monitor');
    expect(context.extra.propertyId).toBe('prop-1');
    expect(context.extra.siteUrl).toBe('https://example.com');
    // connectionId is a token-bearing handle — it must NOT be in the context.
    expect(JSON.stringify(context)).not.toContain('conn-secret-1');
    assertScrubbed(context);
  });

  it('does not call Sentry when every property snapshots cleanly', async () => {
    mockPrisma.gSCProperty.findMany.mockResolvedValue([]);
    const res = await gscMonitorGET(
      createMockNextRequest({ url: 'http://localhost/api/cron/gsc-monitor' })
    );
    expect(res.status).toBe(200);
    expect(mockCapture).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Per-item loop catch (no outer try/catch) — review-follow-up
// ---------------------------------------------------------------------------

describe('review-follow-up → Sentry capture on per-request failure', () => {
  it('captures with the opaque reviewRequestId when a send throws', async () => {
    mockPrisma.reviewRequest.findMany.mockResolvedValue([{ id: 'rr-1' }]);
    mockSendFollowUp.mockRejectedValue(new Error('email provider down'));

    const res = await reviewFollowUpGET(
      createMockNextRequest({ url: 'http://localhost/api/cron/review-follow-up' })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.failed).toBe(1);
    expect(mockCapture).toHaveBeenCalledTimes(1);
    const [error, context] = mockCapture.mock.calls[0];
    expect((error as Error).message).toBe('email provider down');
    expect(context.operation).toBe('cron/review-follow-up');
    expect(context.extra.reviewRequestId).toBe('rr-1');
    assertScrubbed(context);
  });

  it('does not call Sentry when every follow-up sends cleanly', async () => {
    mockPrisma.reviewRequest.findMany.mockResolvedValue([{ id: 'rr-1' }]);
    mockSendFollowUp.mockResolvedValue(undefined);
    const res = await reviewFollowUpGET(
      createMockNextRequest({ url: 'http://localhost/api/cron/review-follow-up' })
    );
    expect(res.status).toBe(200);
    expect(mockCapture).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Webhook — stripe retryable processing failure (billing event at risk)
// ---------------------------------------------------------------------------

describe('stripe webhook → Sentry capture on retryable processing failure', () => {
  it('captures the eventId (no payload/signature) when a handler fails', async () => {
    mockReceiveAndProcess.mockResolvedValue({
      success: false,
      retryable: true,
      eventId: 'evt_123',
      error: 'subscription update failed',
    });

    const res = await stripePOST(
      createMockNextRequest({
        url: 'http://localhost/api/webhooks/stripe',
        method: 'POST',
        body: '{"id":"evt_123"}',
        headers: { 'stripe-signature': 't=1,v1=deadbeefsignature' },
      }) as never
    );

    expect(res.status).toBe(500); // signals Stripe to retry
    expect(mockCapture).toHaveBeenCalledTimes(1);
    const [error, context] = mockCapture.mock.calls[0];
    expect((error as Error).message).toBe('subscription update failed');
    expect(context.operation).toBe('webhook/stripe/process');
    expect(context.tags.webhook).toBe('stripe');
    expect(context.extra.eventId).toBe('evt_123');
    // The raw signature header must never reach the capture context.
    expect(JSON.stringify(context)).not.toContain('deadbeefsignature');
    assertScrubbed(context);
  });

  it('does not call Sentry on a successfully processed event', async () => {
    mockReceiveAndProcess.mockResolvedValue({
      success: true,
      eventId: 'evt_ok',
    });
    const res = await stripePOST(
      createMockNextRequest({
        url: 'http://localhost/api/webhooks/stripe',
        method: 'POST',
        body: '{"id":"evt_ok"}',
        headers: { 'stripe-signature': 't=1,v1=sig' },
      }) as never
    );
    expect(res.status).toBe(200);
    expect(mockCapture).not.toHaveBeenCalled();
  });
});
