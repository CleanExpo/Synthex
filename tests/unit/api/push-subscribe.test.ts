/**
 * Unit Tests for Push Subscribe API Routes
 * Tests POST /api/push/subscribe and DELETE /api/push/subscribe
 *
 * SYN-446 — Add test coverage for recently added API routes
 */

import { createMockNextRequest } from '../../helpers/mock-request';

// ---------------------------------------------------------------------------
// Mocks — factories declare shape only; implementations set in beforeEach
// ---------------------------------------------------------------------------

jest.mock('@/lib/rate-limit', () => ({
  writeDefault: jest.fn(),
  readDefault: jest.fn(),
  authStrict: jest.fn(),
}));

const mockPrisma = {
  pushSubscription: {
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  },
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

const mockSecurityCheck = jest.fn();

jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...args: unknown[]) => mockSecurityCheck(...args),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_WRITE: { requireAuth: true, allowWrite: true },
  },
}));

const mockGetEffectiveOrganizationId = jest.fn();

jest.mock('@/lib/multi-business', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrganizationId(...args),
}));

// ---------------------------------------------------------------------------
// Import rate-limit to configure pass-through
// ---------------------------------------------------------------------------

import * as rateLimitModule from '@/lib/rate-limit';

const mockWriteDefault = rateLimitModule.writeDefault as jest.MockedFunction<
  typeof rateLimitModule.writeDefault
>;

function passThrough() {
  mockWriteDefault.mockImplementation(
    async (_req: unknown, handler: () => Promise<unknown>) => handler()
  );
}

// ---------------------------------------------------------------------------
// Import handlers AFTER all mocks are declared
// ---------------------------------------------------------------------------

import { POST, DELETE } from '@/app/api/push/subscribe/route';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const VALID_SUBSCRIBE_BODY = {
  endpoint: 'https://push.example.com/subscription/abc123',
  keys: {
    p256dh: 'BNcRdreALRFXTkOOUHK',
    auth: 'tBHItJI5svbpez7KI4CCXg',
  },
};

function makePostRequest(body?: object) {
  return createMockNextRequest({
    method: 'POST',
    body: body ?? VALID_SUBSCRIBE_BODY,
    url: 'http://localhost:3000/api/push/subscribe',
  });
}

function makeDeleteRequest(body?: object) {
  return createMockNextRequest({
    method: 'DELETE',
    body: body ?? { endpoint: 'https://push.example.com/subscription/abc123' },
    url: 'http://localhost:3000/api/push/subscribe',
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/push/subscribe', () => {
  beforeEach(() => {
    passThrough();
    mockSecurityCheck.mockResolvedValue({
      allowed: true,
      context: { userId: 'user-123' },
    });
    mockGetEffectiveOrganizationId.mockResolvedValue('org-456');
    mockPrisma.pushSubscription.upsert.mockResolvedValue({
      endpoint: VALID_SUBSCRIBE_BODY.endpoint,
      p256dh: VALID_SUBSCRIBE_BODY.keys.p256dh,
      auth: VALID_SUBSCRIBE_BODY.keys.auth,
      organizationId: 'org-456',
      userId: 'user-123',
    });
  });

  it('returns 401 when not authenticated', async () => {
    mockSecurityCheck.mockResolvedValue({
      allowed: false,
      error: 'Unauthorized',
      context: {},
    });

    const req = makePostRequest();
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 201 and upserts subscription for valid input', async () => {
    const req = makePostRequest();
    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual({ success: true });
    expect(mockPrisma.pushSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { endpoint: VALID_SUBSCRIBE_BODY.endpoint },
        create: expect.objectContaining({
          endpoint: VALID_SUBSCRIBE_BODY.endpoint,
          p256dh: VALID_SUBSCRIBE_BODY.keys.p256dh,
          auth: VALID_SUBSCRIBE_BODY.keys.auth,
          organizationId: 'org-456',
          userId: 'user-123',
        }),
        update: expect.objectContaining({
          p256dh: VALID_SUBSCRIBE_BODY.keys.p256dh,
          auth: VALID_SUBSCRIBE_BODY.keys.auth,
          organizationId: 'org-456',
          userId: 'user-123',
        }),
      })
    );
  });

  it('returns 400 when body is not valid JSON', async () => {
    const req = createMockNextRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/push/subscribe',
    });
    // Override json() to throw
    (req as any).json = async () => {
      throw new SyntaxError('Unexpected token');
    };

    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid JSON');
  });

  it('returns 400 when endpoint is missing', async () => {
    const req = makePostRequest({ keys: { p256dh: 'abc', auth: 'def' } });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });

  it('returns 400 when endpoint is not a URL', async () => {
    const req = makePostRequest({
      endpoint: 'not-a-url',
      keys: { p256dh: 'abc', auth: 'def' },
    });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });

  it('returns 400 when p256dh key is missing', async () => {
    const req = makePostRequest({
      endpoint: 'https://push.example.com/sub',
      keys: { auth: 'def' },
    });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });

  it('returns 400 when auth key is missing', async () => {
    const req = makePostRequest({
      endpoint: 'https://push.example.com/sub',
      keys: { p256dh: 'abc' },
    });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });

  it('uses null organizationId when no org context exists', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValue(null);

    const req = makePostRequest();
    await POST(req as any);

    expect(mockPrisma.pushSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ organizationId: null }),
        update: expect.objectContaining({ organizationId: null }),
      })
    );
  });
});

describe('DELETE /api/push/subscribe', () => {
  beforeEach(() => {
    passThrough();
    mockSecurityCheck.mockResolvedValue({
      allowed: true,
      context: { userId: 'user-123' },
    });
    mockPrisma.pushSubscription.deleteMany.mockResolvedValue({ count: 1 });
  });

  it('returns 401 when not authenticated', async () => {
    mockSecurityCheck.mockResolvedValue({
      allowed: false,
      error: 'Unauthorized',
      context: {},
    });

    const req = makeDeleteRequest();
    const res = await DELETE(req as any);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 200 and deletes subscription for valid endpoint', async () => {
    const endpoint = 'https://push.example.com/subscription/abc123';
    const req = makeDeleteRequest({ endpoint });
    const res = await DELETE(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(mockPrisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint, userId: 'user-123' },
    });
  });

  it('returns 400 when body is not valid JSON', async () => {
    const req = createMockNextRequest({
      method: 'DELETE',
      url: 'http://localhost:3000/api/push/subscribe',
    });
    (req as any).json = async () => {
      throw new SyntaxError('Unexpected token');
    };

    const res = await DELETE(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid JSON');
  });

  it('returns 400 when endpoint is missing', async () => {
    const req = makeDeleteRequest({});
    const res = await DELETE(req as any);

    expect(res.status).toBe(400);
  });

  it('returns 400 when endpoint is not a valid URL', async () => {
    const req = makeDeleteRequest({ endpoint: 'not-a-url' });
    const res = await DELETE(req as any);

    expect(res.status).toBe(400);
  });

  it('scopes deletion to the authenticated user', async () => {
    mockSecurityCheck.mockResolvedValue({
      allowed: true,
      context: { userId: 'user-xyz' },
    });

    const endpoint = 'https://push.example.com/sub/other';
    const req = makeDeleteRequest({ endpoint });
    await DELETE(req as any);

    expect(mockPrisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint, userId: 'user-xyz' },
    });
  });
});
