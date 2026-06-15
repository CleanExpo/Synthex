/**
 * Unit tests for app/api/content/repurpose/route.ts
 *
 * Regression coverage for the route<->page contract. The Content Repurposer
 * dashboard page fans out one request per platform sending
 * `{ sourceContent, sourceType, platform, outputFormat }` and reads `{ content }`
 * off the response. Before the fix, the route only accepted the legacy batch
 * shape (`outputFormats: [...]`), so every request from the page failed Zod
 * validation with a 400 — the tool was a complete dead-end.
 *
 * Covers:
 *  - Per-platform request -> 200 with { success, platform, content }
 *  - Per-platform validation (unknown platform -> 400)
 *  - Legacy batch request -> 200 with { success, source, results }
 *  - AI failure -> 500 structured error
 *
 * Mock strategy:
 *  - middleware (withAuth / withRateLimit / requireApiKey): pass-through so the
 *    handler logic is exercised directly
 *  - @/lib/ai/multi-format-adapter + @/lib/ai/content-repurposer: singleton stubs
 *  - @/lib/logger: silent
 */

// ── Mock objects ────────────────────────────────────────────────────────────

const mockAdaptContent = jest.fn();
const mockRepurpose = jest.fn();

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

jest.mock('@/lib/ai/multi-format-adapter', () => ({
  multiFormatAdapter: { adaptContent: mockAdaptContent },
}));

jest.mock('@/lib/ai/content-repurposer', () => ({
  contentRepurposer: { repurpose: mockRepurpose },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Import after mocks are registered.
import { POST } from '@/app/api/content/repurpose/route';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Minimal request-like object: the route handler only calls request.json(). */
function makeRequest(body: unknown): Parameters<typeof POST>[0] {
  return {
    method: 'POST',
    url: 'http://localhost/api/content/repurpose',
    json: async () => body,
  } as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('POST /api/content/repurpose — per-platform (dashboard page) contract', () => {
  it('accepts the page request shape and returns flat { content }', async () => {
    mockAdaptContent.mockResolvedValue({
      source: { content: 'src' },
      variants: [{ platform: 'twitter', content: 'Adapted tweet text' }],
    });

    const res = await POST(
      makeRequest({
        sourceContent: 'Some existing content to repurpose.',
        sourceType: 'text',
        platform: 'twitter',
        outputFormat: 'social_post',
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      success: true,
      platform: 'twitter',
      content: 'Adapted tweet text',
    });

    // Routed through the multi-format adapter for a single platform.
    expect(mockAdaptContent).toHaveBeenCalledTimes(1);
    expect(mockAdaptContent.mock.calls[0][0]).toMatchObject({
      sourceContent: 'Some existing content to repurpose.',
      targetPlatforms: ['twitter'],
    });
    // Must NOT have used the batch repurposer.
    expect(mockRepurpose).not.toHaveBeenCalled();
  });

  it('rejects an unknown platform with a 400 validation error', async () => {
    const res = await POST(
      makeRequest({
        sourceContent: 'content',
        sourceType: 'text',
        platform: 'myspace',
        outputFormat: 'social_post',
      })
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe('Validation error');
    expect(mockAdaptContent).not.toHaveBeenCalled();
  });

  it('returns 500 when the adapter yields no content', async () => {
    mockAdaptContent.mockResolvedValue({
      source: { content: 'src' },
      variants: [{ platform: 'linkedin', content: '' }],
    });

    const res = await POST(
      makeRequest({
        sourceContent: 'content',
        platform: 'linkedin',
        outputFormat: 'summary',
      })
    );

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it('returns 500 when the adapter throws', async () => {
    mockAdaptContent.mockRejectedValue(new Error('OpenAI API key not configured'));

    const res = await POST(
      makeRequest({
        sourceContent: 'content',
        platform: 'instagram',
        outputFormat: 'caption',
      })
    );

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json).toMatchObject({ success: false });
  });
});

describe('POST /api/content/repurpose — legacy batch contract', () => {
  it('routes outputFormats[] through the batch repurposer and returns { results }', async () => {
    mockRepurpose.mockResolvedValue({
      source: { content: 'long form', type: 'blog', wordCount: 2 },
      results: [
        { format: 'thread', content: '1/ ...', metadata: {} },
        { format: 'summary', content: 'A summary.', metadata: {} },
      ],
    });

    const res = await POST(
      makeRequest({
        sourceContent: 'x'.repeat(150),
        sourceType: 'blog',
        outputFormats: ['thread', 'summary'],
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.results).toHaveLength(2);
    expect(mockRepurpose).toHaveBeenCalledTimes(1);
    // Batch path must not touch the per-platform adapter.
    expect(mockAdaptContent).not.toHaveBeenCalled();
  });

  it('rejects a batch request whose source is under the 100-char floor', async () => {
    const res = await POST(
      makeRequest({
        sourceContent: 'too short',
        sourceType: 'blog',
        outputFormats: ['thread'],
      })
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(mockRepurpose).not.toHaveBeenCalled();
  });
});
