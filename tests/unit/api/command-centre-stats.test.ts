import { createMockNextRequest } from '../../helpers/mock-request';

const mockSecurityCheck = jest.fn();
const mockGetEffectiveOrganizationId = jest.fn();
const mockPostCount = jest.fn();
const mockAutopilotRunAggregate = jest.fn();
const mockPlatformConnectionCount = jest.fn();

jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...args: unknown[]) => mockSecurityCheck(...args),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_READ: { requireAuth: true, allowRead: true },
  },
}));

jest.mock('@/lib/multi-business', () => ({
  getEffectiveOrganizationId: (...args: unknown[]) =>
    mockGetEffectiveOrganizationId(...args),
}));

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    post: { count: (...args: unknown[]) => mockPostCount(...args) },
    autopilotRun: {
      aggregate: (...args: unknown[]) => mockAutopilotRunAggregate(...args),
    },
    platformConnection: {
      count: (...args: unknown[]) => mockPlatformConnectionCount(...args),
    },
  },
}));

import { GET } from '@/app/api/command-centre/stats/route';

function request() {
  return createMockNextRequest({
    url: 'http://localhost:3008/api/command-centre/stats',
  }) as never;
}

describe('GET /api/command-centre/stats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSecurityCheck.mockResolvedValue({
      allowed: true,
      context: { userId: 'user-1' },
    });
    mockGetEffectiveOrganizationId.mockResolvedValue('org-1');
    // Distinct return per call so we can assert which value maps to which field.
    mockPostCount
      .mockResolvedValueOnce(40) // totalPostsGenerated
      .mockResolvedValueOnce(7) // postsScheduled
      .mockResolvedValueOnce(3) // postsPendingReview (autopilot drafts only)
      .mockResolvedValueOnce(12); // postsPublished30d
    mockAutopilotRunAggregate.mockResolvedValue({ _avg: { avgScore: 81.6 } });
    mockPlatformConnectionCount.mockResolvedValue(4);
  });

  it('rejects unauthenticated requests', async () => {
    mockSecurityCheck.mockResolvedValueOnce({
      allowed: false,
      error: 'Unauthorized',
      context: {},
    });

    const response = await GET(request());

    expect(response.status).toBe(401);
  });

  it('returns 400 when no organisation is resolved', async () => {
    mockGetEffectiveOrganizationId.mockResolvedValueOnce(null);

    const response = await GET(request());

    expect(response.status).toBe(400);
  });

  it('counts only autopilot-sourced drafts for postsPendingReview', async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.postsPendingReview).toBe(3);

    // The pending-review count is the 3rd post.count call. It must scope to the
    // org, to draft status, and — critically — to autopilot-sourced posts so it
    // matches the Pending Approval Queue (/api/command-centre/pending), which
    // filters on metadata.source === 'autopilot'.
    const pendingReviewWhere = mockPostCount.mock.calls[2]![0].where;
    expect(pendingReviewWhere).toEqual(
      expect.objectContaining({
        campaign: { organizationId: 'org-1' },
        status: 'draft',
        deletedAt: null,
        metadata: { path: ['source'], equals: 'autopilot' },
      })
    );
  });

  it('rounds the average quality score', async () => {
    const response = await GET(request());
    const body = await response.json();
    expect(body.avgQualityScore).toBe(82);
    expect(body.connectedPlatforms).toBe(4);
  });
});
