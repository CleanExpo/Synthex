/**
 * Auto-Calendar pipeline — CI smoke test (SYN-590)
 *
 * Board Session 13 failure mode this guards against:
 *   A calendar-generation run that returns "success" but writes a
 *   STRUCTURALLY EMPTY calendar — no slots, or slots whose caption `content`
 *   is null / empty, or a slot missing its `scheduled_for` timestamp.
 *   Error monitoring never fires on these: they look like healthy runs while
 *   silently damaging client marketing content.
 *
 * This is a SMOKE test, not an integration test. It asserts structural
 * validity of the pipeline's happy-path output — not content quality, not
 * cross-subsystem data flow. All external calls (Supabase, AI caption model)
 * are mocked so the test is fast and deterministic.
 *
 * Pipeline entry point: lib/calendar/generateWeeklyCalendar.ts
 *   (invoked in production by app/api/cron/generate-calendars/route.ts).
 * The persisted ContentCalendar row is the structure a client eventually sees,
 * so the emptiness guard is asserted against the row this pipeline writes.
 *
 * Test client: industry `trades`, state `NSW` — see tests/README.md.
 */

// ── Shared mock objects ───────────────────────────────────────────────────────

const mockPrismaContentCalendar = { upsert: jest.fn() };
const mockPrismaOrganization = { findUnique: jest.fn() };
const mockPrismaBrandDNA = { findUnique: jest.fn() };
const mockPrismaUser = { findMany: jest.fn() };
const mockPrismaAIWeeklyDigest = { count: jest.fn() };
const mockPrismaPost = { findMany: jest.fn() };
const mockGenerateCaptions = jest.fn();

// ── Module mocks (must be declared before importing the pipeline) ─────────────

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    contentCalendar: mockPrismaContentCalendar,
    organization: mockPrismaOrganization,
    brandDNA: mockPrismaBrandDNA,
    user: mockPrismaUser,
    aIWeeklyDigest: mockPrismaAIWeeklyDigest,
    post: mockPrismaPost,
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('@/lib/pipelines/track-cost', () => ({
  trackPipelineCost: jest.fn().mockResolvedValue(undefined),
  calculatePipelineCost: jest.fn().mockReturnValue(0.001),
}));

jest.mock('@/lib/calendar/captionGenerator', () => ({
  generateCaptions: mockGenerateCaptions,
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { generateWeeklyCalendar } from '@/lib/calendar/generateWeeklyCalendar';

// ── Test client fixture — industry 'trades', state 'NSW' (tests/README.md) ────

const TEST_CLIENT_ORG_ID = 'smoke-test-org-trades-nsw';
const KNOWN_MONDAY = new Date('2026-03-30T00:00:00.000Z');

const CALENDAR_ENDPOINT_HINT =
  'check lib/calendar/generateWeeklyCalendar (production route /api/cron/generate-calendars) and the trades/NSW test client seed';

interface PersistedSlot {
  captions?: string[];
  scheduledAt?: string;
}
interface PersistedCalendar {
  slots?: PersistedSlot[];
}

describe('Auto-Calendar pipeline smoke test (SYN-590)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Eligible client with ≥3 digests and prior posts (digest signal source).
    mockPrismaUser.findMany.mockResolvedValue([{ id: 'user-trades-nsw-1' }]);
    mockPrismaAIWeeklyDigest.count.mockResolvedValue(5);
    mockPrismaPost.findMany.mockResolvedValue([
      {
        content: 'Winter pipe maintenance — book your service now',
        platform: 'instagram',
        hashtags: ['#plumbing', '#NSW'],
        publishedAt: new Date('2026-03-01T09:00:00Z'),
      },
      {
        content: 'Emergency callout special this weekend',
        platform: 'facebook',
        hashtags: ['#trades'],
        publishedAt: new Date('2026-03-08T12:00:00Z'),
      },
    ]);

    // Brand context for caption generation.
    mockPrismaOrganization.findUnique.mockResolvedValue({
      name: 'Test Trades Co',
      industry: 'Trades',
    });
    mockPrismaBrandDNA.findUnique.mockResolvedValue({
      businessName: 'Test Trades Co',
      brandVoice: { tone: 'professional and reassuring' },
    });

    // AI caption model returns 3 non-empty caption variations per slot.
    mockGenerateCaptions.mockResolvedValue([
      'Book your winter plumbing service today and beat the cold snap.',
      'Blocked drains? Our NSW team is on call this weekend.',
      'Five signs your hot water system needs attention.',
    ]);

    mockPrismaContentCalendar.upsert.mockResolvedValue({
      id: 'cal-smoke-trades-nsw-001',
    });
  });

  it('returns a successful CalendarGenerationResult with a calendar id', async () => {
    const result = await generateWeeklyCalendar(
      TEST_CLIENT_ORG_ID,
      KNOWN_MONDAY
    );

    if (!result.success) {
      throw new Error(
        `Auto-Calendar smoke test FAILED: expected success:true, got failure ` +
          `(reason: ${result.reason}) — ${CALENDAR_ENDPOINT_HINT}`
      );
    }
    expect(result.calendarId).toBeTruthy();
    expect(result.organizationId).toBe(TEST_CLIENT_ORG_ID);
  });

  it('writes a non-empty calendar_posts array with non-null, non-empty content and a scheduled_for timestamp', async () => {
    await generateWeeklyCalendar(TEST_CLIENT_ORG_ID, KNOWN_MONDAY);

    if (mockPrismaContentCalendar.upsert.mock.calls.length === 0) {
      throw new Error(
        `Auto-Calendar smoke test FAILED: pipeline never persisted a calendar — ${CALENDAR_ENDPOINT_HINT}`
      );
    }

    const upsertArg = mockPrismaContentCalendar.upsert.mock.calls[0][0];
    const calendar = upsertArg.create.slots as PersistedCalendar;
    const calendarPosts = calendar.slots;

    // (b)+(c) non-empty calendar_posts array
    if (!Array.isArray(calendarPosts) || calendarPosts.length === 0) {
      throw new Error(
        `Auto-Calendar smoke test FAILED: expected a non-empty calendar_posts array, ` +
          `got ${JSON.stringify(calendarPosts)} — ${CALENDAR_ENDPOINT_HINT}`
      );
    }

    const firstPost = calendarPosts[0];

    // (d) content is a non-null, non-empty string
    const content = firstPost.captions?.[0];
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new Error(
        `Auto-Calendar smoke test FAILED: expected non-null content string, got ` +
          `${JSON.stringify(content)} — a semantically empty caption ships broken ` +
          `marketing content to the client. ${CALENDAR_ENDPOINT_HINT}`
      );
    }

    // (e) scheduled_for is a non-null ISO timestamp
    const scheduledFor = firstPost.scheduledAt;
    if (
      typeof scheduledFor !== 'string' ||
      Number.isNaN(Date.parse(scheduledFor))
    ) {
      throw new Error(
        `Auto-Calendar smoke test FAILED: expected scheduled_for to be a non-null ISO ` +
          `timestamp, got ${JSON.stringify(scheduledFor)} — ${CALENDAR_ENDPOINT_HINT}`
      );
    }

    expect(content.length).toBeGreaterThan(0);
    expect(Date.parse(scheduledFor)).not.toBeNaN();
  });
});
