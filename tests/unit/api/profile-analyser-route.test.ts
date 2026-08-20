/**
 * POST /api/profile-analyser — auth, URL validation, and Apify guard.
 *
 * The route takes a single `url` and detects the platform itself; it calls the
 * Apify client directly rather than lib/profile-analyser/service. These tests
 * follow that contract.
 */

const mockGetUserId = jest.fn();
const mockActorCall = jest.fn();
const mockListItems = jest.fn();

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
  unauthorizedResponse: (message = 'Authentication required') =>
    new Response(JSON.stringify({ error: 'Unauthorized', message }), {
      status: 401,
    }),
}));

jest.mock('apify-client', () => ({
  ApifyClient: class {
    actor() {
      return { call: (...args: unknown[]) => mockActorCall(...args) };
    }
    dataset() {
      return { listItems: (...args: unknown[]) => mockListItems(...args) };
    }
  },
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

const LINKEDIN_URL = 'https://www.linkedin.com/in/ada';

describe('POST /api/profile-analyser', () => {
  const ORIGINAL_TOKEN = process.env.APIFY_API_TOKEN;

  beforeEach(() => {
    mockGetUserId.mockReset();
    mockActorCall.mockReset();
    mockListItems.mockReset();
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
      body: { url: LINKEDIN_URL },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when the body is not a valid URL', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    const req = createMockNextRequest({
      method: 'POST',
      body: { url: 'not-a-url' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockActorCall).not.toHaveBeenCalled();
  });

  it('returns 400 for a URL on an unsupported platform', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    const req = createMockNextRequest({
      method: 'POST',
      body: { url: 'https://www.facebook.com/cocacola' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockActorCall).not.toHaveBeenCalled();
  });

  it('returns 503 when APIFY_API_TOKEN is missing', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    delete process.env.APIFY_API_TOKEN;
    const req = createMockNextRequest({
      method: 'POST',
      body: { url: LINKEDIN_URL },
    });
    const res = await POST(req);
    expect(res.status).toBe(503);
    expect(mockActorCall).not.toHaveBeenCalled();
  });

  it('returns 404 when the actor returns no items', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockActorCall.mockResolvedValue({ defaultDatasetId: 'ds-1' });
    mockListItems.mockResolvedValue({ items: [] });
    const req = createMockNextRequest({
      method: 'POST',
      body: { url: LINKEDIN_URL },
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('returns the normalised profile on success', async () => {
    mockGetUserId.mockResolvedValue('user-1');
    mockActorCall.mockResolvedValue({ defaultDatasetId: 'ds-1' });
    mockListItems.mockResolvedValue({
      items: [{ fullName: 'Ada', headline: 'Engineer', connections: 500 }],
    });

    const req = createMockNextRequest({
      method: 'POST',
      body: { url: LINKEDIN_URL },
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.profile.platform).toBe('linkedin');
    expect(body.profile.profileUrl).toBe(LINKEDIN_URL);
    expect(mockActorCall).toHaveBeenCalledTimes(1);
  });
});
