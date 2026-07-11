/**
 * Grilled YouTube package persistence — SYN-1094 follow-up A.
 *
 * `deriveSocialCut` now persists a structured YouTube search package
 * (`{ title, description?, tags }`) onto the cut's videoAsset metadata as
 * `metadata.youtube`, in the EXACT shape the dispatch resolver
 * (`resolveSocialCutSource`, lib/publish/socialCutSource.ts) reads. A released
 * YouTube cut therefore publishes with real search metadata instead of the
 * dispatcher's caption-derived title fallback.
 *
 * These tests prove (MOCKED prisma, NO network):
 *  1. A YouTube cut with NO upstream package persists metadata.youtube with a
 *     title derived from the caption's first line + empty tags (no invented SEO).
 *  2. A YouTube cut WITH a grilled package persists it verbatim (title clamped).
 *  3. A non-YouTube cut persists NO metadata.youtube (unaffected).
 *  4. Round-trip: the metadata deriveSocialCut writes is exactly what
 *     resolveSocialCutSource reads back as `.youtube` (not the caption fallback).
 *  5. §15.9 invariant: this only ADDS optional metadata — the queue row is still
 *     enqueued 'queued_human_gated' and no gated→pending transition is introduced.
 */

// ── Shared mock objects ───────────────────────────────────────────────────────

const mockVideoAsset = { findUnique: jest.fn(), create: jest.fn() };
const mockVideoGeneration = { findFirst: jest.fn() };
const mockContentCalendar = { findFirst: jest.fn(), create: jest.fn() };
const mockPublishQueueItem = { create: jest.fn() };
const mockVideoGateVerdict = { findFirst: jest.fn() };

const mockPrisma: Record<string, unknown> = {
  videoAsset: mockVideoAsset,
  videoGeneration: mockVideoGeneration,
  contentCalendar: mockContentCalendar,
  publishQueueItem: mockPublishQueueItem,
  videoGateVerdict: mockVideoGateVerdict,
};
mockPrisma.$transaction = jest.fn(
  async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma)
);

const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

// deriveSocialCut imports `{ prisma }`; resolveSocialCutSource imports the
// default — expose both so the round-trip shares ONE mocked client.
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: mockPrisma,
  default: mockPrisma,
}));
jest.mock('@/lib/logger', () => ({ logger: mockLogger }));
jest.mock('@/lib/observability/sentry-server', () => ({
  captureServerException: jest.fn(),
  isSentryServerEnabled: jest.fn().mockReturnValue(false),
}));

import {
  deriveSocialCut,
  buildYoutubeCutPackage,
  type DeriveSocialCutInput,
} from '@/lib/video/social-derivation';
import { resolveSocialCutSource } from '@/lib/publish/socialCutSource';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORG_ID = 'org-yt-001';

const HERO_VIDEO_ASSET = {
  id: 'hero-va-001',
  founderId: 'user-001',
  title: 'Flooded office, dried fast',
  url: 'https://storage.synthex.social/video/hero-va-001.mp4',
  thumbnail: 'https://storage.synthex.social/video/hero-va-001.jpg',
  duration: 42,
  status: 'ready',
  metadata: { aspectRatio: '9:16' },
  founder: { organizationId: ORG_ID },
};

const YT_INPUT: DeriveSocialCutInput = {
  orgId: ORG_ID,
  heroAssetId: 'hero-va-001',
  target: '9:16',
  maxSec: 60,
  captionPlacement: 'upper',
  caption: 'We dried a flooded office in 4 hours\nHere is exactly how',
  trimFrom: 'tail',
  keepSubjectCentre: true,
  platform: 'youtube',
};

function primeHappyPath() {
  (mockPrisma.$transaction as jest.Mock).mockImplementation(
    async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma)
  );
  mockVideoGateVerdict.findFirst.mockResolvedValue({
    status: 'passed',
    blockedReasons: [],
  });
  mockVideoAsset.findUnique.mockResolvedValue(HERO_VIDEO_ASSET);
  mockVideoGeneration.findFirst.mockResolvedValue(null);
  mockContentCalendar.findFirst.mockResolvedValue({ id: 'cal-001' });
  mockVideoAsset.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'cut-001',
      ...data,
    })
  );
  mockPublishQueueItem.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'pq-001',
      ...data,
    })
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  primeHappyPath();
});

/** The metadata object deriveSocialCut wrote on the created cut. */
function writtenMetadata(): Record<string, unknown> {
  const { data } = mockVideoAsset.create.mock.calls[0][0];
  return data.metadata as Record<string, unknown>;
}

// ── buildYoutubeCutPackage (pure) ─────────────────────────────────────────────

describe('buildYoutubeCutPackage()', () => {
  it('derives the title from the caption first line and empties tags when no package', () => {
    const pkg = buildYoutubeCutPackage('Line one\nLine two');
    expect(pkg).toEqual({ title: 'Line one', tags: [] });
    expect(pkg).not.toHaveProperty('description');
  });

  it('derives the title from the first NON-EMPTY line when the caption leads with a newline', () => {
    // A caption starting with a newline (empty first line) must not yield an
    // empty title — the YouTube adapter requires a non-empty title.
    const pkg = buildYoutubeCutPackage('\n\nReal first line\nSecond line');
    expect(pkg.title).toBe('Real first line');
    expect(pkg.title.length).toBeGreaterThan(0);
  });

  it('uses a supplied package verbatim and clamps the title to 100 chars', () => {
    const longTitle = 'A'.repeat(140);
    const pkg = buildYoutubeCutPackage('caption', {
      title: longTitle,
      description: 'Full grilled description.',
      tags: ['water damage', 'restoration'],
    });
    expect(pkg.title).toHaveLength(100);
    expect(pkg.description).toBe('Full grilled description.');
    expect(pkg.tags).toEqual(['water damage', 'restoration']);
  });

  it('drops blank tags and never fabricates a description', () => {
    const pkg = buildYoutubeCutPackage('caption', {
      tags: ['keep', '  ', ''],
    });
    expect(pkg.tags).toEqual(['keep']);
    expect(pkg).not.toHaveProperty('description');
  });
});

// ── deriveSocialCut persistence ───────────────────────────────────────────────

describe('deriveSocialCut() — YouTube package persistence', () => {
  it('persists metadata.youtube with a caption-derived title + empty tags when no package supplied', async () => {
    await deriveSocialCut(YT_INPUT);

    const meta = writtenMetadata();
    expect(meta.youtube).toEqual({
      title: 'We dried a flooded office in 4 hours',
      tags: [],
    });
  });

  it('persists a supplied grilled package verbatim (in the resolver shape)', async () => {
    await deriveSocialCut({
      ...YT_INPUT,
      youtube: {
        title: 'Flooded office dried in 4 hours',
        description: 'The exact 4-step process our crew used.',
        tags: ['water damage', 'restoration', 'brisbane'],
      },
    });

    const meta = writtenMetadata();
    expect(meta.youtube).toEqual({
      title: 'Flooded office dried in 4 hours',
      description: 'The exact 4-step process our crew used.',
      tags: ['water damage', 'restoration', 'brisbane'],
    });
  });

  it('does NOT persist metadata.youtube for a non-YouTube cut', async () => {
    await deriveSocialCut({
      ...YT_INPUT,
      platform: 'instagram',
      // even if a package is passed, a non-YouTube cut ignores it
      youtube: { title: 'ignored', tags: ['ignored'] },
    });

    const meta = writtenMetadata();
    expect(meta).not.toHaveProperty('youtube');
    // the derivation caption is still written — non-YouTube cut is unaffected
    expect((meta.derivation as Record<string, any>).caption.text).toBe(
      YT_INPUT.caption
    );
  });

  it('does NOT persist metadata.youtube when no platform is given', async () => {
    const { platform: _omit, ...noPlatform } = YT_INPUT;
    await deriveSocialCut(noPlatform);
    expect(writtenMetadata()).not.toHaveProperty('youtube');
  });
});

// ── Round-trip: what derive writes is what the resolver reads ──────────────────

describe('resolveSocialCutSource() reads the persisted YouTube package', () => {
  it('returns the grilled youtube snippet (NOT the caption fallback) for a derived YouTube cut', async () => {
    // 1. Derive a YouTube cut carrying a grilled package.
    await deriveSocialCut({
      ...YT_INPUT,
      youtube: {
        title: 'Flooded office dried in 4 hours',
        description: 'The exact steps.',
        tags: ['water damage', 'restoration'],
      },
    });
    const { data } = mockVideoAsset.create.mock.calls[0][0];

    // 2. Feed the EXACT persisted row back to the dispatch resolver.
    mockVideoAsset.findUnique.mockResolvedValue({
      url: data.url,
      thumbnail: data.thumbnail,
      metadata: data.metadata,
    });

    const source = await resolveSocialCutSource(
      `social-cut:${data.id ?? 'cut-001'}`,
      ORG_ID
    );

    expect(source).not.toBeNull();
    expect(source?.youtube).toEqual({
      title: 'Flooded office dried in 4 hours',
      description: 'The exact steps.',
      tags: ['water damage', 'restoration'],
    });
  });

  it('resolves the caption-derived title package when no upstream package existed', async () => {
    await deriveSocialCut(YT_INPUT); // no youtube package
    const { data } = mockVideoAsset.create.mock.calls[0][0];

    mockVideoAsset.findUnique.mockResolvedValue({
      url: data.url,
      thumbnail: data.thumbnail,
      metadata: data.metadata,
    });

    const source = await resolveSocialCutSource('social-cut:cut-001', ORG_ID);
    expect(source?.youtube).toEqual({
      title: 'We dried a flooded office in 4 hours',
      tags: [],
    });
  });
});

// ── §15.9 invariant ───────────────────────────────────────────────────────────

describe('§15.9 — persisting the package does not weaken the human gate', () => {
  it('still enqueues the cut as queued_human_gated (no gated→pending transition added)', async () => {
    await deriveSocialCut(YT_INPUT);

    expect(mockPublishQueueItem.create).toHaveBeenCalledTimes(1);
    const { data } = mockPublishQueueItem.create.mock.calls[0][0];
    expect(data.status).toBe('queued_human_gated');
    // the YouTube package lives on the videoAsset, never on the queue row
    expect(data).not.toHaveProperty('youtube');
  });
});
