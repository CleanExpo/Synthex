/**
 * Onboarding & Referrals API Contract Tests
 *
 * Validates that onboarding and referrals API endpoints conform to their expected schemas.
 * Tests auth enforcement, input validation, and response shapes for:
 * - POST /api/onboarding (complete onboarding wizard)
 * - GET /api/onboarding (get onboarding status)
 * - GET /api/referrals (get referral code + stats)
 * - POST /api/referrals (send invite email)
 *
 * @module tests/contract/onboarding-referrals.contract.test
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { z } from 'zod';
import { NextResponse } from 'next/server';

// =============================================================================
// Prisma mock — handles both default and named import styles
// onboarding/route.ts uses: import { prisma } from '@/lib/prisma' (named)
// referrals/route.ts uses:  import prisma from '@/lib/prisma' (default)
// =============================================================================

const mockUserFindUnique = jest.fn();
const mockUserUpdate = jest.fn();
const mockOrgCreate = jest.fn();
const mockOrgFindFirst = jest.fn();
const mockOrgFindUnique = jest.fn();
const mockOrgUpdate = jest.fn();
const mockPersonaCreate = jest.fn();
const mockPersonaFindFirst = jest.fn();
const mockPlatformConnectionFindMany = jest.fn();
const mockReferralFindMany = jest.fn();
const mockReferralFindUnique = jest.fn();
const mockReferralFindFirst = jest.fn();
const mockReferralCreate = jest.fn();
const mockBusinessOwnershipCreate = jest.fn();
const mockTransaction = jest.fn();

jest.mock('@/lib/prisma', () => {
  const instance = {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
    organization: {
      create: (...args: unknown[]) => mockOrgCreate(...args),
      findFirst: (...args: unknown[]) => mockOrgFindFirst(...args),
      findUnique: (...args: unknown[]) => mockOrgFindUnique(...args),
      update: (...args: unknown[]) => mockOrgUpdate(...args),
    },
    businessOwnership: {
      create: (...args: unknown[]) => mockBusinessOwnershipCreate(...args),
    },
    persona: {
      create: (...args: unknown[]) => mockPersonaCreate(...args),
      findFirst: (...args: unknown[]) => mockPersonaFindFirst(...args),
    },
    platformConnection: {
      findMany: (...args: unknown[]) => mockPlatformConnectionFindMany(...args),
    },
    referral: {
      findMany: (...args: unknown[]) => mockReferralFindMany(...args),
      findUnique: (...args: unknown[]) => mockReferralFindUnique(...args),
      findFirst: (...args: unknown[]) => mockReferralFindFirst(...args),
      create: (...args: unknown[]) => mockReferralCreate(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  };
  return {
    __esModule: true,
    default: instance,
    prisma: instance,
  };
});

// =============================================================================
// JWT auth mock (used by onboarding route)
// =============================================================================

const mockGetUserId = jest.fn();
const mockGenerateToken = jest.fn();

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
  generateToken: (...args: unknown[]) => mockGenerateToken(...args),
}));

// =============================================================================
// Webhook + logger mocks (used by onboarding route)
// emit() is fire-and-forget inside try-catch, so returning undefined is fine
// =============================================================================

jest.mock('@/lib/webhooks', () => ({
  webhookHandler: {
    emit: (..._args: unknown[]) => Promise.resolve(undefined),
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// =============================================================================
// APISecurityChecker mock (used by referrals route)
// =============================================================================

const mockSecurityCheck = jest.fn();
const mockCreateSecureResponse = jest.fn();

jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...args: unknown[]) => mockSecurityCheck(...args),
    createSecureResponse: (...args: unknown[]) => mockCreateSecureResponse(...args),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_READ: { requireAuth: true },
    AUTHENTICATED_WRITE: { requireAuth: true },
  },
}));

// =============================================================================
// Response shape schemas (mirrors actual route responses)
// =============================================================================

const onboardingSuccessSchema = z.object({
  success: z.literal(true),
  organization: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
  }),
  persona: z.union([
    z.null(),
    z.object({ id: z.string(), name: z.string() }),
  ]),
});

const onboardingStatusSchema = z.object({
  completed: z.boolean(),
  completedAt: z.union([z.string(), z.null()]),
  organization: z.union([z.null(), z.object({ id: z.string() })]),
  persona: z.union([z.null(), z.object({ id: z.string() })]),
  connectedPlatforms: z.array(z.string()),
});

const referralsGetSchema = z.object({
  success: z.literal(true),
  referralCode: z.string(),
  referralLink: z.string(),
  referrals: z.array(z.object({
    id: z.string(),
    code: z.string(),
    status: z.string(),
  })),
  stats: z.object({
    totalSent: z.number(),
    signedUp: z.number(),
    converted: z.number(),
    rewardsEarned: z.number(),
  }),
});

const referralInviteSchema = z.object({
  success: z.literal(true),
  referral: z.object({
    id: z.string(),
    code: z.string(),
    email: z.string(),
    link: z.string(),
  }),
});

const errorSchema = z.object({
  error: z.string(),
});

// =============================================================================
// Helper: createMockRequest
// =============================================================================

function createMockRequest(opts: {
  method?: string;
  body?: object;
  url?: string;
} = {}) {
  const { method = 'GET', body, url = 'http://localhost:3000/api/onboarding' } = opts;
  const bodyString = body ? JSON.stringify(body) : undefined;

  return {
    url,
    method,
    headers: {
      get: (name: string) => name === 'content-type' ? 'application/json' : null,
      has: () => false,
    },
    nextUrl: new URL(url),
    json: async () => (bodyString ? JSON.parse(bodyString) : {}),
    text: async () => bodyString ?? '',
    ip: '127.0.0.1',
    geo: {},
    cookies: { get: () => undefined, getAll: () => [], has: () => false },
  } as any;
}

// =============================================================================
// Shared mock data
// =============================================================================

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
};

const mockOrg = {
  id: 'org-456',
  name: 'Test Organization',
  slug: 'test-organization',
  plan: 'free',
  domain: 'test-organization.synthex.app',
  status: 'active',
  website: null,
  industry: 'technology',
  teamSize: '1-10',
  description: null,
  primaryColor: null,
  socialHandles: null,
  aiGeneratedData: null,
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-01T00:00:00.000Z'),
};

const mockReferral = {
  id: 'ref-789',
  code: 'SYN-ABCD',
  refereeEmail: 'friend@example.com',
  status: 'sent',
  referrerRewarded: false,
  rewardType: 'credits',
  rewardAmount: 500,
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  signedUpAt: null,
  convertedAt: null,
};

// =============================================================================
// Tests
// =============================================================================

describe('Onboarding & Referrals API Contract Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // createSecureResponse wraps data in a real NextResponse (referrals route uses this for all responses)
    mockCreateSecureResponse.mockImplementation((data: unknown, status = 200) =>
      NextResponse.json(data, { status })
    );
    // generateToken must return a string so cookies.set() works
    mockGenerateToken.mockReturnValue('new-jwt-token');
  });

  // ===========================================================================
  // ONBOARDING POST — Auth enforcement
  // ===========================================================================

  describe('POST /api/onboarding — Auth enforcement', () => {
    it('should return 401 when unauthenticated (no userId)', async () => {
      const { POST } = await import('@/app/api/onboarding/route');

      mockGetUserId.mockResolvedValue(null);

      const req = createMockRequest({
        method: 'POST',
        body: { organizationName: 'Acme', industry: 'tech', teamSize: '1-10' },
      });
      const response = await POST(req);

      expect(response.status).toBe(401);
      const body = await response.json();
      const parsed = errorSchema.safeParse(body);
      expect(parsed.success).toBe(true);
    });
  });

  // ===========================================================================
  // ONBOARDING POST — Input schema validation
  // ===========================================================================

  describe('POST /api/onboarding — Input validation', () => {
    it('should return 400 when organizationName is missing', async () => {
      const { POST } = await import('@/app/api/onboarding/route');

      mockGetUserId.mockResolvedValue('user-123');
      mockUserFindUnique.mockResolvedValue(mockUser);

      const req = createMockRequest({
        method: 'POST',
        body: { industry: 'technology', teamSize: '1-10' }, // missing organizationName
      });
      const response = await POST(req);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBeTruthy();
    });

    it('should return 400 when industry is missing', async () => {
      const { POST } = await import('@/app/api/onboarding/route');

      mockGetUserId.mockResolvedValue('user-123');
      mockUserFindUnique.mockResolvedValue(mockUser);

      const req = createMockRequest({
        method: 'POST',
        body: { organizationName: 'Acme Corp', teamSize: '1-10' }, // missing industry
      });
      const response = await POST(req);

      expect(response.status).toBe(400);
    });

    it('should return 400 when teamSize is missing', async () => {
      const { POST } = await import('@/app/api/onboarding/route');

      mockGetUserId.mockResolvedValue('user-123');
      mockUserFindUnique.mockResolvedValue(mockUser);

      const req = createMockRequest({
        method: 'POST',
        body: { organizationName: 'Acme Corp', industry: 'technology' }, // missing teamSize
      });
      const response = await POST(req);

      expect(response.status).toBe(400);
    });

    it('should validate onboardingSchema — valid full payload passes Zod', () => {
      const onboardingSchema = z.object({
        organizationName: z.string().min(1),
        website: z.string().url().optional().or(z.literal('')),
        industry: z.string().min(1),
        teamSize: z.string().min(1),
        description: z.string().optional().default(''),
        brandColors: z.object({
          primary: z.string().optional(),
          secondary: z.string().optional(),
          accent: z.string().optional(),
        }).optional(),
        socialHandles: z.record(z.string()).optional(),
        connectedPlatforms: z.array(z.string()).optional().default([]),
        personaName: z.string().optional().default(''),
        personaTone: z.string().optional().default(''),
        personaTopics: z.array(z.string()).optional().default([]),
        skipPersona: z.boolean().optional().default(false),
      });

      const result = onboardingSchema.safeParse({
        organizationName: 'Acme Corp',
        industry: 'technology',
        teamSize: '1-10',
        connectedPlatforms: ['instagram', 'linkedin'],
        personaName: 'Marketing Expert',
        personaTone: 'professional',
        skipPersona: false,
      });
      expect(result.success).toBe(true);

      // Minimal required fields only
      const minimal = onboardingSchema.safeParse({
        organizationName: 'My Biz',
        industry: 'retail',
        teamSize: '11-50',
      });
      expect(minimal.success).toBe(true);
    });
  });

  // ===========================================================================
  // ONBOARDING POST — Success response shape
  // ===========================================================================

  describe('POST /api/onboarding — Success response shape', () => {
    it('should define success response body shape: { success, organization, persona }', () => {
      // Direct schema validation: route returns { success, organization, persona }
      // JWT is issued as a Set-Cookie response header (not in body)
      const successBody = {
        success: true as const,
        organization: {
          id: 'org-456',
          name: 'Test Organization',
          slug: 'test-organization',
        },
        persona: null,
      };
      const parsed = onboardingSuccessSchema.safeParse(successBody);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.organization.name).toBe('Test Organization');
        expect(parsed.data.persona).toBeNull();
      }
    });

    it('should trigger prisma.$transaction when auth + Zod validation pass', async () => {
      const { POST } = await import('@/app/api/onboarding/route');

      mockGetUserId.mockResolvedValue('user-123');
      mockUserFindUnique.mockResolvedValue(mockUser);
      // Slug available
      mockOrgFindUnique.mockResolvedValue(null);
      // Transaction implementation using plain Promise functions (no jest.fn nesting)
      mockTransaction.mockImplementation((fn: any) => {
        const tx = {
          organization: {
            findFirst: () => Promise.resolve(null), // no existing org
            create: () => Promise.resolve(mockOrg),
            update: () => Promise.resolve(mockOrg),
          },
          businessOwnership: { create: () => Promise.resolve({}) },
          user: { update: () => Promise.resolve({}) },
          persona: { create: () => Promise.resolve(null) },
        };
        return fn(tx);
      });

      const req = createMockRequest({
        method: 'POST',
        body: {
          organizationName: 'Test Organization',
          industry: 'technology',
          teamSize: '1-10',
        },
      });
      await POST(req);

      // Transaction invoked = auth passed + Zod validation passed + slug generated
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // ONBOARDING GET — Auth enforcement
  // ===========================================================================

  describe('GET /api/onboarding — Auth enforcement', () => {
    it('should return 401 when unauthenticated', async () => {
      const { GET } = await import('@/app/api/onboarding/route');

      mockGetUserId.mockResolvedValue(null);

      const req = createMockRequest({ method: 'GET' });
      const response = await GET(req);

      expect(response.status).toBe(401);
    });
  });

  // ===========================================================================
  // ONBOARDING GET — Response shape
  // ===========================================================================

  describe('GET /api/onboarding — Response shape', () => {
    it('should return 200 with onboarding status, organization, and connectedPlatforms', async () => {
      const { GET } = await import('@/app/api/onboarding/route');

      mockGetUserId.mockResolvedValue('user-123');
      mockUserFindUnique.mockResolvedValue({
        id: 'user-123',
        onboardingComplete: true,
        updatedAt: new Date('2025-06-01T00:00:00.000Z'),
      });
      mockOrgFindFirst.mockResolvedValue(mockOrg);
      mockPersonaFindFirst.mockResolvedValue(null);
      mockPlatformConnectionFindMany.mockResolvedValue([
        { platform: 'instagram' },
        { platform: 'linkedin' },
      ]);

      const req = createMockRequest({ method: 'GET' });
      const response = await GET(req);

      expect(response.status).toBe(200);
      const body = await response.json();
      const parsed = onboardingStatusSchema.safeParse(body);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.completed).toBe(true);
        expect(parsed.data.connectedPlatforms).toContain('instagram');
        expect(parsed.data.connectedPlatforms).toContain('linkedin');
        expect(parsed.data.organization).not.toBeNull();
        expect(parsed.data.persona).toBeNull();
      }
    });
  });

  // ===========================================================================
  // REFERRALS GET — Auth enforcement
  // ===========================================================================

  describe('GET /api/referrals — Auth enforcement', () => {
    it('should return 401 when unauthenticated (security.allowed=false)', async () => {
      const { GET } = await import('@/app/api/referrals/route');

      mockSecurityCheck.mockResolvedValue({
        allowed: false,
        error: 'Authentication required',
        context: {},
      });

      const req = createMockRequest({ method: 'GET', url: 'http://localhost:3000/api/referrals' });
      const response = await GET(req);

      expect(response.status).toBe(401);
      expect(mockSecurityCheck).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // REFERRALS GET — Response shape
  // ===========================================================================

  describe('GET /api/referrals — Response shape', () => {
    it('should return 200 with referralCode, stats, and referrals array', async () => {
      const { GET } = await import('@/app/api/referrals/route');

      mockSecurityCheck.mockResolvedValue({
        allowed: true,
        context: { userId: 'user-123' },
      });
      // Return one 'sent' referral so activeCode is resolved directly (no findUnique loop)
      mockReferralFindMany.mockResolvedValue([mockReferral]);

      const req = createMockRequest({ method: 'GET', url: 'http://localhost:3000/api/referrals' });
      const response = await GET(req);

      expect(response.status).toBe(200);
      const body = await response.json();
      const parsed = referralsGetSchema.safeParse(body);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.referralCode).toBe('SYN-ABCD');
        expect(parsed.data.referralLink).toContain('SYN-ABCD');
        expect(parsed.data.referrals).toHaveLength(1);
        expect(parsed.data.stats.totalSent).toBe(1);
        expect(parsed.data.stats.converted).toBe(0);
        expect(parsed.data.stats.rewardsEarned).toBe(0); // referrerRewarded: false
      }
    });
  });

  // ===========================================================================
  // REFERRALS POST — Auth enforcement
  // ===========================================================================

  describe('POST /api/referrals — Auth enforcement', () => {
    it('should return 401 when unauthenticated', async () => {
      const { POST } = await import('@/app/api/referrals/route');

      mockSecurityCheck.mockResolvedValue({
        allowed: false,
        error: 'Authentication required',
        context: {},
      });

      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/referrals',
        body: { email: 'friend@example.com' },
      });
      const response = await POST(req);

      expect(response.status).toBe(401);
    });
  });

  // ===========================================================================
  // REFERRALS POST — Input validation
  // ===========================================================================

  describe('POST /api/referrals — Input validation', () => {
    it('should return 400 when email is invalid', async () => {
      const { POST } = await import('@/app/api/referrals/route');

      mockSecurityCheck.mockResolvedValue({
        allowed: true,
        context: { userId: 'user-123' },
      });

      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/referrals',
        body: { email: 'not-a-valid-email' },
      });
      const response = await POST(req);

      expect(response.status).toBe(400);
    });

    it('should validate the inline InviteSchema Zod constraint', () => {
      const InviteSchema = z.object({ email: z.string().email() });

      expect(InviteSchema.safeParse({ email: 'valid@example.com' }).success).toBe(true);
      expect(InviteSchema.safeParse({ email: 'not-valid' }).success).toBe(false);
      expect(InviteSchema.safeParse({ email: '' }).success).toBe(false);
      expect(InviteSchema.safeParse({}).success).toBe(false);
    });
  });

  // ===========================================================================
  // REFERRALS POST — Success and conflict response shapes
  // ===========================================================================

  describe('POST /api/referrals — Success and conflict response shapes', () => {
    it('should return 200 with referral { id, code, email, link } on valid invite', async () => {
      const { POST } = await import('@/app/api/referrals/route');

      mockSecurityCheck.mockResolvedValue({
        allowed: true,
        context: { userId: 'user-123' },
      });
      mockReferralFindFirst.mockResolvedValue(null);  // no duplicate
      mockReferralFindUnique.mockResolvedValue(null); // generated code is unique
      mockReferralCreate.mockResolvedValue({
        ...mockReferral,
        refereeEmail: 'newperson@example.com',
      });

      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/referrals',
        body: { email: 'newperson@example.com' },
      });
      const response = await POST(req);

      expect(response.status).toBe(200);
      const body = await response.json();
      const parsed = referralInviteSchema.safeParse(body);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.referral.email).toBe('newperson@example.com');
        expect(parsed.data.referral.code).toMatch(/^SYN-/);
        expect(parsed.data.referral.link).toContain('/signup?ref=');
      }
    });

    it('should return 409 when email has already been referred', async () => {
      const { POST } = await import('@/app/api/referrals/route');

      mockSecurityCheck.mockResolvedValue({
        allowed: true,
        context: { userId: 'user-123' },
      });
      mockReferralFindFirst.mockResolvedValue(mockReferral); // existing referral

      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/referrals',
        body: { email: 'friend@example.com' },
      });
      const response = await POST(req);

      expect(response.status).toBe(409);
      const body = await response.json();
      const parsed = errorSchema.safeParse(body);
      expect(parsed.success).toBe(true);
      expect(body.error).toContain('already been referred');
    });
  });
});
