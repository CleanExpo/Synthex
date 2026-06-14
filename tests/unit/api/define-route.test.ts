/**
 * Unit tests — WS5 defineRoute() / defineOrgRoute() API-contract helper.
 *
 * Verifies the helper preserves the repo's status-code ordering
 * (401 → 403 → 400 → 2xx) on top of the existing auth wrappers, returns the
 * consistent { error, details } validation shape, hands the handler typed
 * input, and centralises the 500 path.
 *
 * @task WS5
 */

// ── next/server mock ──────────────────────────────────────────────────────────
// Mirror the lightweight MockNextResponse used by the with-auth test so the
// underlying withAuth/withOrg wrappers resolve their NextResponse.json calls.
jest.mock('next/server', () => {
  class MockNextResponse {
    status: number;
    private _body: string;
    constructor(body: string, init: { status?: number } = {}) {
      this._body = body;
      this.status = init.status ?? 200;
    }
    json() {
      return Promise.resolve(JSON.parse(this._body));
    }
    static json(data: unknown, init: { status?: number } = {}) {
      return new MockNextResponse(JSON.stringify(data), init);
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class extends Request {} };
});

// ── Prisma mock (used by withAuth/withOrg user lookup) ─────────────────────────
const mockUserFindUnique = jest.fn();
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) } },
  prisma: { user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) } },
}));

// ── jwt-utils mock (auth resolution) ───────────────────────────────────────────
const mockGetUserId = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => mockGetUserId(...a),
}));

import { z } from 'zod';
import {
  defineRoute,
  defineOrgRoute,
  VALIDATION_ERROR_MESSAGE,
  SERVER_ERROR_MESSAGE,
} from '@/lib/api/define-route';

const USER_ID = 'user-1';
const ORG_ID = 'org-1';

/** Build a minimal NextRequest-ish stub the helper + wrappers consume. */
function makeRequest(body?: unknown, query: Record<string, string> = {}) {
  const searchParams = new URLSearchParams(query);
  return {
    nextUrl: { pathname: '/api/test', searchParams },
    json: async () => {
      if (body === undefined) throw new Error('no body');
      return body;
    },
  } as unknown as Parameters<ReturnType<typeof defineRoute>>[0];
}

const bodySchema = z.object({
  name: z.string().min(1),
  count: z.number().int().optional(),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserId.mockResolvedValue(USER_ID);
  mockUserFindUnique.mockResolvedValue({ organizationId: ORG_ID, teamMemberships: [] });
});

describe('defineRoute — ordering 401 → 403 → 400 → 200', () => {
  test('401 when no session — validation never runs', async () => {
    mockGetUserId.mockResolvedValue(null);
    const handler = jest.fn();
    const POST = defineRoute({ body: bodySchema }, handler);

    // Bad body too — must STILL be 401, not 400 (ordering guarantee).
    const res = await POST(makeRequest({ nope: true }));
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
    const json = await res.json();
    expect(json.error).toBe('Authentication required');
  });

  test('403 when authenticated but no org — validation never runs', async () => {
    mockUserFindUnique.mockResolvedValue({ organizationId: null, teamMemberships: [] });
    const handler = jest.fn();
    const POST = defineRoute({ body: bodySchema }, handler);

    const res = await POST(makeRequest({ nope: true }));
    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
    const json = await res.json();
    expect(json.error).toBe('No organisation found');
  });

  test('400 with consistent { error, details } shape on invalid body', async () => {
    const handler = jest.fn();
    const POST = defineRoute({ body: bodySchema }, handler);

    const res = await POST(makeRequest({ count: 1 })); // missing required `name`
    expect(res.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
    const json = await res.json();
    expect(json.error).toBe(VALIDATION_ERROR_MESSAGE);
    expect(json.details).toHaveProperty('name');
    expect(Array.isArray(json.details.name)).toBe(true);
  });

  test('400 when body is empty/unparseable and a schema is required', async () => {
    const handler = jest.fn();
    const POST = defineRoute({ body: bodySchema }, handler);

    const res = await POST(makeRequest(undefined)); // json() throws → null
    expect(res.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });

  test('200 — handler receives typed, validated input + full AuthContext', async () => {
    const handler = jest.fn(async (input, ctx) => {
      // typed access — no `any`
      expect(input.body.name).toBe('hello');
      expect(input.body.count).toBe(3);
      expect(ctx.userId).toBe(USER_ID);
      expect(ctx.clientId).toBe(ORG_ID);
      expect(ctx.role).toBe('owner');
      const { NextResponse } = await import('next/server');
      return NextResponse.json({ ok: true, name: input.body.name }, { status: 200 });
    });
    const POST = defineRoute({ body: bodySchema }, handler);

    const res = await POST(makeRequest({ name: 'hello', count: 3 }));
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    const json = await res.json();
    expect(json).toEqual({ ok: true, name: 'hello' });
  });
});

describe('defineRoute — query validation', () => {
  const querySchema = z.object({ limit: z.coerce.number().int().min(1).max(100) });

  test('400 on invalid query with { error, details } shape', async () => {
    const handler = jest.fn();
    const GET = defineRoute({ query: querySchema }, handler);

    const res = await GET(makeRequest(undefined, { limit: '999' }));
    expect(res.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
    const json = await res.json();
    expect(json.error).toBe(VALIDATION_ERROR_MESSAGE);
    expect(json.details).toHaveProperty('limit');
  });

  test('200 — coerced query passed to handler', async () => {
    const handler = jest.fn(async (input) => {
      expect(input.query.limit).toBe(25);
      const { NextResponse } = await import('next/server');
      return NextResponse.json({ ok: true });
    });
    const GET = defineRoute({ query: querySchema }, handler);

    const res = await GET(makeRequest(undefined, { limit: '25' }));
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('defineRoute — centralized 500', () => {
  test('handler throw → consistent 500 { error } + onError invoked', async () => {
    const onError = jest.fn();
    const boom = new Error('kaboom');
    const handler = jest.fn(async () => {
      throw boom;
    });
    const POST = defineRoute({ body: bodySchema, onError }, handler);

    const res = await POST(makeRequest({ name: 'x' }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe(SERVER_ERROR_MESSAGE);
    expect(onError).toHaveBeenCalledWith(boom);
  });

  test('custom serverErrorMessage is used', async () => {
    const handler = jest.fn(async () => {
      throw new Error('db down');
    });
    const POST = defineRoute(
      { body: bodySchema, serverErrorMessage: 'Failed to create thing' },
      handler,
    );

    const res = await POST(makeRequest({ name: 'x' }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Failed to create thing');
  });
});

describe('defineRoute — no schema (action-on-resource)', () => {
  test('handler runs with undefined input.body when no schema supplied', async () => {
    const handler = jest.fn(async (input, ctx) => {
      expect(input.body).toBeUndefined();
      expect(ctx.request).toBeDefined(); // raw request still available for path-id extraction
      const { NextResponse } = await import('next/server');
      return NextResponse.json({ ok: true });
    });
    const POST = defineRoute({}, handler);

    const res = await POST(makeRequest(undefined));
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('defineOrgRoute — built on withOrg', () => {
  test('401 → 403 → 400 → 200 ordering with OrgContext', async () => {
    // 401
    mockGetUserId.mockResolvedValueOnce(null);
    const handler = jest.fn(async (input, ctx) => {
      expect(ctx.org.id).toBe(ORG_ID);
      expect(ctx.actingAsOwner).toBe(true);
      const { NextResponse } = await import('next/server');
      return NextResponse.json({ ok: true });
    });
    const POST = defineOrgRoute({ body: bodySchema }, handler);

    const unauth = await POST(makeRequest({ name: 'x' }));
    expect(unauth.status).toBe(401);

    // 400 (now authenticated, bad body)
    const bad = await POST(makeRequest({ count: 1 }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toBe(VALIDATION_ERROR_MESSAGE);

    // 200
    const ok = await POST(makeRequest({ name: 'x' }));
    expect(ok.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
