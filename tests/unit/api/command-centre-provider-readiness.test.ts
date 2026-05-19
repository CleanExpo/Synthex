import { createMockNextRequest } from '../../helpers/mock-request';

const mockSecurityCheck = jest.fn();
const mockGetEffectiveOrganizationId = jest.fn();

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

import { GET } from '@/app/api/command-centre/provider-readiness/route';

describe('GET /api/command-centre/provider-readiness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSecurityCheck.mockResolvedValue({
      allowed: true,
      context: { userId: 'user-1' },
    });
    mockGetEffectiveOrganizationId.mockResolvedValue('org-1');
  });

  it('rejects unauthenticated requests', async () => {
    mockSecurityCheck.mockResolvedValueOnce({
      allowed: false,
      error: 'Unauthorized',
      context: {},
    });

    const response = await GET(
      createMockNextRequest({
        url: 'http://localhost:3008/api/command-centre/provider-readiness',
      }) as never
    );

    expect(response.status).toBe(401);
  });

  it('returns provider modes without credential values', async () => {
    const response = await GET(
      createMockNextRequest({
        url: 'http://localhost:3008/api/command-centre/provider-readiness',
      }) as never
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.organizationId).toBe('org-1');
    expect(body.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'pipedream',
          mode: expect.any(String),
          reason: expect.any(String),
        }),
      ])
    );
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(`chorus${'_'}`);
    expect(serialized).not.toContain(`sk${'-'}`);
  });
});
