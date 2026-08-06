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
    AUTHENTICATED_WRITE: { requireAuth: true },
  },
}));

import { POST } from '@/app/api/mobile/sync/route';

function request() {
  return createMockNextRequest({
    url: 'http://localhost/api/mobile/sync',
    method: 'POST',
    body: {
      changes: [
        {
          type: 'create',
          entity: 'post',
          id: 'post-1',
          timestamp: '2026-08-06T00:00:00.000Z',
        },
      ],
    },
  });
}

describe('POST /api/mobile/sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects unauthenticated requests before reporting availability', async () => {
    mockSecurityCheck.mockResolvedValue({
      allowed: false,
      error: 'Authentication required',
      context: {},
    });

    const response = await POST(request() as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Authentication required',
    });
  });

  it('fails closed instead of acknowledging unprocessed client changes', async () => {
    mockSecurityCheck.mockResolvedValue({
      allowed: true,
      context: { userId: 'user-123' },
    });

    const response = await POST(request() as never);

    expect(mockSecurityCheck).toHaveBeenCalled();
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error:
        'Mobile synchronisation is unavailable until offline changes can be processed and persisted.',
    });
  });
});
