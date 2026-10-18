/**
 * __tests__/security/owner-override-tenant-isolation.test.ts
 *
 * Cross-tenant isolation for POST /api/effect-report/generate and
 * POST /api/ask-synthex.
 *
 * Before this PR, both routes honoured a request-body field that let
 * the caller override the tenant key used in service-role queries:
 *
 *   /api/effect-report/generate — body.client_id (when role === 'owner')
 *   /api/ask-synthex           — body.clientId  (when role === 'owner')
 *
 * The role 'owner' is per-organisation, not platform-wide. An owner of
 * org A could pass org B's id and the route would issue service-role
 * queries scoped to org B (RLS bypassed). After this PR, both routes
 * derive the tenant exclusively from auth.clientId and ignore any
 * body-supplied tenant key.
 *
 * Service-role leak fix 3/N.
 */

// `server-only` is a runtime sentinel; mock for Jest.
jest.mock('server-only', () => ({}));

import type { NextRequest } from 'next/server';

const TENANT_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TENANT_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const USER_A = '11111111-1111-1111-1111-111111111111';

// ── withAuth mock: always resolves to TENANT_A, owner ────────────────────────
//
// We inject auth in-process by replacing the module's withAuth so the wrapped
// handler runs with a fixed AuthContext. This isolates the test to the route's
// own decisions, not the auth pipeline.
jest.mock('@/lib/auth/with-auth', () => ({
  __esModule: true,
  withAuth:
    (handler: (req: NextRequest, ctx: unknown) => Promise<Response>) =>
    (req: NextRequest) =>
      handler(req, { userId: USER_A, clientId: TENANT_A, role: 'owner' }),
}));

// ── Effect-report generator mock: must never be reached ─────────────────────
// The route answers 501 FEATURE_NOT_PROVISIONED (no effect_reports model in
// prisma/schema.prisma), so no report is generated for any tenant.
const mockGenerate = jest.fn();
jest.mock('@/lib/effect-report/generator', () => ({
  __esModule: true,
  generateEffectReport: (...args: unknown[]) => mockGenerate(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

function jsonRequest(body: unknown): NextRequest & { json: jest.Mock } {
  return {
    json: jest.fn(async () => body),
    url: 'https://synthex.social/api/x',
  } as unknown as NextRequest & { json: jest.Mock };
}

describe('POST /api/effect-report/generate — owner-override stripped', () => {
  it('ignores body.client_id targeting a foreign tenant: no body read, no generation, honest 501', async () => {
    const { POST } = await import('@/app/api/effect-report/generate/route');
    const req = jsonRequest({ client_id: TENANT_B });
    const res = await POST(req);
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error).toBe('FEATURE_NOT_PROVISIONED');
    expect(JSON.stringify(body)).not.toContain(TENANT_B);
    expect(req.json).not.toHaveBeenCalled();
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('answers 501 when body is empty', async () => {
    const { POST } = await import('@/app/api/effect-report/generate/route');
    const res = await POST(jsonRequest({}));
    expect(res.status).toBe(501);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('answers 501 when request body is not JSON', async () => {
    const { POST } = await import('@/app/api/effect-report/generate/route');
    const badReq = {
      json: async () => {
        throw new Error('not json');
      },
      url: 'https://synthex.social/api/effect-report/generate',
    } as unknown as NextRequest;
    const res = await POST(badReq);
    expect(res.status).toBe(501);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('route stays behind withAuth and never reads a body-supplied tenant key', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../app/api/effect-report/generate/route.ts'),
      'utf8'
    );
    expect(src).toMatch(/export const POST = withAuth\(/);
    expect(src).not.toMatch(/\.json\(\)|body\.client/);
  });
});

describe('POST /api/ask-synthex — owner-override stripped (source-level regression guard)', () => {
  // This route has heavy collaborators (model router, retrieveClientContext,
  // streaming responses) — full end-to-end mocking is invasive for a one-line
  // assertion. Instead, we read the source file and assert that the offending
  // pattern is gone. This is a static regression guard: if anyone re-adds
  // `body.clientId` or `parsed.data.clientId` as a tenant override, this fails.

  const fs = require('fs');
  const path = require('path');
  const ROUTE_SRC = fs.readFileSync(
    path.resolve(__dirname, '../../app/api/ask-synthex/route.ts'),
    'utf8'
  );

  it('AskSynthexSchema does NOT declare `clientId` as an input field', () => {
    // Match: `clientId: z.<anything>` inside the schema definition
    const schemaSection =
      ROUTE_SRC.match(
        /AskSynthexSchema\s*=\s*z\.object\(\{[\s\S]*?\}\)/
      )?.[0] ?? '';
    expect(schemaSection).not.toMatch(/clientId\s*:\s*z\./);
  });

  it('route handler does NOT read `parsed.data.clientId`', () => {
    expect(ROUTE_SRC).not.toMatch(/parsed\.data\.clientId/);
  });

  it('route handler does NOT use the `??` fallback against auth.clientId', () => {
    // Catches the previous pattern: `parsed.data.clientId ?? auth.clientId`
    expect(ROUTE_SRC).not.toMatch(/\.clientId\s*\?\?\s*auth\.clientId/);
  });

  it('route handler sources organizationId from auth.clientId directly', () => {
    // Positive assertion: must contain the safe pattern
    expect(ROUTE_SRC).toMatch(/organizationId\s*=\s*auth\.clientId/);
  });
});
