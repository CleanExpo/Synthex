/**
 * Unit tests — Calendar × Content Intelligence Integration (SYN-632)
 *
 * Covers:
 *  - buildIntelligenceLine: below 0.6 uses industry framing
 *  - buildIntelligenceLine: at/above 0.6 uses client framing
 *  - buildIntelligenceLine: empty topics → returns empty string
 *  - generateCaptions: passes intelligence context into prompt (spy on fetch)
 *  - generateWeeklyCalendar: null-safety when getContentIntelligence throws
 *  - generateWeeklyCalendar: intelligence applied → signalsVersion = '1.2'
 *  - generateWeeklyCalendar: no intelligence → signalsVersion unchanged (1.0/1.1)
 */

// ── next/server mock ──────────────────────────────────────────────────────────
jest.mock('next/server', () => {
  const actual = jest.requireActual('next/server');
  class MockNextResponse {
    status: number;
    private _body: string;
    constructor(body: string, init: { status?: number } = {}) {
      this._body = body;
      this.status = init.status ?? 200;
    }
    json() { return Promise.resolve(JSON.parse(this._body)); }
    static json(data: unknown, init: { status?: number } = {}) {
      return new MockNextResponse(JSON.stringify(data), init);
    }
  }
  return { ...actual, NextResponse: MockNextResponse };
});

// ── Logger mock ───────────────────────────────────────────────────────────────
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ── Cost tracking mock ────────────────────────────────────────────────────────
jest.mock('@/lib/pipelines/track-cost', () => ({
  calculatePipelineCost: jest.fn().mockReturnValue(0),
  trackPipelineCost: jest.fn().mockResolvedValue(undefined),
}));

// ── Anti-slop mock ────────────────────────────────────────────────────────────
jest.mock('@/lib/ai/prompts/anti-slop-directive', () => ({
  withAntiSlop: (s: string) => s,
}));

// ── Supabase mock (runner factory) ────────────────────────────────────────────
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({ insert: jest.fn().mockResolvedValue({ error: null }) })),
  })),
}));

// ── Prisma mock ───────────────────────────────────────────────────────────────
// Use arrow-function wrappers (not jest.fn() directly) so that Jest config's
// resetMocks:true does not nuke the mock implementations between tests.
// The underlying jest.fn() variables are re-armed in beforeEach instead.
const mockFindMany = jest.fn();
const mockFindUnique = jest.fn();
const mockFindUsers = jest.fn();   // prisma.user.findMany  (needed by digestReader)
const mockFindPosts = jest.fn();   // prisma.post.findMany  (needed by digestReader)
const mockUpsert = jest.fn().mockResolvedValue({ id: 'cal-1' });
const mockCountDigests = jest.fn().mockResolvedValue(5);
const mockSeasonalDismissalFindMany = jest.fn();
const mockQueryRaw = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    // digestReader uses aIWeeklyDigest (capital I — model = AIWeeklyDigest)
    aIWeeklyDigest: { count: (...a: unknown[]) => mockCountDigests(...a) },
    user: { findMany: (...a: unknown[]) => mockFindUsers(...a) },
    post: { findMany: (...a: unknown[]) => mockFindPosts(...a) },
    platformPost: { findMany: (...a: unknown[]) => mockFindMany(...a) },
    platformConnection: { findMany: (...a: unknown[]) => mockFindMany(...a) },
    organization: { findUnique: (...a: unknown[]) => mockFindUnique(...a) },
    brandDNA: { findUnique: (...a: unknown[]) => mockFindUnique(...a) },
    contentCalendar: { upsert: (...a: unknown[]) => mockUpsert(...a) },
    // getContentIntelligence is fully mocked so these won't be called in practice,
    // but keep them for safety (inline jest.fn() is fine here since getContentIntelligence
    // mock intercepts before these are reached in generateWeeklyCalendar tests)
    contentPerformanceProfile: { findUnique: jest.fn().mockResolvedValue(null) },
    industryBaseline: { findUnique: jest.fn().mockResolvedValue(null) },
    seasonalSignal: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    // seasonalSignalsMatcher has its own catch so dismissal returning [] or undefined is safe
    seasonalSignalDismissal: { findMany: (...a: unknown[]) => mockSeasonalDismissalFindMany(...a) },
    // $queryRaw used by seasonalSignalsMatcher; non-fatal (caught internally)
    $queryRaw: (...a: unknown[]) => mockQueryRaw(...a),
  },
}));

// ── Content intelligence mock ─────────────────────────────────────────────────
jest.mock('@/lib/content-intelligence', () => ({
  getContentIntelligence: jest.fn(),
}));

import { getContentIntelligence } from '@/lib/content-intelligence';
const mockGetContentIntelligence = getContentIntelligence as jest.Mock;

import type { BlendedContentIntelligence } from '@/lib/content-intelligence/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const HIGH_CONFIDENCE_INTEL: BlendedContentIntelligence = {
  confidenceLevel: 0.8,
  postCount: 48,
  industry: 'plumbing-hvac',
  topTopics: [
    { topic: 'before-after', avgEngagementRate: 0.08, postCount: 12 },
    { topic: 'tip', avgEngagementRate: 0.06, postCount: 8 },
    { topic: 'testimonial', avgEngagementRate: 0.05, postCount: 6 },
  ],
  optimalTimes: { MON: ['09:00', '17:00'], FRI: ['12:00'] },
  winningHashtags: ['plumbing', 'emergency', 'hvac'],
  contentFormatScores: { video: 0.1, image: 0.06, carousel: 0.07, text: 0.03 },
};

const LOW_CONFIDENCE_INTEL: BlendedContentIntelligence = {
  ...HIGH_CONFIDENCE_INTEL,
  confidenceLevel: 0.3,
  postCount: 18,
};

const EMPTY_INTEL: BlendedContentIntelligence = {
  confidenceLevel: 0,
  postCount: 0,
  industry: 'general',
  topTopics: [],
  optimalTimes: {},
  winningHashtags: [],
  contentFormatScores: { video: 0, image: 0, carousel: 0, text: 0 },
};

// ── captionGenerator prompt tests ─────────────────────────────────────────────

describe('captionGenerator — intelligence prompt framing', () => {
  const ORIG_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIG_ENV, OPENROUTER_API_KEY: 'test-key' };
  });

  afterEach(() => {
    process.env = ORIG_ENV;
  });

  async function capturePrompt(intel?: BlendedContentIntelligence): Promise<string> {
    let capturedBody = '';
    global.fetch = jest.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      capturedBody = String(init.body ?? '');
      return {
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: '["cap1","cap2","cap3"]' } }],
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
      } as Response;
    });

    const { generateCaptions } = await import('@/lib/calendar/captionGenerator');
    await generateCaptions(
      {
        platform: 'instagram',
        contentType: 'educational',
        businessName: 'Test Plumbing',
        industry: 'plumbing-hvac',
        tone: 'friendly',
        hashtags: ['plumber'],
        intelligenceContext: intel,
      },
      'org-1'
    );
    return capturedBody;
  }

  it('includes client-specific framing when confidenceLevel >= 0.6', async () => {
    const body = await capturePrompt(HIGH_CONFIDENCE_INTEL);
    const parsed = JSON.parse(body) as { messages: Array<{ content: string }> };
    const userContent = parsed.messages.find(m => m.content.includes('audience'))?.content ?? '';
    expect(userContent).toContain("Based on this client's audience data");
    expect(userContent).toContain('80% confidence');
    expect(userContent).toContain('before-after');
  });

  it('includes industry-based framing when confidenceLevel < 0.6', async () => {
    const body = await capturePrompt(LOW_CONFIDENCE_INTEL);
    const parsed = JSON.parse(body) as { messages: Array<{ content: string }> };
    const userContent = parsed.messages.find(m => m.content.includes('audience'))?.content ?? '';
    expect(userContent).toContain('Based on industry patterns for plumbing-hvac');
  });

  it('omits intelligence line when no intelligenceContext provided', async () => {
    const body = await capturePrompt(undefined);
    const parsed = JSON.parse(body) as { messages: Array<{ content: string }> };
    const userContent = parsed.messages[1]?.content ?? '';
    expect(userContent).not.toContain('Audience intelligence:');
  });

  it('omits intelligence line when topTopics is empty', async () => {
    const body = await capturePrompt(EMPTY_INTEL);
    const parsed = JSON.parse(body) as { messages: Array<{ content: string }> };
    const userContent = parsed.messages[1]?.content ?? '';
    expect(userContent).not.toContain('Audience intelligence:');
  });
});

// ── generateWeeklyCalendar null-safety tests ──────────────────────────────────

describe('generateWeeklyCalendar — content intelligence null safety', () => {
  // Note: no jest.resetModules() here — resetting the module registry would create a
  // fresh @/lib/content-intelligence mock instance, making the top-level
  // mockGetContentIntelligence reference stale (it would point to the old jest.fn()).
  // jest.clearAllMocks() (from Jest config clearMocks:true) is sufficient to reset call counts.
  // mockUpsert is re-armed every beforeEach because jest.config resetMocks:true clears return values.

  let generateWeeklyCalendar: typeof import('@/lib/calendar/generateWeeklyCalendar').generateWeeklyCalendar;

  beforeAll(async () => {
    const mod = await import('@/lib/calendar/generateWeeklyCalendar');
    generateWeeklyCalendar = mod.generateWeeklyCalendar;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Re-arm mocks reset by Jest config resetMocks:true
    mockCountDigests.mockResolvedValue(5);
    mockUpsert.mockResolvedValue({ id: 'cal-1' });

    // digestReader: user.findMany must return at least one user so the digest
    // count branch runs (userIds.length > 0 → aIWeeklyDigest.count)
    mockFindUsers.mockResolvedValue([{ id: 'user-1' }]);
    // digestReader: post.findMany returns empty (fallback defaults used)
    mockFindPosts.mockResolvedValue([]);
    // seasonalSignalsMatcher: dismissal returns empty (no dismissed signals)
    mockSeasonalDismissalFindMany.mockResolvedValue([]);
    // seasonalSignalsMatcher: $queryRaw returns empty rows (no market slots)
    mockQueryRaw.mockResolvedValue([]);

    // Mock org + brand context
    mockFindUnique.mockImplementation((args: { where?: { organizationId?: string; id?: string } }) => {
      if (args.where?.organizationId !== undefined || args.where?.id === 'org-1') {
        return Promise.resolve({ name: 'Test Biz', industry: 'plumbing-hvac', businessName: 'Test Biz', brandVoice: { tone: 'friendly' } });
      }
      return Promise.resolve(null);
    });

    // Mock platform connections (for slot scheduler)
    mockFindMany.mockResolvedValue([]);

    // Default: captions API returns 3 captions
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: '["cap1","cap2","cap3"]' } }],
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    } as Response);
  });

  it('continues generation gracefully when getContentIntelligence throws', async () => {
    mockGetContentIntelligence.mockRejectedValue(new Error('DB timeout'));

    const weekStart = new Date('2026-06-01T00:00:00Z');

    // Should not throw — returns success with existing behaviour
    const result = await generateWeeklyCalendar('org-1', weekStart);

    // Even with intelligence failing, calendar generates
    expect(mockUpsert).toHaveBeenCalled();

    if (result.success) {
      expect(result.calendarId).toBe('cal-1');
    }
  });

  it('uses signalsVersion 1.2 when intelligence is successfully applied', async () => {
    mockGetContentIntelligence.mockResolvedValue(HIGH_CONFIDENCE_INTEL);

    const weekStart = new Date('2026-06-01T00:00:00Z');
    await generateWeeklyCalendar('org-1', weekStart);

    const upsertCall = mockUpsert.mock.calls[0]?.[0];
    expect(upsertCall?.create?.signalsVersion ?? upsertCall?.update?.signalsVersion).toBe('1.2');
  });

  it('uses signalsVersion 1.0 when intelligence unavailable and no market slots', async () => {
    mockGetContentIntelligence.mockResolvedValue(EMPTY_INTEL);

    const weekStart = new Date('2026-06-01T00:00:00Z');
    await generateWeeklyCalendar('org-1', weekStart);

    const upsertCall = mockUpsert.mock.calls[0]?.[0];
    const version = upsertCall?.create?.signalsVersion ?? upsertCall?.update?.signalsVersion;
    // Empty intelligence → no topics/hashtags → not applied → stays 1.0
    expect(['1.0', '1.1']).toContain(version);
  });
});
