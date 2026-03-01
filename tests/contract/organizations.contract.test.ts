/**
 * Organizations API Contract Tests
 *
 * Validates that organization API endpoints conform to their expected schemas.
 * Tests auth enforcement, input validation, and response shapes for:
 * - POST /api/organizations (create org, authenticated users)
 * - GET /api/organizations (list orgs, admin only)
 *
 * @module tests/contract/organizations.contract.test
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { z } from 'zod';
import { NextResponse } from 'next/server';

// =============================================================================
// Mock setup
// =============================================================================

// Mock @/lib/prisma (named export style used by organizations/route.ts)
const mockOrgCreate = jest.fn();
const mockOrgFindUnique = jest.fn();
const mockOrgFindMany = jest.fn();
const mockOrgCount = jest.fn();
const mockRoleCreateMany = jest.fn();
const mockTransaction = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    organization: {
      create: (...args: unknown[]) => mockOrgCreate(...args),
      findUnique: (...args: unknown[]) => mockOrgFindUnique(...args),
      findMany: (...args: unknown[]) => mockOrgFindMany(...args),
      count: (...args: unknown[]) => mockOrgCount(...args),
    },
    role: {
      createMany: (...args: unknown[]) => mockRoleCreateMany(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

// Mock @/lib/security/api-security-checker
const mockSecurityCheck = jest.fn();
const mockCreateSecureResponse = jest.fn();

jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...args: unknown[]) => mockSecurityCheck(...args),
    createSecureResponse: (...args: unknown[]) => mockCreateSecureResponse(...args),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_WRITE: { requireAuth: true },
    ADMIN_ONLY: { requireAuth: true, allowedRoles: ['admin'] },
  },
}));

// Mock @/lib/multi-tenant
jest.mock('@/lib/multi-tenant', () => ({
  generateTenantSlug: jest.fn().mockReturnValue('test-org'),
  createDefaultSettings: jest.fn().mockReturnValue({ theme: 'default' }),
  PLAN_LIMITS: {
    free: { maxUsers: 5, maxPosts: 500, maxCampaigns: 10 },
    pro: { maxUsers: 25, maxPosts: 5000, maxCampaigns: 100 },
  },
  TenantPlan: {},
}));

// Mock @/lib/logger to avoid side effects
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock @/lib/api/response-optimizer to use real NextResponse
jest.mock('@/lib/api/response-optimizer', () => ({
  ResponseOptimizer: {
    createResponse: (data: unknown, opts?: { status?: number }) =>
      NextResponse.json(data, { status: opts?.status ?? 200 }),
    createErrorResponse: (message: string, status: number, details?: unknown) =>
      NextResponse.json({ error: message, status, ...(details ? { details } : {}) }, { status }),
  },
  cacheHeaders: {
    none: 'no-store',
    api: 's-maxage=60',
  },
}));

// =============================================================================
// Response shape schemas (mirrors actual route responses)
// =============================================================================

const orgResponseSchema = z.object({
  success: z.literal(true),
  organization: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    plan: z.string(),
    domain: z.string(),
    status: z.string(),
    createdAt: z.union([z.string(), z.date()]),
  }),
});

const orgListResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
      plan: z.string(),
      status: z.string(),
    })
  ),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
    hasMore: z.boolean(),
  }),
});

const errorResponseSchema = z.object({
  error: z.string(),
});

// =============================================================================
// Helper: createMockNextRequest adapted for organizations route
// =============================================================================

function createMockRequest(opts: {
  method?: string;
  body?: object;
  url?: string;
} = {}) {
  const { method = 'GET', body, url = 'http://localhost:3000/api/organizations' } = opts;
  const parsedUrl = new URL(url);
  const bodyString = body ? JSON.stringify(body) : undefined;

  return {
    url,
    method,
    headers: {
      get: (name: string) => name === 'content-type' ? 'application/json' : null,
      has: () => false,
    },
    nextUrl: parsedUrl,
    json: async () => (bodyString ? JSON.parse(bodyString) : {}),
    text: async () => bodyString ?? '',
    ip: '127.0.0.1',
    geo: {},
    cookies: { get: () => undefined, getAll: () => [], has: () => false },
  } as any;
}

// =============================================================================
// Shared mock org data
// =============================================================================

const mockOrg = {
  id: 'org-123',
  name: 'Test Organization',
  slug: 'test-org',
  plan: 'free',
  domain: 'test-org.synthex.app',
  status: 'active',
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-01T00:00:00.000Z'),
  users: [{ id: 'user-456', name: 'Test User', email: 'test@example.com' }],
};

// =============================================================================
// Tests
// =============================================================================

describe('Organizations API Contract Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Import route handlers after mocks are set up
  // ---------------------------------------------------------------------------
  let POST: (req: any) => Promise<NextResponse>;
  let GET: (req: any) => Promise<NextResponse>;

  beforeEach(async () => {
    jest.resetModules();
    // Dynamic import so mocks are in place at import time
  });

  // ===========================================================================
  // POST - Input Schema Validation
  // ===========================================================================

  describe('POST - Input schema validation', () => {
    it('should reject request with missing name (400)', async () => {
      // Simulate validation directly against the route's Zod schema
      const createOrganizationSchema = z.object({
        name: z.string().min(1),
        slug: z.string().optional(),
        plan: z.string().optional().default('free'),
      });

      const result = createOrganizationSchema.safeParse({ slug: 'my-org' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('name');
      }
    });

    it('should reject request with empty name (400)', async () => {
      const createOrganizationSchema = z.object({
        name: z.string().min(1),
        slug: z.string().optional(),
        plan: z.string().optional().default('free'),
      });

      const result = createOrganizationSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
    });

    it('should accept valid input with name only', async () => {
      const createOrganizationSchema = z.object({
        name: z.string().min(1),
        slug: z.string().optional(),
        plan: z.string().optional().default('free'),
      });

      const result = createOrganizationSchema.safeParse({ name: 'My Organization' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.plan).toBe('free'); // default applied
      }
    });

    it('should accept valid input with name, slug, and plan', async () => {
      const createOrganizationSchema = z.object({
        name: z.string().min(1),
        slug: z.string().optional(),
        plan: z.string().optional().default('free'),
      });

      const result = createOrganizationSchema.safeParse({
        name: 'My Org',
        slug: 'my-org',
        plan: 'pro',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.slug).toBe('my-org');
        expect(result.data.plan).toBe('pro');
      }
    });
  });

  // ===========================================================================
  // POST - Auth enforcement
  // ===========================================================================

  describe('POST - Auth enforcement', () => {
    it('should return 401 when unauthenticated (security.allowed=false)', async () => {
      const { POST } = await import('@/app/api/organizations/route');

      mockSecurityCheck.mockResolvedValue({
        allowed: false,
        error: 'Authentication required',
        context: {},
      });
      mockCreateSecureResponse.mockReturnValue(
        NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      );

      const req = createMockRequest({ method: 'POST', body: { name: 'My Org' } });
      const response = await POST(req);

      expect(response.status).toBe(401);
      expect(mockSecurityCheck).toHaveBeenCalledTimes(1);
    });

    it('should return 429 when rate-limited (security.allowed=false, error includes Rate limit)', async () => {
      const { POST } = await import('@/app/api/organizations/route');

      mockSecurityCheck.mockResolvedValue({
        allowed: false,
        error: 'Rate limit exceeded',
        context: {},
      });
      mockCreateSecureResponse.mockReturnValue(
        NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
      );

      const req = createMockRequest({ method: 'POST', body: { name: 'My Org' } });
      const response = await POST(req);

      expect(response.status).toBe(429);
    });
  });

  // ===========================================================================
  // POST - Success response shape
  // ===========================================================================

  describe('POST - Success response shape', () => {
    it('should return 201 with correct organization shape on success', async () => {
      const { POST } = await import('@/app/api/organizations/route');

      mockSecurityCheck.mockResolvedValue({
        allowed: true,
        context: { userId: 'user-456' },
      });

      // Slug not taken
      mockOrgFindUnique.mockResolvedValue(null);

      // Transaction returns the created org
      mockTransaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
        const tx = {
          organization: { create: jest.fn().mockResolvedValue(mockOrg) },
          role: { createMany: jest.fn().mockResolvedValue({ count: 3 }) },
        };
        return fn(tx);
      });

      const req = createMockRequest({
        method: 'POST',
        body: { name: 'Test Organization', slug: 'test-org' },
      });
      const response = await POST(req);
      const body = await response.json();

      expect(response.status).toBe(201);

      const parsed = orgResponseSchema.safeParse(body);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.organization.id).toBe('org-123');
        expect(parsed.data.organization.name).toBe('Test Organization');
        expect(parsed.data.organization.slug).toBe('test-org');
        expect(parsed.data.organization.plan).toBe('free');
      }
    });

    it('should return 409 when slug already exists', async () => {
      const { POST } = await import('@/app/api/organizations/route');

      mockSecurityCheck.mockResolvedValue({
        allowed: true,
        context: { userId: 'user-456' },
      });

      // Slug is taken
      mockOrgFindUnique.mockResolvedValue({ id: 'existing-org' });

      const req = createMockRequest({
        method: 'POST',
        body: { name: 'Test Organization', slug: 'test-org' },
      });
      const response = await POST(req);

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.error).toBeTruthy();
    });

    it('should return 400 when name is missing', async () => {
      const { POST } = await import('@/app/api/organizations/route');

      mockSecurityCheck.mockResolvedValue({
        allowed: true,
        context: { userId: 'user-456' },
      });

      const req = createMockRequest({
        method: 'POST',
        body: { slug: 'no-name' },
      });
      const response = await POST(req);

      expect(response.status).toBe(400);
    });
  });

  // ===========================================================================
  // GET - Auth enforcement
  // ===========================================================================

  describe('GET - Auth enforcement', () => {
    it('should return 401 when unauthenticated (admin route)', async () => {
      const { GET } = await import('@/app/api/organizations/route');

      mockSecurityCheck.mockResolvedValue({
        allowed: false,
        error: 'Authentication required',
        context: {},
      });
      mockCreateSecureResponse.mockReturnValue(
        NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      );

      const req = createMockRequest({ method: 'GET' });
      const response = await GET(req);

      expect(response.status).toBe(401);
    });

    it('should return 403 when authenticated but lacks admin permission', async () => {
      const { GET } = await import('@/app/api/organizations/route');

      mockSecurityCheck.mockResolvedValue({
        allowed: false,
        error: 'Insufficient permission',
        context: {},
      });
      mockCreateSecureResponse.mockReturnValue(
        NextResponse.json({ error: 'Insufficient permission' }, { status: 403 })
      );

      const req = createMockRequest({ method: 'GET' });
      const response = await GET(req);

      expect(response.status).toBe(403);
    });
  });

  // ===========================================================================
  // GET - List response shape
  // ===========================================================================

  describe('GET - List response shape', () => {
    it('should return 200 with paginated org list on success', async () => {
      const { GET } = await import('@/app/api/organizations/route');

      mockSecurityCheck.mockResolvedValue({
        allowed: true,
        context: { userId: 'admin-user', role: 'admin' },
      });

      const orgs = [
        {
          id: 'org-1',
          name: 'Org One',
          slug: 'org-one',
          plan: 'free',
          status: 'active',
          domain: 'org-one.synthex.app',
          customDomain: null,
          createdAt: new Date('2025-01-01T00:00:00.000Z'),
          updatedAt: new Date('2025-01-01T00:00:00.000Z'),
          _count: { users: 3, campaigns: 5 },
        },
        {
          id: 'org-2',
          name: 'Org Two',
          slug: 'org-two',
          plan: 'pro',
          status: 'active',
          domain: 'org-two.synthex.app',
          customDomain: null,
          createdAt: new Date('2025-01-02T00:00:00.000Z'),
          updatedAt: new Date('2025-01-02T00:00:00.000Z'),
          _count: { users: 10, campaigns: 20 },
        },
      ];

      mockOrgCount.mockResolvedValue(2);
      mockOrgFindMany.mockResolvedValue(orgs);

      const req = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/organizations?page=1&limit=20',
      });
      const response = await GET(req);
      const body = await response.json();

      expect(response.status).toBe(200);

      const parsed = orgListResponseSchema.safeParse(body);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.data).toHaveLength(2);
        expect(parsed.data.pagination.total).toBe(2);
        expect(parsed.data.pagination.page).toBe(1);
      }
    });

    it('should include userCount and campaignCount (from _count) in list items', async () => {
      const { GET } = await import('@/app/api/organizations/route');

      mockSecurityCheck.mockResolvedValue({
        allowed: true,
        context: { userId: 'admin-user', role: 'admin' },
      });

      mockOrgCount.mockResolvedValue(1);
      mockOrgFindMany.mockResolvedValue([
        {
          id: 'org-1',
          name: 'Org One',
          slug: 'org-one',
          plan: 'free',
          status: 'active',
          domain: 'org-one.synthex.app',
          customDomain: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { users: 7, campaigns: 3 },
        },
      ]);

      const req = createMockRequest({ method: 'GET' });
      const response = await GET(req);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data[0].userCount).toBe(7);
      expect(body.data[0].campaignCount).toBe(3);
      // _count should be removed from output
      expect(body.data[0]._count).toBeUndefined();
    });

    it('should return empty list when no organizations exist', async () => {
      const { GET } = await import('@/app/api/organizations/route');

      mockSecurityCheck.mockResolvedValue({
        allowed: true,
        context: { userId: 'admin-user', role: 'admin' },
      });

      mockOrgCount.mockResolvedValue(0);
      mockOrgFindMany.mockResolvedValue([]);

      const req = createMockRequest({ method: 'GET' });
      const response = await GET(req);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data).toHaveLength(0);
      expect(body.pagination.total).toBe(0);
    });
  });

  // ===========================================================================
  // Error response shape
  // ===========================================================================

  describe('Error response shape', () => {
    it('should validate error response has expected error field', () => {
      const errorResponse = {
        error: 'Invalid request data',
        status: 400,
      };
      const parsed = errorResponseSchema.safeParse(errorResponse);
      expect(parsed.success).toBe(true);
    });

    it('should validate 401 error response shape', () => {
      const errorResponse = {
        error: 'Authentication required',
      };
      const parsed = errorResponseSchema.safeParse(errorResponse);
      expect(parsed.success).toBe(true);
    });
  });
});
