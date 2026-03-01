/**
 * Unit Tests for Subscription API Route
 * Tests GET /api/user/subscription handler logic
 *
 * Tests actual route handler with mocked dependencies (Prisma, security checker).
 * Uses createMockNextRequest to avoid the jest.setup.js polyfill conflict with NextRequest.
 */

import { createMockNextRequest } from '../../helpers/mock-request';

// Mock security checker
const mockSecurityCheck = jest.fn();
const mockCreateSecureResponse = jest.fn((body: unknown, status: number) => {
  return new Response(JSON.stringify(body), { status });
});

jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...args: unknown[]) => mockSecurityCheck(...args),
    createSecureResponse: (...args: unknown[]) => mockCreateSecureResponse(...args),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_READ: { requireAuth: true, allowRead: true },
    AUTHENTICATED_WRITE: { requireAuth: true, allowWrite: true },
  },
}));

// Mock subscription service
const mockGetOrCreateSubscription = jest.fn();
jest.mock('@/lib/stripe/subscription-service', () => ({
  subscriptionService: {
    getOrCreateSubscription: (...args: unknown[]) => mockGetOrCreateSubscription(...args),
  },
}));

// Import the route handler after mocks are set up
import { GET } from '@/app/api/user/subscription/route';

describe('GET /api/user/subscription', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createRequest(url = 'http://localhost:3000/api/user/subscription') {
    return createMockNextRequest({ url });
  }

  it('should return 403 when security check fails', async () => {
    mockSecurityCheck.mockResolvedValue({
      allowed: false,
      error: 'Forbidden',
      context: {},
    });

    const req = createRequest();
    const res = await GET(req);

    expect(mockSecurityCheck).toHaveBeenCalled();
    expect(mockCreateSecureResponse).toHaveBeenCalledWith(
      { error: 'Forbidden' },
      403
    );
  });

  it('should return 401 when userId is missing from security context', async () => {
    mockSecurityCheck.mockResolvedValue({
      allowed: true,
      context: { userId: null },
    });

    const req = createRequest();
    const res = await GET(req);
    const body = await res.json();

    expect(body.error).toBe('Authentication required');
    expect(res.status).toBe(401);
  });

  it('should return subscription details for authenticated user', async () => {
    mockSecurityCheck.mockResolvedValue({
      allowed: true,
      context: { userId: 'user-123' },
    });

    const mockSubscription = {
      plan: 'professional',
      status: 'active',
      currentPeriodEnd: new Date('2025-12-31'),
      cancelAtPeriodEnd: false,
      trialEnd: null,
    };

    mockGetOrCreateSubscription.mockResolvedValue(mockSubscription);

    const req = createRequest();
    const res = await GET(req);
    const body = await res.json();

    expect(mockGetOrCreateSubscription).toHaveBeenCalledWith('user-123');
    expect(body.plan).toBe('professional');
    expect(body.status).toBe('active');
    expect(body.features).toBeDefined();
    expect(body.features.socialAccounts).toBe(5);
    expect(body.features.aiPosts).toBe(100);
  });

  it('should return free tier features when plan is free', async () => {
    mockSecurityCheck.mockResolvedValue({
      allowed: true,
      context: { userId: 'user-456' },
    });

    mockGetOrCreateSubscription.mockResolvedValue({
      plan: 'free',
      status: 'inactive',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      trialEnd: null,
    });

    const req = createRequest();
    const res = await GET(req);
    const body = await res.json();

    expect(body.plan).toBe('free');
    expect(body.features.socialAccounts).toBe(1);
    expect(body.features.aiPosts).toBe(5);
    expect(body.features.support).toBe('community');
  });

  it('should return business tier features', async () => {
    mockSecurityCheck.mockResolvedValue({
      allowed: true,
      context: { userId: 'user-biz' },
    });

    mockGetOrCreateSubscription.mockResolvedValue({
      plan: 'business',
      status: 'active',
      currentPeriodEnd: new Date('2026-01-01'),
      cancelAtPeriodEnd: false,
      trialEnd: null,
    });

    const req = createRequest();
    const res = await GET(req);
    const body = await res.json();

    expect(body.plan).toBe('business');
    expect(body.features.aiPosts).toBe(-1); // unlimited
    expect(body.features.socialAccounts).toBe(10);
    expect(body.features.competitorAnalysis).toBe(true);
  });

  it('should return custom tier features', async () => {
    mockSecurityCheck.mockResolvedValue({
      allowed: true,
      context: { userId: 'user-custom' },
    });

    mockGetOrCreateSubscription.mockResolvedValue({
      plan: 'custom',
      status: 'active',
      currentPeriodEnd: new Date('2026-01-01'),
      cancelAtPeriodEnd: false,
      trialEnd: null,
    });

    const req = createRequest();
    const res = await GET(req);
    const body = await res.json();

    expect(body.plan).toBe('custom');
    expect(body.features.socialAccounts).toBe(-1);
    expect(body.features.whiteLabel).toBe(true);
  });

  it('should include cancelAtPeriodEnd and trialEnd fields', async () => {
    mockSecurityCheck.mockResolvedValue({
      allowed: true,
      context: { userId: 'user-trial' },
    });

    const trialEnd = new Date('2026-02-15');
    mockGetOrCreateSubscription.mockResolvedValue({
      plan: 'professional',
      status: 'trialing',
      currentPeriodEnd: new Date('2026-03-01'),
      cancelAtPeriodEnd: true,
      trialEnd,
    });

    const req = createRequest();
    const res = await GET(req);
    const body = await res.json();

    expect(body.cancelAtPeriodEnd).toBe(true);
    expect(body.trialEnd).toBe(trialEnd.toISOString());
  });

  it('should fallback to free features for unknown plan', async () => {
    mockSecurityCheck.mockResolvedValue({
      allowed: true,
      context: { userId: 'user-unknown' },
    });

    mockGetOrCreateSubscription.mockResolvedValue({
      plan: 'nonexistent-plan',
      status: 'active',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      trialEnd: null,
    });

    const req = createRequest();
    const res = await GET(req);
    const body = await res.json();

    // Unknown plan should fall back to free features
    expect(body.features.socialAccounts).toBe(1);
    expect(body.features.aiPosts).toBe(5);
  });

  it('should return 500 when subscription service throws', async () => {
    mockSecurityCheck.mockResolvedValue({
      allowed: true,
      context: { userId: 'user-error' },
    });

    mockGetOrCreateSubscription.mockRejectedValue(new Error('Database connection failed'));

    const req = createRequest();
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Failed to fetch subscription details');
  });
});
