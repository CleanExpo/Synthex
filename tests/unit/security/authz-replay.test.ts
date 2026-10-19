/**
 * Security regression: OAuth returnTo open redirect, admin-only model metrics,
 * and webhook replay protection (Stripe, internal, Zapier, Resend).
 *
 * Gap ids (JEV J11 known-gaps): J11-GAP-oauth-returnto-backslash,
 * J11-GAP-admin-model-metrics-authn-only, J11-GAP-webhook-idempotency-never-active,
 * J11-GAP-zapier-no-replay-protection, J11-GAP-resend-no-timestamp-or-id-check.
 *
 * Real route modules, real signature verification and the real Redis client
 * wrapper (no Upstash configured, so it uses its in-process store). Only
 * Prisma, the event queue, GA4 fetch and CVML emit are doubled. Synthetic
 * secrets only; nothing leaves the process.
 */
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { createMockNextRequest } from '../../helpers/mock-request';

const APP_ORIGIN = 'https://app.synthex.test';

const SECRETS = {
  STRIPE_WEBHOOK_SECRET: 'whsec_authz_replay_stripe',
  INTERNAL_WEBHOOK_SECRET: 'authz-replay-internal',
  ZAPIER_WEBHOOK_SECRET: 'authz-replay-zapier',
  RESEND_WEBHOOK_SECRET: `whsec_${Buffer.from('authz-replay-resend-key').toString('base64')}`,
  ADMIN_API_KEY: 'authz-replay-admin-key',
};

const mockUserFindUnique = jest.fn();
const mockModelMetricFindMany = jest.fn();
const mockAuditCreate = jest.fn();
jest.mock('@/lib/prisma', () => {
  const client = {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
    modelMetric: {
      findMany: (...a: unknown[]) => mockModelMetricFindMany(...a),
    },
    auditLog: { create: (...a: unknown[]) => mockAuditCreate(...a) },
  };
  return { __esModule: true, default: client, prisma: client };
});

const mockEmit = jest.fn();
jest.mock('@/lib/measurement/emit', () => ({
  emit: (...a: unknown[]) => mockEmit(...a),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Env must be set before the route modules load: the signature verifier reads
// webhook secrets at import time. The jest config resets/restores mocks before
// every test, so spies and mock implementations are installed in beforeEach.
const savedEnv: Record<string, string | undefined> = {};
const testEnv: Record<string, string | undefined> = {
  ...SECRETS,
  NEXT_PUBLIC_APP_URL: APP_ORIGIN,
  GA4_MEASUREMENT_ID: 'G-AUTHZREPLAY',
  GA4_API_SECRET: 'authz-replay-ga4',
  OAUTH_STATE_SECRET: undefined,
  REDIS_URL: undefined,
  REDIS_HOST: undefined,
  UPSTASH_REDIS_REST_URL: undefined,
  UPSTASH_REDIS_REST_TOKEN: undefined,
};
for (const [k, v] of Object.entries(testEnv)) {
  savedEnv[k] = process.env[k];
  if (v === undefined) delete process.env[k];
  else process.env[k] = v;
}

// Imported after mocks and env.
const { eventQueue } = require('@/lib/webhooks/event-queue');
const { webhookHandler } = require('@/lib/webhooks/webhook-handler');
const { resetRedisClient } = require('@/lib/redis-client');
const callbackRoute = require('@/app/api/auth/callback/[platform]/route');
const modelMetricsRoute = require('@/app/api/admin/model-metrics/route');
const stripeRoute = require('@/app/api/webhooks/stripe/route');
const internalRoute = require('@/app/api/webhooks/internal/route');
const zapierRoute = require('@/app/api/webhooks/zapier/route');
const resendRoute = require('@/app/api/webhooks/resend/route');

type Handler = (req: unknown, ctx?: unknown) => Promise<Response>;

const savedFetch = global.fetch;
const mockFetch = jest.fn();
let enqueueSpy: jest.SpyInstance;
let processSpy: jest.SpyInstance;

beforeEach(() => {
  mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
  mockEmit.mockResolvedValue(undefined);
  mockAuditCreate.mockResolvedValue({});
  global.fetch = mockFetch as unknown as typeof fetch;
  enqueueSpy = jest
    .spyOn(eventQueue, 'enqueue')
    .mockImplementation(async () => crypto.randomUUID());
  processSpy = jest
    .spyOn(webhookHandler, 'processEvent')
    .mockImplementation(async () => undefined);
});

afterAll(async () => {
  global.fetch = savedFetch;
  await resetRedisClient();
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

function call(
  handler: Handler,
  opts: {
    method?: string;
    url: string;
    headers?: Record<string, string>;
    body?: string;
    params?: Record<string, string>;
  }
): Promise<Response> {
  const req = createMockNextRequest({
    method: opts.method ?? 'POST',
    url: opts.url,
    headers: { 'content-type': 'application/json', ...opts.headers },
    body: opts.body,
  });
  return handler(req, { params: Promise.resolve(opts.params ?? {}) });
}

const hmacHex = (secret: string, msg: string) =>
  crypto.createHmac('sha256', secret).update(msg).digest('hex');
const nowSec = () => Math.floor(Date.now() / 1000);

// ─────────────────────────────────────────────────────────────────────────────
// OAuth callback returnTo
// ─────────────────────────────────────────────────────────────────────────────

describe('OAuth callback returnTo stays on the app origin', () => {
  function signedState(returnTo: string): string {
    const payload = {
      userId: 'user-a',
      email: 'member@org-a.test',
      platform: 'twitter',
      organizationId: 'org-A',
      timestamp: 1767225600000, // old: the code path hits "expired"
      flow: 'integration',
      nonce: 'authz-replay',
      returnTo,
    };
    const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto
      .createHmac('sha256', process.env.JWT_SECRET as string)
      .update(b64)
      .digest('base64url');
    return `${b64}.${sig}`;
  }

  async function callback(path: 'error' | 'expired', returnTo: string) {
    const state = encodeURIComponent(signedState(returnTo));
    const q =
      path === 'error'
        ? `error=access_denied&error_description=denied&state=${state}`
        : `code=authz-code&state=${state}`;
    return call(callbackRoute.GET, {
      method: 'GET',
      url: `${APP_ORIGIN}/api/auth/callback/twitter?${q}`,
      params: { platform: 'twitter' },
    });
  }

  const attacks: Array<[string, 'error' | 'expired', string]> = [
    ['backslash', 'error', '/\\evil.example/steal'],
    ['slash-backslash', 'error', '/\\/evil.example/steal'],
    ['tab-smuggle', 'error', '/\t/evil.example/steal'],
    ['newline-smuggle', 'error', '/\n/evil.example/steal'],
    ['protocol-relative', 'error', '//evil.example/steal'],
    ['expired-backslash', 'expired', '/\\evil.example/steal'],
    ['expired-tab-smuggle', 'expired', '/\t/evil.example/steal'],
  ];

  it.each(attacks)('%s never redirects off-origin', async (_n, path, rt) => {
    const res = await callback(path, rt);
    const loc = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && loc) {
      expect(new URL(loc, APP_ORIGIN).origin).toBe(APP_ORIGIN);
    }
  });

  it.each(['error', 'expired'] as const)(
    'positive control (%s): a benign relative returnTo still redirects on-origin',
    async path => {
      const res = await callback(path, '/onboarding/connect');
      expect(res.status).toBeGreaterThanOrEqual(300);
      expect(res.status).toBeLessThan(400);
      const loc = new URL(res.headers.get('location') as string);
      expect(loc.origin).toBe(APP_ORIGIN);
      expect(loc.pathname).toBe('/onboarding/connect');
    }
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin model metrics
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/model-metrics is admin-only', () => {
  const url = `${APP_ORIGIN}/api/admin/model-metrics`;

  beforeEach(() => {
    mockModelMetricFindMany.mockResolvedValue([]);
    mockUserFindUnique.mockResolvedValue({
      id: 'user-a',
      email: 'member@org-a.test',
      preferences: { role: 'member' },
      isActive: true,
    });
  });

  it('refuses a signed-in non-admin member', async () => {
    const token = jwt.sign(
      { userId: 'user-a', email: 'member@org-a.test' },
      process.env.JWT_SECRET as string,
      { expiresIn: '1h' }
    );
    const res = await call(modelMetricsRoute.GET, {
      method: 'GET',
      url,
      headers: { authorization: `Bearer ${token}` },
    });
    expect([401, 403]).toContain(res.status);
    expect(mockModelMetricFindMany).not.toHaveBeenCalled();
  });

  it('positive control: the admin API key is allowed', async () => {
    const res = await call(modelMetricsRoute.GET, {
      method: 'GET',
      url,
      headers: { 'x-admin-api-key': SECRETS.ADMIN_API_KEY },
    });
    expect(res.status).toBe(200);
    expect(mockModelMetricFindMany).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Webhook replay
// ─────────────────────────────────────────────────────────────────────────────

describe('webhook replay protection', () => {
  it('Stripe: the same signed event is processed once', async () => {
    const body = JSON.stringify({
      id: 'evt_authz_replay_1',
      type: 'invoice.payment_succeeded',
      data: { object: { id: 'in_1', customer: 'cus_1' } },
    });
    const t = nowSec();
    const headers = {
      'stripe-signature': `t=${t},v1=${hmacHex(SECRETS.STRIPE_WEBHOOK_SECRET, `${t}.${body}`)}`,
    };
    const url = `${APP_ORIGIN}/api/webhooks/stripe`;
    const first = await call(stripeRoute.POST, { url, headers, body });
    const second = await call(stripeRoute.POST, { url, headers, body });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(processSpy).toHaveBeenCalledTimes(1);
  });

  it('internal: the same signed event is enqueued once', async () => {
    const body = JSON.stringify({
      type: 'post.created',
      data: { postId: 'post-authz-replay', organizationId: 'org-A' },
    });
    const t = String(Date.now());
    const headers = {
      'x-synthex-signature': hmacHex(
        SECRETS.INTERNAL_WEBHOOK_SECRET,
        `${t}.${body}`
      ),
      'x-synthex-timestamp': t,
    };
    const url = `${APP_ORIGIN}/api/webhooks/internal`;
    const first = await call(internalRoute.POST, { url, headers, body });
    const second = await call(internalRoute.POST, { url, headers, body });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(enqueueSpy).toHaveBeenCalledTimes(1);
  });

  describe('Zapier', () => {
    const url = `${APP_ORIGIN}/api/webhooks/zapier`;
    const zapBody = (postId: string) =>
      JSON.stringify({
        event: 'post.created',
        data: { postId },
        zapier_hook_id: 'hook-authz',
      });

    it('a signed delivery without a timestamp is enqueued once', async () => {
      const body = zapBody('post-zap-1');
      const headers = {
        'x-zapier-signature': hmacHex(SECRETS.ZAPIER_WEBHOOK_SECRET, body),
      };
      const first = await call(zapierRoute.POST, { url, headers, body });
      const second = await call(zapierRoute.POST, { url, headers, body });
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(enqueueSpy).toHaveBeenCalledTimes(1);
    });

    it('a stale signed timestamp is refused', async () => {
      const body = zapBody('post-zap-2');
      const t = String(Date.now() - 10 * 60 * 1000);
      const res = await call(zapierRoute.POST, {
        url,
        body,
        headers: {
          'x-zapier-signature': hmacHex(
            SECRETS.ZAPIER_WEBHOOK_SECRET,
            `${t}.${body}`
          ),
          'x-zapier-timestamp': t,
        },
      });
      expect(res.status).toBe(401);
      expect(enqueueSpy).not.toHaveBeenCalled();
    });

    it('positive control: a fresh, distinct delivery is enqueued', async () => {
      const body = zapBody('post-zap-3');
      const t = String(nowSec());
      const res = await call(zapierRoute.POST, {
        url,
        body,
        headers: {
          'x-zapier-signature': hmacHex(
            SECRETS.ZAPIER_WEBHOOK_SECRET,
            `${t}.${body}`
          ),
          'x-zapier-timestamp': t,
        },
      });
      expect(res.status).toBe(200);
      expect(enqueueSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Resend', () => {
    const url = `${APP_ORIGIN}/api/webhooks/resend`;
    const body = JSON.stringify({
      type: 'email.opened',
      data: {
        email_id: 'em_authz',
        tags: {
          campaign_type: 'monthly_story',
          month_year: '2026-09',
          org_id: 'org-A',
          story_id: 'story-authz',
        },
      },
    });
    function svixHeaders(id: string, ts: number): Record<string, string> {
      const key = Buffer.from(SECRETS.RESEND_WEBHOOK_SECRET.slice(6), 'base64');
      const sig = crypto
        .createHmac('sha256', key)
        .update(`${id}.${ts}.${body}`)
        .digest('base64');
      return {
        'svix-id': id,
        'svix-timestamp': String(ts),
        'svix-signature': `v1,${sig}`,
      };
    }

    it('a correctly signed but hour-old delivery is refused', async () => {
      const res = await call(resendRoute.POST, {
        url,
        body,
        headers: svixHeaders('msg_authz_stale', nowSec() - 3600),
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(mockEmit).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('the same svix-id is processed once', async () => {
      const headers = svixHeaders('msg_authz_replay', nowSec());
      const first = await call(resendRoute.POST, { url, headers, body });
      const second = await call(resendRoute.POST, { url, headers, body });
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(mockEmit).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
