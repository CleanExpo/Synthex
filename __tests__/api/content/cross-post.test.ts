/**
 * Unit tests for app/api/content/cross-post/route.ts
 *
 * Regression coverage for the route<->page contract. The Cross-Post dashboard
 * page fans out one request per platform sending
 * `{ content, platform, options }` and reads `{ content }` off the response.
 * Before the fix, the route only accepted the legacy batch shape
 * (`platforms: [...]` + `mode`) and returned `variants[]`, so every request
 * from the page failed Zod validation with a 400 — the tool was a complete
 * dead-end.
 *
 * Covers:
 *  - Per-platform request -> 200 with { success, platform, content }
 *  - Per-platform validation (unknown platform -> 400)
 *  - Per-platform AI yields no content -> 500 structured error
 *  - Per-platform AI throws -> 500 structured error
 *  - Legacy batch preview -> 200 with { success, mode: 'preview', variants }
 *  - Legacy batch publish -> 200 with { success, mode: 'publish', results, summary }
 *  - Legacy batch validation (empty platforms[] -> 400)
 *
 * Mock strategy:
 *  - middleware (withAuth / withRateLimit / requireApiKey): pass-through so the
 *    handler logic is exercised directly
 *  - @/lib/ai/cross-post-service: singleton stub (previewCrossPost + crossPost)
 *  - @/lib/logger: silent
 */

// ── Mock objects ────────────────────────────────────────────────────────────

const mockPreviewCrossPost = jest.fn();
const mockCrossPost = jest.fn();

// ── Module mocks ────────────────────────────────────────────────────────────

// Mock next/server so NextResponse.json() works under jsdom without the
// NextRequest URL-getter clash from the global Request polyfill.
jest.mock('next/server', () => {
  class NextResponse extends Response {
    static json(body: unknown, init?: ResponseInit): NextResponse {
      const serialised = JSON.stringify(body);
      const status = init && init.status ? init.status : 200;
      const headers = new Headers({ 'content-type': 'application/json' });
      return new NextResponse(serialised, { status, headers });
    }
  }
  return {
    NextResponse,
    NextRequest: class NextRequest extends Request {},
  };
});

// Pass-through middleware: keep the handler's real logic, drop the auth/limit gates.
jest.mock('@/lib/middleware/withAuth', () => ({
  withAuth:
    (handler: (req: unknown, ctx: unknown) => unknown) =>
    (req: unknown, ctx: unknown) =>
      handler(req, ctx),
}));

jest.mock('@/lib/rate-limit/rate-limiter', () => ({
  withRateLimit: (_req: unknown, fn: () => unknown) => fn(),
}));

jest.mock('@/lib/middleware/require-api-key', () => ({
  requireApiKey: (_req: unknown, fn: () => unknown) => fn(),
}));

jest.mock('@/lib/ai/cross-post-service', () => ({
  crossPostService: {
    previewCrossPost: mockPreviewCrossPost,
    crossPost: mockCrossPost,
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Import after mocks are registered.
import { POST } from '@/app/api/content/cross-post/route';

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Minimal request-like object: the route handler only reads `request.userId`
 * and calls `request.json()`.
 */
function makeRequest(body: unknown): Parameters<typeof POST>[0] {
  return {
    method: 'POST',
    url: 'http://localhost/api/content/cross-post',
    userId: 'user_test_123',
    json: async () => body,
  } as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('POST /api/content/cross-post — per-platform (dashboard page) contract', () => {
  it('accepts the page request shape and returns flat { content }', async () => {
    mockPreviewCrossPost.mockResolvedValue({
      source: { content: 'src' },
      variants: [{ platform: 'linkedin', content: 'Adapted LinkedIn post' }],
    });

    const res = await POST(
      makeRequest({
        content: 'Some existing content to cross-post.',
        platform: 'linkedin',
        options: { adjustLength: true, addHashtags: true, adjustTone: false },
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      success: true,
      platform: 'linkedin',
      content: 'Adapted LinkedIn post',
    });

    // Routed through the preview adaptation for a single platform.
    expect(mockPreviewCrossPost).toHaveBeenCalledTimes(1);
    expect(mockPreviewCrossPost.mock.calls[0][0]).toMatchObject({
      sourceContent: 'Some existing content to cross-post.',
      platforms: ['linkedin'],
      userId: 'user_test_123',
      options: { adjustLength: true, addHashtags: true },
    });
    // Per-platform path must never touch the publishing pipeline.
    expect(mockCrossPost).not.toHaveBeenCalled();
  });

  it('forwards adjustLength=false and addHashtags=false to the adapter', async () => {
    mockPreviewCrossPost.mockResolvedValue({
      source: { content: 'src' },
      variants: [{ platform: 'linkedin', content: 'Adapted without hashtags' }],
    });

    await POST(
      makeRequest({
        content: 'Source post body.',
        platform: 'linkedin',
        options: { adjustLength: false, addHashtags: false, adjustTone: false },
      })
    );

    expect(mockPreviewCrossPost.mock.calls[0][0]).toMatchObject({
      options: { adjustLength: false, addHashtags: false },
    });
    expect(mockPreviewCrossPost.mock.calls[0][0].tone).toBeUndefined();
  });

  it('passes a casual tone hint when adjustTone is enabled', async () => {
    mockPreviewCrossPost.mockResolvedValue({
      source: { content: 'src' },
      variants: [{ platform: 'twitter', content: 'tweet' }],
    });

    await POST(
      makeRequest({
        content: 'content',
        platform: 'twitter',
        options: { adjustTone: true },
      })
    );

    expect(mockPreviewCrossPost.mock.calls[0][0]).toMatchObject({
      tone: 'casual',
    });
  });

  it('rejects an unknown platform with a 400 validation error', async () => {
    const res = await POST(
      makeRequest({
        content: 'content',
        platform: 'myspace',
        options: {},
      })
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe('Validation error');
    expect(mockPreviewCrossPost).not.toHaveBeenCalled();
  });

  it('returns 500 when the adapter yields no content', async () => {
    mockPreviewCrossPost.mockResolvedValue({
      source: { content: 'src' },
      variants: [{ platform: 'instagram', content: '' }],
    });

    const res = await POST(
      makeRequest({
        content: 'content',
        platform: 'instagram',
      })
    );

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it('returns 500 when the adapter throws', async () => {
    mockPreviewCrossPost.mockRejectedValue(
      new Error('OpenAI API key not configured')
    );

    const res = await POST(
      makeRequest({
        content: 'content',
        platform: 'threads',
      })
    );

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json).toMatchObject({ success: false });
  });
});

describe('POST /api/content/cross-post — legacy batch contract', () => {
  it('preview mode returns { mode: "preview", variants } unchanged', async () => {
    mockPreviewCrossPost.mockResolvedValue({
      source: { content: 'src', platform: undefined },
      variants: [
        { platform: 'twitter', content: 'tweet' },
        { platform: 'linkedin', content: 'post' },
      ],
    });

    const res = await POST(
      makeRequest({
        content: 'Your content here',
        platforms: ['twitter', 'linkedin'],
        mode: 'preview',
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.mode).toBe('preview');
    expect(json.variants).toHaveLength(2);
    expect(mockPreviewCrossPost).toHaveBeenCalledTimes(1);
    expect(mockCrossPost).not.toHaveBeenCalled();
  });

  it('publish mode returns { mode: "publish", results, summary } unchanged', async () => {
    mockCrossPost.mockResolvedValue({
      adaptedContent: {
        source: { content: 'src' },
        variants: [{ platform: 'twitter', content: 'tweet' }],
      },
      results: [{ platform: 'twitter', success: true, dbPostId: 'p1' }],
      publishedCount: 1,
      scheduledCount: 0,
      failedCount: 0,
    });

    const res = await POST(
      makeRequest({
        content: 'Your content here',
        platforms: ['twitter'],
        mode: 'publish',
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.mode).toBe('publish');
    expect(json.results).toHaveLength(1);
    expect(json.summary).toMatchObject({
      publishedCount: 1,
      scheduledCount: 0,
      failedCount: 0,
      totalCount: 1,
    });
    expect(mockCrossPost).toHaveBeenCalledTimes(1);
  });

  it('defaults batch mode to publish when mode is omitted', async () => {
    mockCrossPost.mockResolvedValue({
      adaptedContent: { source: { content: 'src' }, variants: [] },
      results: [],
      publishedCount: 0,
      scheduledCount: 0,
      failedCount: 0,
    });

    const res = await POST(
      makeRequest({
        content: 'Your content here',
        platforms: ['twitter'],
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.mode).toBe('publish');
    expect(mockCrossPost).toHaveBeenCalledTimes(1);
    expect(mockPreviewCrossPost).not.toHaveBeenCalled();
  });

  it('rejects a batch request with an empty platforms array', async () => {
    const res = await POST(
      makeRequest({
        content: 'Your content here',
        platforms: [],
        mode: 'preview',
      })
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(mockPreviewCrossPost).not.toHaveBeenCalled();
    expect(mockCrossPost).not.toHaveBeenCalled();
  });

  it('returns 500 when the batch service throws', async () => {
    mockPreviewCrossPost.mockRejectedValue(new Error('adapter down'));

    const res = await POST(
      makeRequest({
        content: 'Your content here',
        platforms: ['twitter'],
        mode: 'preview',
      })
    );

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.success).toBe(false);
  });
});
