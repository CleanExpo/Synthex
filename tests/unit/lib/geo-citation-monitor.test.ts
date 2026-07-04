/**
 * SYN-584 — GEO Citation Baseline Monitor unit tests.
 *
 * Covers the two done-criteria scenarios:
 *  1. 3 users × 3 GBP-seeded variants → 9 geo_citation_events rows.
 *  2. A 429 response → exponential backoff fires, error_reason is populated,
 *     and the run continues.
 *
 * The AI Overview fetcher is injected (mock) — no real provider, no network,
 * no fabricated SERP data.
 */

const mockUserFindMany = jest.fn();
const mockGbpFindMany = jest.fn();
const mockEventCreate = jest.fn();

const mockPrisma = {
  user: { findMany: (...a: unknown[]) => mockUserFindMany(...a) },
  gBPLocation: { findMany: (...a: unknown[]) => mockGbpFindMany(...a) },
  geoCitationEvent: { create: (...a: unknown[]) => mockEventCreate(...a) },
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

const mockTrackCost = jest.fn();
jest.mock('@/lib/pipelines/track-cost', () => ({
  trackPipelineCost: (...a: unknown[]) => mockTrackCost(...a),
}));

const mockEmailSend = jest.fn();
jest.mock('@/lib/email/index', () => ({
  email: { send: (...a: unknown[]) => mockEmailSend(...a) },
}));

import {
  runWeeklyGeoCitationMonitor,
  detectBrandMention,
} from '@/lib/geo-citation/run-weekly-monitor';
import type { AiOverviewFetcher } from '@/lib/geo-citation/ai-overview-adapter';

const noopSleep = jest.fn(async () => {});

function seedThreeUsersWithGbp() {
  mockUserFindMany.mockResolvedValue([
    { id: 'u1', organizationId: 'o1', organization: { name: 'Acme Plumbing' } },
    { id: 'u2', organizationId: 'o2', organization: { name: 'Beta Electrical' } },
    { id: 'u3', organizationId: 'o3', organization: { name: 'Gamma Roofing' } },
  ]);
  mockGbpFindMany.mockResolvedValue([
    {
      organizationId: 'o1',
      categories: { primaryCategory: 'Plumber' },
      address: { locality: 'Brisbane' },
    },
    {
      organizationId: 'o2',
      categories: { primaryCategory: { displayName: 'Electrician' } },
      address: { locality: 'Sydney' },
    },
    {
      organizationId: 'o3',
      categories: { primaryCategory: 'Roofer' },
      address: { locality: 'Melbourne' },
    },
  ]);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockEventCreate.mockResolvedValue({});
  mockTrackCost.mockResolvedValue(undefined);
  mockEmailSend.mockResolvedValue('queued');
});

describe('detectBrandMention', () => {
  it('flags a case-insensitive match and records the offset', () => {
    const r = detectBrandMention(
      'Acme Plumbing',
      'The top pick is acme plumbing in Brisbane.'
    );
    expect(r.brandMentioned).toBe(true);
    expect(r.mentionPosition).toBe('The top pick is '.length);
    expect(r.rawSnippet).toContain('acme plumbing');
  });

  it('does not flag when the brand is absent (still keeps a snippet)', () => {
    const r = detectBrandMention('Acme Plumbing', 'Some other business entirely.');
    expect(r.brandMentioned).toBe(false);
    expect(r.mentionPosition).toBeNull();
    expect(r.rawSnippet).toBe('Some other business entirely.');
  });

  it('caps the snippet at 500 characters', () => {
    const r = detectBrandMention('x', 'a'.repeat(600));
    expect(r.rawSnippet).toHaveLength(500);
  });
});

describe('runWeeklyGeoCitationMonitor', () => {
  it('writes 9 events for 3 users × 3 query variants', async () => {
    seedThreeUsersWithGbp();

    // Configured fetcher: returns a benign AI Overview block (no brand match).
    const fetcher: AiOverviewFetcher = jest.fn(async (queryText: string) => ({
      configured: true,
      rawText: `AI Overview for "${queryText}" — no clear winner.`,
      errorReason: null,
    }));

    const summary = await runWeeklyGeoCitationMonitor({
      fetcher,
      sleep: noopSleep,
      skipRateLimit: true,
    });

    expect(mockEventCreate).toHaveBeenCalledTimes(9);
    expect(summary.eventsWritten).toBe(9);
    expect(summary.usersProcessed).toBe(3);
    expect(summary.usersSkippedNoGbp).toBe(0);

    // Variant text is generated from category + suburb.
    const texts = mockEventCreate.mock.calls.map(c => c[0].data.queryText);
    expect(texts).toContain('Plumber Brisbane');
    expect(texts).toContain('best Plumber Brisbane');
    expect(texts).toContain('Plumber near Brisbane');
    expect(texts).toContain('Electrician Sydney'); // object-form primaryCategory
  });

  it('skips users whose organisation has no GBP location', async () => {
    mockUserFindMany.mockResolvedValue([
      { id: 'u1', organizationId: 'o1', organization: { name: 'Acme' } },
      { id: 'u2', organizationId: 'o2', organization: { name: 'Beta' } },
    ]);
    mockGbpFindMany.mockResolvedValue([
      {
        organizationId: 'o1',
        categories: { primaryCategory: 'Plumber' },
        address: { locality: 'Brisbane' },
      },
    ]); // o2 has no location

    const fetcher: AiOverviewFetcher = jest.fn(async () => ({
      configured: true,
      rawText: 'nothing',
      errorReason: null,
    }));

    const summary = await runWeeklyGeoCitationMonitor({
      fetcher,
      sleep: noopSleep,
      skipRateLimit: true,
    });

    expect(summary.usersProcessed).toBe(1);
    expect(summary.usersSkippedNoGbp).toBe(1);
    expect(mockEventCreate).toHaveBeenCalledTimes(3);
  });

  it('backs off on 429, populates error_reason=rate_limited, and continues', async () => {
    mockUserFindMany.mockResolvedValue([
      { id: 'u1', organizationId: 'o1', organization: { name: 'Acme Plumbing' } },
    ]);
    mockGbpFindMany.mockResolvedValue([
      {
        organizationId: 'o1',
        categories: { primaryCategory: 'Plumber' },
        address: { locality: 'Brisbane' },
      },
    ]);

    const fetcher: AiOverviewFetcher = jest.fn(async () => ({
      configured: true,
      rawText: null,
      errorReason: null,
      statusCode: 429,
    }));

    const summary = await runWeeklyGeoCitationMonitor({
      fetcher,
      sleep: noopSleep,
      skipRateLimit: true,
    });

    // Backoff schedule 1→2→4→8s fired for each of the 3 queries.
    const delays = noopSleep.mock.calls.map(c => c[0]);
    expect(delays).toEqual(
      expect.arrayContaining([1000, 2000, 4000, 8000])
    );

    // Run continued: all 3 events written, each marked rate_limited.
    expect(mockEventCreate).toHaveBeenCalledTimes(3);
    for (const call of mockEventCreate.mock.calls) {
      expect(call[0].data.errorReason).toBe('rate_limited');
      expect(call[0].data.brandMentioned).toBe(false);
    }
    expect(summary.rateLimited).toBe(3);
    expect(summary.eventsWritten).toBe(3);
    // No real spend on rate-limited requests → no cost alert.
    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('records the not-configured reason when no provider fetcher is wired', async () => {
    mockUserFindMany.mockResolvedValue([
      { id: 'u1', organizationId: 'o1', organization: { name: 'Acme Plumbing' } },
    ]);
    mockGbpFindMany.mockResolvedValue([
      {
        organizationId: 'o1',
        categories: { primaryCategory: 'Plumber' },
        address: { locality: 'Brisbane' },
      },
    ]);

    // No fetcher passed → default not-configured adapter is used.
    const summary = await runWeeklyGeoCitationMonitor({
      sleep: noopSleep,
      skipRateLimit: true,
    });

    expect(mockEventCreate).toHaveBeenCalledTimes(3);
    for (const call of mockEventCreate.mock.calls) {
      expect(call[0].data.errorReason).toContain('not configured');
      expect(call[0].data.brandMentioned).toBe(false);
    }
    expect(summary.providerConfigured).toBe(false);
    expect(summary.estimatedCostAud).toBe(0);
  });
});
