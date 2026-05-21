import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockSecurityCheck = jest.fn();
const mockSecureResponse = jest.fn((data: unknown, status = 200) => {
  return {
    status,
    json: async () => data,
  };
});
const mockGetEffectiveOrganizationId = jest.fn();
const mockListMarketingAgencyOpportunities = jest.fn();

jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...args: unknown[]) => mockSecurityCheck(...args),
    createSecureResponse: (...args: unknown[]) => mockSecureResponse(...args),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_READ: { requireAuth: true, allowRead: true },
  },
}));

jest.mock('@/lib/multi-business', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrganizationId(...args),
}));

jest.mock('@/lib/marketing-agency/intelligence/opportunity-reader', () => ({
  listMarketingAgencyOpportunities: (...args: unknown[]) =>
    mockListMarketingAgencyOpportunities(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

import { GET } from '@/app/api/marketing-agency/opportunities/route';

describe('GET /api/marketing-agency/opportunities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSecureResponse.mockImplementation((data: unknown, status = 200) => ({
      status,
      json: async () => data,
    }));
    mockSecurityCheck.mockResolvedValue({
      allowed: true,
      context: { userId: 'user-1' },
    });
    mockGetEffectiveOrganizationId.mockResolvedValue('org-restoreassist');
    mockListMarketingAgencyOpportunities.mockResolvedValue([
      {
        id: 'opportunity-1',
        title: 'Lead with proof',
        approvalStatus: 'pass',
      },
    ]);
  });

  it('returns 401 when unauthenticated', async () => {
    mockSecurityCheck.mockResolvedValueOnce({
      allowed: false,
      error: 'Authentication required',
      context: {},
    });

    const response = await GET(
      createMockNextRequest({
        url: 'http://localhost/api/marketing-agency/opportunities',
      }) as never
    );

    expect(response.status).toBe(401);
    expect(mockListMarketingAgencyOpportunities).not.toHaveBeenCalled();
  });

  it('returns 400 when no organisation context is available', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValueOnce(null);

    const response = await GET(
      createMockNextRequest({
        url: 'http://localhost/api/marketing-agency/opportunities',
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('No organisation found');
  });

  it('validates the limit query parameter', async () => {
    const response = await GET(
      createMockNextRequest({
        url: 'http://localhost/api/marketing-agency/opportunities?limit=100',
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid query parameters');
    expect(mockListMarketingAgencyOpportunities).not.toHaveBeenCalled();
  });

  it('returns governed opportunities scoped to the active organisation', async () => {
    const response = await GET(
      createMockNextRequest({
        url: 'http://localhost/api/marketing-agency/opportunities?limit=5',
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockListMarketingAgencyOpportunities).toHaveBeenCalledWith({
      organizationId: 'org-restoreassist',
      limit: 5,
    });
    expect(body).toEqual({
      organizationId: 'org-restoreassist',
      opportunities: [
        {
          id: 'opportunity-1',
          title: 'Lead with proof',
          approvalStatus: 'pass',
        },
      ],
      total: 1,
    });
  });
});
