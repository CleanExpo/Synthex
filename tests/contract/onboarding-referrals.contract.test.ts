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
const mockBusinessOwnershipFindFirst = jest.fn();
const mockOnboardingProgressFindUnique = jest.fn();
const mockOnboardingProgressFindFirst = jest.fn();
const mockOnboardingProgressUpdateMany = jest.fn();
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
      findFirst: (...args: unknown[]) =>
        mockBusinessOwnershipFindFirst(...args),
    },
    persona: {
      create: (...args: unknown[]) => mockPersonaCreate(...args),
      findFirst: (...args: unknown[]) => mockPersonaFindFirst(...args),
    },
    platformConnection: {
      findMany: (...args: unknown[]) => mockPlatformConnectionFindMany(...args),
    },
    onboardingProgress: {
      findUnique: (...args: unknown[]) =>
        mockOnboardingProgressFindUnique(...args),
      findFirst: (...args: unknown[]) =>
        mockOnboardingProgressFindFirst(...args),
      updateMany: (...args: unknown[]) =>
        mockOnboardingProgressUpdateMany(...args),
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
  unauthorizedResponse: () => {
    const { NextResponse } = require('next/server');
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required' },
      { status: 401 }
    );
  },
}));

// =============================================================================
// Webhook + logger + email + vault mocks (used by onboarding routes)
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

jest.mock('@/lib/email/billing-emails', () => ({
  sendWelcomeSequenceDay0: jest.fn(),
}));

jest.mock('@/lib/vault/onboarding-seeder', () => ({
  seedVaultFromOnboarding: jest.fn().mockResolvedValue(undefined),
}));

// =============================================================================
// APISecurityChecker mock (used by referrals route)
// =============================================================================

const mockSecurityCheck = jest.fn();
const mockCreateSecureResponse = jest.fn();

jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...args: unknown[]) => mockSecurityCheck(...args),
    createSecureResponse: (...args: unknown[]) =>
      mockCreateSecureResponse(...args),
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
  persona: z.union([z.null(), z.object({ id: z.string(), name: z.string() })]),
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
  referrals: z.array(
    z.object({
      id: z.string(),
      code: z.string(),
      status: z.string(),
    })
  ),
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

function createMockRequest(
  opts: {
    method?: string;
    body?: object;
    url?: string;
  } = {}
) {
  const {
    method = 'GET',
    body,
    url = 'http://localhost:3000/api/onboarding',
  } = opts;
  const bodyString = body ? JSON.stringify(body) : undefined;

  return {
    url,
    method,
    headers: {
      get: (name: string) =>
        name === 'content-type' ? 'application/json' : null,
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
  domain: 'test-organization.synthex.social',
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
  // POST /api/onboarding/complete — Auth enforcement
  // (Old /api/onboarding POST was split; the completion step is now /complete)
  // ===========================================================================

  describe('POST /api/onboarding/complete — Auth enforcement', () => {
    it('should return 401 when unauthenticated (no userId)', async () => {
      const { POST } = await import('@/app/api/onboarding/complete/route');

      mockGetUserId.mockResolvedValue(null);

      const req = createMockRequest({ method: 'POST' });
      const response = await POST(req);

      expect(response.status).toBe(401);
      const body = await response.json();
      const parsed = errorSchema.safeParse(body);
      expect(parsed.success).toBe(true);
    });
  });

  // ===========================================================================
  // POST /api/onboarding/complete — Success response shape
  // ===========================================================================

  describe('POST /api/onboarding/complete — Success response shape', () => {
    it('should return 400 when no organisation exists for user', async () => {
      const { POST } = await import('@/app/api/onboarding/complete/route');

      mockGetUserId.mockResolvedValue('user-123');
      mockUserFindUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        onboardingComplete: false,
        activeOrganizationId: null,
      });
      mockOrgFindFirst.mockResolvedValue(null); // no org found

      const req = createMockRequest({ method: 'POST' });
      const response = await POST(req);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('organisation');
    });

    it('should return 200 { success: true, alreadyComplete: true } when already done', async () => {
      const { POST } = await import('@/app/api/onboarding/complete/route');

      mockGetUserId.mockResolvedValue('user-123');
      mockUserFindUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        onboardingComplete: true, // already complete
        activeOrganizationId: 'org-456',
      });

      const req = createMockRequest({ method: 'POST' });
      const response = await POST(req);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.alreadyComplete).toBe(true);
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // GET /api/onboarding/progress — Auth enforcement
  // (Old /api/onboarding GET is now /api/onboarding/progress)
  // ===========================================================================

  describe('GET /api/onboarding/progress — Auth enforcement', () => {
    it('should return 401 when unauthenticated', async () => {
      const { GET } = await import('@/app/api/onboarding/progress/route');

      mockGetUserId.mockResolvedValue(null);

      const req = createMockRequest({ method: 'GET' });
      const response = await GET(req);

      expect(response.status).toBe(401);
    });
  });

  // ===========================================================================
  // GET /api/onboarding/progress — Response shape
  // ===========================================================================

  describe('GET /api/onboarding/progress — Response shape', () => {
    it('should return 200 with current progress stage when found', async () => {
      const { GET } = await import('@/app/api/onboarding/progress/route');

      mockGetUserId.mockResolvedValue('user-123');
      mockOrgFindFirst.mockResolvedValue({ id: 'org-456' });
      mockOnboardingProgressFindUnique.mockResolvedValue({
        currentStage: 'review',
        businessName: 'Test Org',
        website: 'https://example.com',
        status: 'in_progress',
        completedAt: null,
        auditData: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const req = createMockRequest({ method: 'GET' });
      const response = await GET(req);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('currentStage', 'review');
      expect(body).toHaveProperty('businessName', 'Test Org');
    });

    it('should return 404 when no org exists', async () => {
      const { GET } = await import('@/app/api/onboarding/progress/route');

      mockGetUserId.mockResolvedValue('user-123');
      mockOrgFindFirst.mockResolvedValue(null); // no org

      const req = createMockRequest({ method: 'GET' });
      const response = await GET(req);

      expect(response.status).toBe(404);
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

      const req = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/referrals',
      });
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
      mockUserFindUnique.mockResolvedValue({
        ...mockUser,
        referralCode: 'SYN-ABCD',
      });
      mockReferralFindMany.mockResolvedValue([mockReferral]);

      const req = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/referrals',
      });
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

      expect(
        InviteSchema.safeParse({ email: 'valid@example.com' }).success
      ).toBe(true);
      expect(InviteSchema.safeParse({ email: 'not-valid' }).success).toBe(
        false
      );
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
      mockReferralFindFirst.mockResolvedValue(null); // no duplicate
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
