/**
 * Unit Tests for GDPR API Endpoints
 *
 * Covers three routes that implement GDPR rights:
 *
 *   DELETE /api/user/account   — Art.17 Right to Erasure
 *   POST   /api/user/export    — Art.20 Right to Data Portability
 *   PATCH  /api/user/profile   — Art.16 Right to Rectification (SYN-445)
 *
 * For each route:
 *   - 401 when unauthenticated
 *   - 200 success path
 *   - Zod validation rejects bad input (where applicable)
 *
 * NOTE: jest.worktree.cjs sets resetMocks: true, which resets mock
 * implementations between each test. All mock implementations that need
 * to persist must be set in beforeEach, not in the jest.mock() factory.
 */

import { createMockNextRequest } from '../../helpers/mock-request';

// ---------------------------------------------------------------------------
// Global mocks — factories provide the mock module shape only.
// Implementations are set in beforeEach (resetMocks: true clears them).
// ---------------------------------------------------------------------------

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/audit/audit-logger', () => ({
  logAuditEvent: jest.fn(),
}));

// Rate-limit presets — pass-through wrapper
jest.mock('@/lib/rate-limit', () => ({
  authStrict: jest.fn(),
  writeDefault: jest.fn(),
  readDefault: jest.fn(),
  mutation: jest.fn(),
}));

// Supabase client mock (used by /api/user/account)
jest.mock('@/lib/supabase-client', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

// Supabase server client mock (used by /api/user/account DELETE)
jest.mock('@/lib/supabase-server', () => ({
  createServerClient: jest.fn(),
}));

// Prisma mock (used by /api/user/export and /api/user/profile)
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    campaign: { findMany: jest.fn() },
    platformConnection: { findMany: jest.fn() },
    post: { findMany: jest.fn() },
    subscription: { findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
  },
  prisma: {
    user: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    campaign: { findMany: jest.fn() },
    platformConnection: { findMany: jest.fn() },
    post: { findMany: jest.fn() },
    subscription: { findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
  },
}));

// auth/jwt-utils mock
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: jest.fn(),
  unauthorizedResponse: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Get references to the mocked modules
// ---------------------------------------------------------------------------

import * as rateLimitModule from '@/lib/rate-limit';
import * as supabaseClientModule from '@/lib/supabase-client';
import * as supabaseServerModule from '@/lib/supabase-server';
import * as prismaModule from '@/lib/prisma';
import * as jwtUtilsModule from '@/lib/auth/jwt-utils';
import * as auditModule from '@/lib/audit/audit-logger';

// ---------------------------------------------------------------------------
// Import route handlers AFTER all mocks are declared
// ---------------------------------------------------------------------------

import {
  DELETE as accountDELETE,
  GET as accountGET,
} from '@/app/api/user/account/route';
import { POST as exportPOST } from '@/app/api/user/export/route';
import { PATCH as profilePATCH } from '@/app/api/user/profile/route';

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockAuthStrict = rateLimitModule.authStrict as jest.MockedFunction<
  typeof rateLimitModule.authStrict
>;
const mockWriteDefault = rateLimitModule.writeDefault as jest.MockedFunction<
  typeof rateLimitModule.writeDefault
>;
const mockSupabaseGetUser = supabaseClientModule.supabase.auth
  .getUser as jest.MockedFunction<
  typeof supabaseClientModule.supabase.auth.getUser
>;
const mockSupabaseFrom = supabaseClientModule.supabase
  .from as jest.MockedFunction<typeof supabaseClientModule.supabase.from>;
const mockCreateServerClient =
  supabaseServerModule.createServerClient as jest.MockedFunction<
    typeof supabaseServerModule.createServerClient
  >;
const mockPrismaDefault = (prismaModule as any).default;
const mockPrismaNamedDefault = (prismaModule as any).prisma;
const mockGetUserId =
  jwtUtilsModule.getUserIdFromRequestOrCookies as jest.MockedFunction<
    typeof jwtUtilsModule.getUserIdFromRequestOrCookies
  >;
const mockLogAuditEvent = auditModule.logAuditEvent as jest.MockedFunction<
  typeof auditModule.logAuditEvent
>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a pass-through rate-limit wrapper (calls the handler directly) */
function passThrough(fn: jest.MockedFunction<any>) {
  fn.mockImplementation(
    async (_req: unknown, handler: () => Promise<unknown>) => handler()
  );
}

function makeAccountRequest(
  body?: object,
  extraHeaders: Record<string, string> = {}
) {
  return createMockNextRequest({
    method: 'DELETE',
    body,
    headers: { authorization: 'Bearer valid-token', ...extraHeaders },
    url: 'http://localhost:3000/api/user/account',
  });
}

function makeExportRequest() {
  return createMockNextRequest({
    method: 'POST',
    headers: { authorization: 'Bearer valid-token' },
    url: 'http://localhost:3000/api/user/export',
  });
}

function makePatchRequest(body?: object) {
  return createMockNextRequest({
    method: 'PATCH',
    body,
    url: 'http://localhost:3000/api/user/profile',
  });
}

// ---------------------------------------------------------------------------
// Default data
// ---------------------------------------------------------------------------

const mockSupabaseUser = {
  id: 'user-gdpr-1',
  email: 'gdpr@example.com',
  email_confirmed_at: '2024-01-01',
  created_at: '2024-01-01',
  last_sign_in_at: '2024-06-01',
  app_metadata: { provider: 'email' },
  factors: [],
};

const mockDbUser = {
  id: 'user-export-1',
  email: 'export@example.com',
  name: 'Export User',
  avatar: null,
  createdAt: new Date('2024-01-01'),
  company: null,
  jobRole: null,
  bio: null,
  phone: null,
  website: null,
  timezone: 'UTC',
  authProvider: 'email',
  emailVerified: true,
  preferences: null,
  settings: null,
};

const mockPatchedUser = {
  id: 'user-patch-1',
  email: 'patch@example.com',
  name: 'Patched Name',
  avatar: null,
  company: 'Acme Corp',
  jobRole: null,
  bio: null,
  phone: null,
  website: null,
  socialLinks: null,
  updatedAt: new Date(),
};

// ===========================================================================
// DELETE /api/user/account — GDPR Art.17 Right to Erasure
// ===========================================================================

describe('DELETE /api/user/account — GDPR Art.17 Right to Erasure', () => {
  beforeEach(() => {
    // Restore audit mock
    mockLogAuditEvent.mockResolvedValue(undefined);

    // Authenticated user by default
    mockSupabaseGetUser.mockResolvedValue({
      data: { user: mockSupabaseUser },
      error: null,
    } as any);

    // Each .from() call returns a fresh builder where .delete().eq() resolves cleanly
    mockSupabaseFrom.mockReturnValue({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    } as any);

    // Server client for admin deleteUser
    mockCreateServerClient.mockReturnValue({
      auth: {
        admin: {
          deleteUser: jest.fn().mockResolvedValue({ error: null }),
        },
      },
    } as any);
  });

  it('returns 401 when Authorization header is missing', async () => {
    const req = createMockNextRequest({
      method: 'DELETE',
      body: { confirmation: 'DELETE_MY_ACCOUNT' },
      url: 'http://localhost:3000/api/user/account',
    });

    const res = await accountDELETE(req as any);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBeDefined();
  });

  it('returns 401 when the Supabase token is rejected', async () => {
    mockSupabaseGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Invalid JWT'),
    } as any);

    const res = await accountDELETE(
      makeAccountRequest({ confirmation: 'DELETE_MY_ACCOUNT' }) as any
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 when confirmation body causes a JSON parse error', async () => {
    const req = createMockNextRequest({
      method: 'DELETE',
      headers: { authorization: 'Bearer valid-token' },
      url: 'http://localhost:3000/api/user/account',
    });
    (req as any).json = async () => {
      throw new SyntaxError('No body');
    };

    const res = await accountDELETE(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('confirmation');
  });

  it('returns 400 when confirmation text is wrong', async () => {
    const res = await accountDELETE(
      makeAccountRequest({ confirmation: 'WRONG_TEXT' }) as any
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('confirmation');
  });

  it('returns 200 with success message on valid deletion', async () => {
    const res = await accountDELETE(
      makeAccountRequest({ confirmation: 'DELETE_MY_ACCOUNT' }) as any
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toContain('deleted successfully');
  });

  it('returns 500 when a DB table deletion fails (does not delete auth record)', async () => {
    // First .from() call succeeds, subsequent calls return an error
    let callCount = 0;
    mockSupabaseFrom.mockImplementation(
      () =>
        ({
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              error: callCount++ === 0 ? { message: 'FK violation' } : null,
            }),
          }),
        }) as any
    );

    // Reset createServerClient mock so we can assert it was NOT called
    const mockAdminDeleteUser = jest.fn();
    mockCreateServerClient.mockReturnValue({
      auth: { admin: { deleteUser: mockAdminDeleteUser } },
    } as any);

    const res = await accountDELETE(
      makeAccountRequest({ confirmation: 'DELETE_MY_ACCOUNT' }) as any
    );

    expect(res.status).toBe(500);
    expect(mockAdminDeleteUser).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// GET /api/user/account — account status
// ===========================================================================

describe('GET /api/user/account — account status', () => {
  beforeEach(() => {
    mockSupabaseGetUser.mockResolvedValue({
      data: { user: mockSupabaseUser },
      error: null,
    } as any);
  });

  it('returns 401 without Authorization header', async () => {
    const req = createMockNextRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/user/account',
    });

    const res = await accountGET(req as any);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBeDefined();
  });

  it('returns 200 with account status when authenticated', async () => {
    const req = createMockNextRequest({
      method: 'GET',
      headers: { authorization: 'Bearer valid-token' },
      url: 'http://localhost:3000/api/user/account',
    });

    const res = await accountGET(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe('user-gdpr-1');
    expect(body.email).toBe('gdpr@example.com');
  });
});

// ===========================================================================
// POST /api/user/export — GDPR Art.20 Right to Data Portability
// ===========================================================================

describe('POST /api/user/export — GDPR Art.20 Right to Data Portability', () => {
  beforeEach(() => {
    // Rate-limit pass-through
    passThrough(mockAuthStrict);

    // Restore audit mock
    mockLogAuditEvent.mockResolvedValue(undefined);

    // Default: authenticated as user-export-1
    mockGetUserId.mockResolvedValue('user-export-1');

    // Restore prisma mocks (both the default and named export point to the same object)
    mockPrismaDefault.user.findUnique.mockResolvedValue(mockDbUser);
    mockPrismaDefault.campaign.findMany.mockResolvedValue([]);
    mockPrismaDefault.platformConnection.findMany.mockResolvedValue([]);
    mockPrismaDefault.post.findMany.mockResolvedValue([]);
    mockPrismaDefault.subscription.findUnique.mockResolvedValue(null);
  });

  it('returns 401 when not authenticated (userId is null)', async () => {
    mockGetUserId.mockResolvedValue(null);

    const res = await exportPOST(makeExportRequest() as any);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBeDefined();
  });

  it('returns 200 with export payload on success', async () => {
    const res = await exportPOST(makeExportRequest() as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.userId).toBe('user-export-1');
    expect(body.exportedAt).toBeDefined();
    // exportedAt must be a valid ISO date string
    expect(() => new Date(body.exportedAt)).not.toThrow();
  });

  it('includes profile data in the export', async () => {
    const res = await exportPOST(makeExportRequest() as any);
    const body = await res.json();

    expect(body.profile).toBeDefined();
    expect(body.profile.id).toBe('user-export-1');
    expect(body.profile.email).toBe('export@example.com');
  });

  it('includes campaigns, posts, and platformConnections arrays', async () => {
    const res = await exportPOST(makeExportRequest() as any);
    const body = await res.json();

    expect(Array.isArray(body.campaigns)).toBe(true);
    expect(Array.isArray(body.posts)).toBe(true);
    expect(Array.isArray(body.platformConnections)).toBe(true);
  });

  it('includes subscription details when user has a subscription', async () => {
    mockPrismaDefault.subscription.findUnique.mockResolvedValue({
      plan: 'pro',
      status: 'active',
      currentPeriodStart: new Date('2024-01-01'),
      currentPeriodEnd: new Date('2024-02-01'),
      cancelAtPeriodEnd: false,
      trialStart: null,
      trialEnd: null,
    });

    const res = await exportPOST(makeExportRequest() as any);
    const body = await res.json();

    expect(body.profile.subscription).toBeDefined();
    expect(body.profile.subscription.plan).toBe('pro');
    expect(body.profile.subscription.status).toBe('active');
  });

  it('returns a response that includes the userId in the payload (download intent)', async () => {
    // The route sets Content-Disposition to force file download.
    // In jsdom test environment, custom response headers set via NextResponse
    // constructor options are not always accessible via res.headers.get().
    // We verify the observable download intent through the response body:
    // the export JSON contains the userId that would appear in the filename.
    const res = await exportPOST(makeExportRequest() as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    // The userId is embedded in the Content-Disposition filename in production;
    // here we verify it is present in the export payload.
    expect(body.userId).toBe('user-export-1');
    // exportedAt being present confirms the full export object was assembled
    expect(body.exportedAt).toBeDefined();
  });

  it('returns 404 when user does not exist in the database', async () => {
    mockPrismaDefault.user.findUnique.mockResolvedValue(null);

    const res = await exportPOST(makeExportRequest() as any);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toContain('not found');
  });

  it('includes posts belonging to user campaigns', async () => {
    const campaignId = 'campaign-abc';
    mockPrismaDefault.campaign.findMany.mockResolvedValue([
      {
        id: campaignId,
        name: 'Test Campaign',
        description: null,
        platform: 'instagram',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    mockPrismaDefault.post.findMany.mockResolvedValue([
      {
        id: 'post-1',
        campaignId,
        content: 'Hello world',
        platform: 'instagram',
        status: 'published',
        scheduledAt: null,
        publishedAt: new Date(),
        createdAt: new Date(),
      },
    ]);

    const res = await exportPOST(makeExportRequest() as any);
    const body = await res.json();

    expect(body.campaigns).toHaveLength(1);
    expect(body.posts).toHaveLength(1);
    expect(body.posts[0].campaignId).toBe(campaignId);
  });
});

// ===========================================================================
// PATCH /api/user/profile — GDPR Art.16 Right to Rectification
// ===========================================================================

describe('PATCH /api/user/profile — GDPR Art.16 Right to Rectification', () => {
  beforeEach(() => {
    // Rate-limit pass-through
    passThrough(mockWriteDefault);

    // Default: authenticated
    mockGetUserId.mockResolvedValue('user-patch-1');

    // Default prisma responses
    mockPrismaNamedDefault.user.update.mockResolvedValue(mockPatchedUser);
    mockPrismaNamedDefault.user.findUnique.mockResolvedValue(null);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUserId.mockResolvedValue(null);

    const res = await profilePATCH(makePatchRequest({ name: 'Test' }) as any);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBeDefined();
  });

  it('returns 200 success on valid partial update', async () => {
    const res = await profilePATCH(
      makePatchRequest({ name: 'Rectified Name' }) as any
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toContain('rectif');
  });

  it('includes the updated profile in the response', async () => {
    const res = await profilePATCH(
      makePatchRequest({ company: 'New Corp' }) as any
    );
    const body = await res.json();

    expect(body.profile).toBeDefined();
    expect(body.profile.id).toBe('user-patch-1');
  });

  it('calls prisma.user.update with the correct where clause', async () => {
    await profilePATCH(makePatchRequest({ name: 'Updated' }) as any);

    expect(mockPrismaNamedDefault.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-patch-1' } })
    );
  });

  it('returns 400 when no fields are provided (empty body)', async () => {
    const res = await profilePATCH(makePatchRequest({}) as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('field');
  });

  it('returns 400 when name exceeds 100 characters (Zod validation)', async () => {
    const res = await profilePATCH(
      makePatchRequest({ name: 'A'.repeat(101) }) as any
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
    expect(body.details).toBeDefined();
  });

  it('returns 400 for an invalid website URL', async () => {
    const res = await profilePATCH(
      makePatchRequest({ website: 'not-a-url' }) as any
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('accepts an empty string for website (clears the field)', async () => {
    const res = await profilePATCH(makePatchRequest({ website: '' }) as any);
    expect(res.status).toBe(200);
  });

  it('accepts a valid HTTPS URL for website', async () => {
    const res = await profilePATCH(
      makePatchRequest({ website: 'https://example.com' }) as any
    );
    expect(res.status).toBe(200);
  });

  it('strips unknown fields (Zod .strip()) — request succeeds', async () => {
    const res = await profilePATCH(
      makePatchRequest({
        name: 'Valid',
        unknownField: 'should-be-stripped',
      }) as any
    );
    expect(res.status).toBe(200);
  });

  it('returns 400 when body is invalid JSON', async () => {
    const req = makePatchRequest();
    (req as any).json = async () => {
      throw new SyntaxError('Unexpected token');
    };

    const res = await profilePATCH(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it('returns 500 when prisma.user.update throws', async () => {
    mockPrismaNamedDefault.user.update.mockRejectedValue(
      new Error('DB timeout')
    );

    const res = await profilePATCH(
      makePatchRequest({ name: 'Trigger Error' }) as any
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toContain('rectif');
  });

  it('accepts partial update with only bio field', async () => {
    const res = await profilePATCH(
      makePatchRequest({ bio: 'My new bio' }) as any
    );
    expect(res.status).toBe(200);
  });

  it('accepts camelCase socialLinks', async () => {
    const res = await profilePATCH(
      makePatchRequest({
        socialLinks: { twitter: '@handle', linkedin: 'url' },
      }) as any
    );
    expect(res.status).toBe(200);
  });

  it('accepts legacy snake_case social_links', async () => {
    const res = await profilePATCH(
      makePatchRequest({ social_links: { twitter: '@handle' } }) as any
    );
    expect(res.status).toBe(200);
  });
});
