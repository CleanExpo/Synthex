/**
 * Unit Tests for SEO Audit history route — GET /api/seo/audit
 *
 * Regression coverage for the page↔route contract drift where the GET handler
 * ignored the `url` and `limit` query params that
 * `hooks/useAuditHistory.ts` (loadHistory / loadTrends) sends. The result was
 * a per-site trend chart that silently mixed in every other site's audits and
 * was capped at 20 points.
 *
 * Tests the real GET handler with mocked Prisma, auth, and subscription deps.
 * Uses createMockNextRequest to avoid the jest.setup.js polyfill conflict.
 */

import { createMockNextRequest } from '../../helpers/mock-request';

// ============================================================================
// MOCKS — declared before any imports that consume them
// ============================================================================

const mockPrisma = {
  sEOAudit: {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
  },
  user: { findUnique: jest.fn() },
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

// APISecurityChecker — allowed by default, context carries the userId
const mockSecurityCheck = jest.fn();
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...args: unknown[]) => mockSecurityCheck(...args),
    createSecureResponse: (body: unknown, status: number = 200) => {
      const { NextResponse } = require('next/server');
      return NextResponse.json(body, { status });
    },
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_READ: { requireAuth: true },
    AUTHENTICATED_WRITE: { requireAuth: true },
  },
}));

// Subscription — Professional access by default
const mockGetSubscription = jest.fn();
jest.mock('@/lib/stripe/subscription-service', () => ({
  subscriptionService: {
    getSubscription: (...args: unknown[]) => mockGetSubscription(...args),
  },
  PLAN_LIMITS: {
    free: { maxSeoAudits: 1 },
    professional: { maxSeoAudits: -1 },
  },
}));

jest.mock('@/lib/billing/plan-access', () => ({
  hasProfessionalAccess: () => true,
}));

// Central entitlement gate (SYN-1106) — the GET handler now resolves access
// via requireEntitlement. Grant Professional so this test keeps its focus on
// the history filtering contract.
jest.mock('@/lib/billing/require-entitlement', () => ({
  requireEntitlement: async () => ({
    allowed: true,
    effectivePlan: 'professional',
    requiredPlan: 'professional',
    subscription: { plan: 'professional', status: 'active' },
  }),
}));

// Import route handler AFTER mocks are wired
import { GET } from '@/app/api/seo/audit/route';

// ============================================================================
// HELPERS
// ============================================================================

function getRequest(query = '') {
  return createMockNextRequest({
    method: 'GET',
    url: `http://localhost:3000/api/seo/audit${query}`,
  });
}

const AUDIT_ROW = {
  id: 1,
  url: 'https://example.com',
  overallScore: 80,
  auditType: 'full',
  recommendations: { critical: 0, major: 0, minor: 0, info: 0 },
  createdAt: new Date('2026-06-01T00:00:00.000Z'),
};

describe('GET /api/seo/audit — history filtering contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSecurityCheck.mockResolvedValue({
      allowed: true,
      context: { userId: 'user-123' },
    });
    mockGetSubscription.mockResolvedValue({ plan: 'professional' });
    mockPrisma.sEOAudit.findMany.mockResolvedValue([AUDIT_ROW]);
  });

  it('passes the `url` query param through to the Prisma where clause', async () => {
    const res = await GET(
      getRequest('?url=https%3A%2F%2Fexample.com&limit=100')
    );
    expect(res.status).toBe(200);

    const args = mockPrisma.sEOAudit.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      userId: 'user-123',
      url: 'https://example.com',
    });
  });

  it('honours the `limit` query param (raises take above the default 20)', async () => {
    await GET(getRequest('?limit=100'));
    expect(mockPrisma.sEOAudit.findMany.mock.calls[0][0].take).toBe(100);
  });

  it('clamps an over-large limit to the 100-row ceiling', async () => {
    await GET(getRequest('?limit=5000'));
    expect(mockPrisma.sEOAudit.findMany.mock.calls[0][0].take).toBe(100);
  });

  it('falls back to take=20 and no url filter when no params are sent', async () => {
    await GET(getRequest());
    const args = mockPrisma.sEOAudit.findMany.mock.calls[0][0];
    expect(args.take).toBe(20);
    expect(args.where).toEqual({ userId: 'user-123' });
  });

  it('ignores a non-numeric limit and uses the default 20', async () => {
    await GET(getRequest('?limit=abc'));
    expect(mockPrisma.sEOAudit.findMany.mock.calls[0][0].take).toBe(20);
  });

  it('returns 401 when unauthenticated', async () => {
    mockSecurityCheck.mockResolvedValue({
      allowed: false,
      error: 'Authentication required',
    });
    const res = await GET(getRequest());
    expect(res.status).toBe(401);
  });
});
