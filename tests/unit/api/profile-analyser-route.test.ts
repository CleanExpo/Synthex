/**
 * POST /api/profile-analyser — auth, URL validation, and Apify guard.
 */

const mockGetUserId = jest.fn();
const mockAnalyseProfile = jest.fn();

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) =>
    mockGetUserId(...args),
  unauthorizedResponse: (message = 'Authentication required') =>
    new Response(JSON.stringify({ error: 'Unauthorized', message }), {
      status: 401,
    }),
}));

jest.mock('@/lib/profile-analyser/service', () => ({
  analyseProfile: (...args: unknown[]) => mockAnalyseProfile(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: () => {}, error: () => {}, warn: () => {} },
}));

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) =>
      new Response(JSON.stringify(body), { status: init?.status ?? 200 }),
  },
  NextRequest: class {},
}));

import { createMockNextRequest } from '../../helpers/mock-request';
import { POST } from '@/app/api/profile-analyser/route';

describe('POST /api/profile-analyser', () => {
  const ORIGINAL_TOKEN = process.env.APIFY_API_TOKEN;

  beforeEach(() => {
    mockGetUserId.mockReset();
    mockAnalyseProfile.mockReset();
    process.env.APIFY_API_TOKEN = 'test-apify-token';
  });

  afterAll(() => {
    if (ORIGINAL_TOKEN === undefined) delete process.env.APIFY_API_TOKEN;
    else process.env.APIFY_API_TOKEN = ORIGINAL_TOKEN;
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUserId.mockResolvedValue(null);
    const req = createMockNextRequest({
      method: 'POST',
      body: {
        platform: 'linkedin',
        profileUrl: 'https://www.linkedin.com/in/ada',
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 for a Facebook URL on the LinkedIn platform', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    const req = createMockNextRequest({
      method: 'POST',
      body: {
        platform: 'linkedin',
        profileUrl: 'https://www.facebook.com/cocacola',
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockAnalyseProfile).not.toHaveBeenCalled();
  });

  it('returns 503 when APIFY_API_TOKEN is missing', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    delete process.env.APIFY_API_TOKEN;
    const req = createMockNextRequest({
      method: 'POST',
      body: {
        platform: 'linkedin',
        profileUrl: 'https://www.linkedin.com/in/ada',
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(503);
    expect(mockAnalyseProfile).not.toHaveBeenCalled();
  });

  it('returns the analysis payload on success', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockAnalyseProfile.mockResolvedValue({
      platform: 'linkedin',
      displayName: 'Ada',
      score: { overall: 72 },
    });
    const req = createMockNextRequest({
      method: 'POST',
      body: {
        platform: 'linkedin',
        profileUrl: 'https://www.linkedin.com/in/ada',
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.displayName).toBe('Ada');
    expect(mockAnalyseProfile).toHaveBeenCalledWith({
      platform: 'linkedin',
      profileUrl: 'https://www.linkedin.com/in/ada',
    });
  });
});
