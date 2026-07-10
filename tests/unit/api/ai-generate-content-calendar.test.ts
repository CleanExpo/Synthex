/**
 * SYN-MCP-002 — calendar GET containment tests for
 * GET /api/ai/generate-content.
 *
 * Defects under test (vs main @ 2bd24eb5, route.ts:351-402):
 *  - days / platforms / postsPerDay parsed UNCLAMPED (days=365&postsPerDay=100
 *    fanned out unbounded LLM calls),
 *  - GET lacked the POST's withRateLimit wrapper,
 *  - no usage tracking,
 *  - generateContentCalendar received no org so brand context never engaged.
 */

// --- Mocks ---------------------------------------------------------------
const mockCalendar = jest.fn();
const mockUsageTrack = jest.fn();
const mockWithRateLimit = jest.fn();
const mockGetUserId = jest.fn();
const mockUserFindUnique = jest.fn();

jest.mock('@/lib/ai/content-generator', () => ({
  aiContentGenerator: {
    generateContent: jest.fn(),
    batchGenerate: jest.fn(),
    generateContentCalendar: (...args: unknown[]) => mockCalendar(...args),
  },
}));

jest.mock('@/lib/middleware/require-api-key', () => ({
  requireApiKey: (_req: unknown, handler: (userId: string) => unknown) =>
    handler('test-user-id'),
}));
jest.mock('@/lib/middleware/rate-limiter', () => ({
  withRateLimit: (req: unknown, fn: () => unknown) =>
    mockWithRateLimit(req, fn),
  UsageTracker: { track: (...a: unknown[]) => mockUsageTrack(...a) },
}));

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => mockGetUserId(...a),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
  },
  default: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
  },
}));

jest.mock('@/lib/services/client-branded-content', () => ({
  ClientBrandedContentService: { generate: jest.fn() },
}));
jest.mock('@/lib/ai/api-credential-injector', () => ({
  getUserAICredentials: jest.fn(),
}));
jest.mock('@/lib/auth/monitoring', () => ({
  authMonitor: { trackEvent: jest.fn() },
}));
jest.mock('@/lib/scoring/visibility-score', () => ({
  calculateVisibilityScore: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

// Import AFTER mocks are registered.
import { GET } from '@/app/api/ai/generate-content/route';

function makeGetRequest(query: string): any {
  return {
    url: `http://localhost/api/ai/generate-content${query}`,
    cookies: { get: () => ({ value: 'valid-token' }) },
    headers: { get: () => 'Bearer valid-token' },
  };
}

function fakeCalendarMap(
  entries: Array<[string, number]>
): Map<string, unknown[]> {
  return new Map(
    entries.map(([date, count]) => [
      date,
      Array.from({ length: count }, (_x, i) => ({ id: `${date}-post-${i}` })),
    ])
  );
}

describe('GET /api/ai/generate-content — SYN-MCP-002 calendar containment', () => {
  beforeEach(() => {
    // Pass-through rate limiter that records the invocation.
    mockWithRateLimit.mockImplementation((_req: unknown, fn: () => unknown) =>
      fn()
    );
    mockGetUserId.mockResolvedValue('test-user-id');
    mockUserFindUnique.mockResolvedValue({ organizationId: 'org-123' });
    mockUsageTrack.mockResolvedValue(undefined);
    mockCalendar.mockResolvedValue(
      fakeCalendarMap([
        ['2026-07-10', 2],
        ['2026-07-11', 1],
      ])
    );
  });

  it('is wrapped in the same withRateLimit wrapper the POST uses', async () => {
    const res = await GET(makeGetRequest('?days=7'));
    expect(res.status).toBe(200);
    expect(mockWithRateLimit).toHaveBeenCalledTimes(1);
  });

  it('clamps out-of-range params (days 1..14, postsPerDay 1..3, platforms <=4 valid)', async () => {
    const res = await GET(
      makeGetRequest(
        '?days=365&postsPerDay=100&platforms=twitter,instagram,linkedin,tiktok,facebook,youtube,myspace'
      )
    );

    expect(res.status).toBe(200);
    expect(mockCalendar).toHaveBeenCalledTimes(1);
    const [days, platforms, postsPerDay, organizationId] =
      mockCalendar.mock.calls[0];
    expect(days).toBe(14);
    expect(postsPerDay).toBe(3);
    expect(platforms).toEqual(['twitter', 'instagram', 'linkedin', 'tiktok']);
    expect(organizationId).toBe('org-123');

    const json = await res.json();
    expect(json.metadata.days).toBe(14);
    expect(json.metadata.postsPerDay).toBe(3);
    expect(json.metadata.platforms).toHaveLength(4);
  });

  it('clamps low/garbage values up to the minimums', async () => {
    const res = await GET(
      makeGetRequest('?days=0&postsPerDay=-5&platforms=bogus,alsobogus')
    );
    expect(res.status).toBe(200);
    const [days, platforms, postsPerDay] = mockCalendar.mock.calls[0];
    expect(days).toBe(1);
    expect(postsPerDay).toBe(1);
    // All-invalid platform list falls back to the historical default.
    expect(platforms).toEqual(['twitter', 'instagram', 'linkedin']);
  });

  it('tracks usage with the total number of posts generated', async () => {
    const res = await GET(makeGetRequest('?days=2&postsPerDay=2'));
    expect(res.status).toBe(200);
    // fakeCalendarMap above yields 2 + 1 = 3 posts.
    expect(mockUsageTrack).toHaveBeenCalledTimes(1);
    expect(mockUsageTrack).toHaveBeenCalledWith('test-user-id', 'ai_posts', 3);

    const json = await res.json();
    expect(json.metadata.totalPosts).toBe(3);
  });

  it('sets the Deprecation header pointing callers to the async endpoint', async () => {
    const res = await GET(makeGetRequest('?days=1'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Deprecation')).toBe('true');
  });

  it('still requires authentication', async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await GET(makeGetRequest('?days=1'));
    expect(res.status).toBe(401);
    expect(mockCalendar).not.toHaveBeenCalled();
    expect(mockUsageTrack).not.toHaveBeenCalled();
  });
});
