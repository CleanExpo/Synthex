/**
 * Unit tests for GET /api/features.
 */

import { createMockNextRequest } from '../../helpers/mock-request';

const mockSecurityCheck = jest.fn();
const mockCreateSecureResponse = jest.fn(
  (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status })
);
const mockGetSubscription = jest.fn();

jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...args: unknown[]) => mockSecurityCheck(...args),
    createSecureResponse: (...args: unknown[]) =>
      mockCreateSecureResponse(...args),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_READ: { requireAuth: true, allowRead: true },
  },
}));

jest.mock('@/lib/stripe/subscription-service', () => ({
  subscriptionService: {
    getSubscription: (...args: unknown[]) => mockGetSubscription(...args),
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

import { GET } from '@/app/api/features/route';

describe('GET /api/features', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the shared subscription service so owner bypass applies', async () => {
    mockSecurityCheck.mockResolvedValue({
      allowed: true,
      context: { userId: 'owner_123' },
    });
    mockGetSubscription.mockResolvedValue({
      plan: 'scale',
      status: 'active',
    });

    const req = createMockNextRequest({ url: 'http://localhost/api/features' });
    await GET(req);

    expect(mockGetSubscription).toHaveBeenCalledWith('owner_123');
    expect(mockCreateSecureResponse).toHaveBeenCalledWith(
      {
        plan: 'scale',
        userId: 'owner_123',
        features: ['all-features'],
      },
      200,
      { userId: 'owner_123' }
    );
  });

  it('falls back to free features when no subscription exists', async () => {
    mockSecurityCheck.mockResolvedValue({
      allowed: true,
      context: { userId: 'user_123' },
    });
    mockGetSubscription.mockResolvedValue(null);

    const req = createMockNextRequest({ url: 'http://localhost/api/features' });
    await GET(req);

    expect(mockCreateSecureResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: 'free',
        features: expect.arrayContaining(['basic-analytics']),
      }),
      200,
      { userId: 'user_123' }
    );
  });
});
