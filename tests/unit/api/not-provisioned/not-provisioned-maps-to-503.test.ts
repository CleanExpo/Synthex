/**
 * P2 sweep #10 — a FEATURE_NOT_PROVISIONED failure from the service layer
 * answers 503, not a generic 500, so clients can tell "not available" from
 * "crashed". Uses the real services; their backing tables have no model.
 *   GET/POST /api/intelligence/competitors   (competitors)
 *   POST ?action=submit-review, GET /api/moderation/check (content_reviews,
 *     content_moderation_logs)
 *   PUT ?action=dismiss|apply /api/recommendations (dismissed_/applied_recommendations)
 */

/** @jest-environment node */

const mockCheck = jest.fn();
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...a: unknown[]) => mockCheck(...a),
    createSecureResponse: (body: object, status = 200) =>
      new Response(JSON.stringify(body), { status }),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_WRITE: 'AUTHENTICATED_WRITE',
    AUTHENTICATED_READ: 'AUTHENTICATED_READ',
  },
}));

jest.mock('@/lib/security/audit-logger', () => ({
  auditLogger: { logData: () => Promise.resolve() },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('@/lib/prisma', () => ({ prisma: {}, default: {} }));

import * as competitors from '@/app/api/intelligence/competitors/route';
import * as moderation from '@/app/api/moderation/check/route';
import * as recommendations from '@/app/api/recommendations/route';
import { createMockNextRequest } from '../../../helpers/mock-request';

beforeEach(() => {
  mockCheck.mockResolvedValue({ allowed: true, context: { userId: 'u1' } });
});

function call(
  handler: (r: never) => Promise<Response>,
  method: string,
  path: string,
  body?: object
) {
  return handler(
    createMockNextRequest({
      method,
      url: `https://synthex.example${path}`,
      body,
    }) as never
  );
}

async function expect503(res: Response, table: string) {
  expect(res.status).toBe(503);
  const json = await res.json();
  expect(json.error).toBe('FEATURE_NOT_PROVISIONED');
  expect(json.message).toContain(table);
  expect(json.success).toBeUndefined();
}

describe('/api/intelligence/competitors', () => {
  it('GET list answers 503 naming competitors', async () => {
    await expect503(
      await call(competitors.GET, 'GET', '/api/intelligence/competitors'),
      'competitors'
    );
  });

  it('POST add answers 503 naming competitors', async () => {
    await expect503(
      await call(competitors.POST, 'POST', '/api/intelligence/competitors', {
        name: 'Acme',
      }),
      'competitors'
    );
  });
});

describe('/api/moderation/check', () => {
  it('POST submit-review answers 503 naming content_reviews', async () => {
    await expect503(
      await call(
        moderation.POST,
        'POST',
        '/api/moderation/check?action=submit-review',
        { contentId: 'c1', content: 'Hello world' }
      ),
      'content_reviews'
    );
  });

  it('GET history answers 503 naming content_moderation_logs', async () => {
    await expect503(
      await call(moderation.GET, 'GET', '/api/moderation/check'),
      'content_moderation_logs'
    );
  });
});

describe('PUT /api/recommendations', () => {
  it('dismiss answers 503 naming dismissed_recommendations', async () => {
    await expect503(
      await call(
        recommendations.PUT,
        'PUT',
        '/api/recommendations?action=dismiss',
        { recommendationId: 'r1' }
      ),
      'dismissed_recommendations'
    );
  });

  it('apply answers 503 naming applied_recommendations', async () => {
    await expect503(
      await call(
        recommendations.PUT,
        'PUT',
        '/api/recommendations?action=apply',
        { recommendationId: 'r1', action: { type: 'schedule' } }
      ),
      'applied_recommendations'
    );
  });
});
