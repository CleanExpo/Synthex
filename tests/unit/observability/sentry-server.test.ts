/**
 * Coverage for lib/observability/sentry-server.ts — the SDK-free, DSN-gated
 * server-side Sentry envelope transport (P1 observability).
 *
 * Locks the three contract guarantees the assessment required:
 *   1. DSN-optional no-op  — unset/blank/invalid SENTRY_DSN sends NOTHING.
 *   2. Real capture        — a valid DSN POSTs a Sentry envelope to the
 *                            project's ingest endpoint.
 *   3. No PII / no secrets  — token/secret-shaped keys are redacted before send.
 */

import {
  captureServerException,
  isSentryServerEnabled,
  __resetSentryDsnCache,
} from '@/lib/observability/sentry-server';

const VALID_DSN = 'https://publickey123@o4509.ingest.sentry.io/4510';

const originalEnv = { ...process.env };

let fetchMock: jest.Mock;

beforeEach(() => {
  fetchMock = jest.fn().mockResolvedValue({ ok: true });
  // @ts-expect-error — override global fetch for the test
  global.fetch = fetchMock;
  __resetSentryDsnCache();
});

afterEach(() => {
  process.env = { ...originalEnv };
  __resetSentryDsnCache();
  jest.clearAllMocks();
});

describe('captureServerException — DSN-optional no-op', () => {
  it('sends nothing when SENTRY_DSN is unset', () => {
    delete process.env.SENTRY_DSN;
    __resetSentryDsnCache();

    expect(isSentryServerEnabled()).toBe(false);
    captureServerException(new Error('boom'), { operation: 'cron/test' });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends nothing when SENTRY_DSN is blank', () => {
    process.env.SENTRY_DSN = '   ';
    __resetSentryDsnCache();

    expect(isSentryServerEnabled()).toBe(false);
    captureServerException(new Error('boom'));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends nothing when SENTRY_DSN is malformed', () => {
    process.env.SENTRY_DSN = 'not-a-valid-dsn';
    __resetSentryDsnCache();

    expect(isSentryServerEnabled()).toBe(false);
    captureServerException(new Error('boom'));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never throws even if fetch itself rejects', () => {
    process.env.SENTRY_DSN = VALID_DSN;
    __resetSentryDsnCache();
    fetchMock.mockRejectedValue(new Error('network down'));

    expect(() =>
      captureServerException(new Error('boom'), { operation: 'cron/test' })
    ).not.toThrow();
  });
});

describe('captureServerException — real capture', () => {
  beforeEach(() => {
    process.env.SENTRY_DSN = VALID_DSN;
    __resetSentryDsnCache();
  });

  it('POSTs a Sentry envelope to the project ingest endpoint', () => {
    expect(isSentryServerEnabled()).toBe(true);
    captureServerException(new Error('publish failed'), {
      level: 'error',
      operation: 'cron/publish-scheduled',
      tags: { platform: 'facebook' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://o4509.ingest.sentry.io/api/4510/envelope/');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/x-sentry-envelope');
    expect(init.headers['X-Sentry-Auth']).toContain('sentry_key=publickey123');

    // Envelope body: header \n item-header \n payload
    const [header, itemHeader, payload] = (init.body as string).trim().split('\n');
    expect(JSON.parse(header).event_id).toMatch(/^[a-f0-9]+$/);
    expect(JSON.parse(itemHeader).type).toBe('event');
    const event = JSON.parse(payload);
    expect(event.level).toBe('error');
    expect(event.transaction).toBe('cron/publish-scheduled');
    expect(event.exception.values[0].value).toBe('publish failed');
    expect(event.tags.platform).toBe('facebook');
  });

  it('wraps non-Error values into an exception payload', () => {
    captureServerException('a string failure');
    const payload = (fetchMock.mock.calls[0][1].body as string).trim().split('\n')[2];
    expect(JSON.parse(payload).exception.values[0].value).toBe('a string failure');
  });
});

describe('captureServerException — no PII / no secrets', () => {
  beforeEach(() => {
    process.env.SENTRY_DSN = VALID_DSN;
    __resetSentryDsnCache();
  });

  it('redacts token/secret-shaped keys in tags and extra', () => {
    captureServerException(new Error('token refresh failed'), {
      operation: 'cron/refresh-tokens',
      tags: {
        platform: 'twitter',
        // these must never reach Sentry
        accessToken: 'ya29.SHOULD_NOT_LEAK',
      },
      extra: {
        connectionId: 'conn-1',
        refresh_token: 'rt_SHOULD_NOT_LEAK',
        authorization: 'Bearer SHOULD_NOT_LEAK',
        nested: { client_secret: 'cs_SHOULD_NOT_LEAK', safe: 'ok' },
      },
    });

    const body = fetchMock.mock.calls[0][1].body as string;
    // Nothing secret-shaped survives serialization.
    expect(body).not.toContain('SHOULD_NOT_LEAK');
    expect(body).toContain('[redacted]');

    const event = JSON.parse(body.trim().split('\n')[2]);
    expect(event.tags.platform).toBe('twitter');
    expect(event.tags.accessToken).toBe('[redacted]');
    expect(event.extra.connectionId).toBe('conn-1');
    expect(event.extra.refresh_token).toBe('[redacted]');
    expect(event.extra.authorization).toBe('[redacted]');
    expect(event.extra.nested.client_secret).toBe('[redacted]');
    expect(event.extra.nested.safe).toBe('ok');
  });
});
