import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockSecurityCheck = jest.fn();

jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...args: unknown[]) => mockSecurityCheck(...args),
    createSecureResponse: (body: unknown, status = 200) => {
      const { NextResponse } = require('next/server');
      return NextResponse.json(body, { status });
    },
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_READ: { requireAuth: true },
  },
}));

import { GET } from '@/app/api/research/trends/route';

function request() {
  return createMockNextRequest({
    url: 'http://localhost/api/research/trends?category=technology',
    method: 'GET',
  });
}

describe('GET /api/research/trends', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects unauthenticated requests before reporting availability', async () => {
    mockSecurityCheck.mockResolvedValue({
      allowed: false,
      error: 'Authentication required',
      context: {},
    });

    const response = await GET(request() as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Authentication required',
    });
  });

  it('fails closed instead of returning mock trending topics', async () => {
    mockSecurityCheck.mockResolvedValue({
      allowed: true,
      context: { userId: 'user-123' },
    });

    const response = await GET(request() as never);

    expect(mockSecurityCheck).toHaveBeenCalled();
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error:
        'Trend research is unavailable until a verified data provider is configured.',
    });
  });
});
