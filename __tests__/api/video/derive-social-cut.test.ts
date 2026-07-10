/**
 * Unit tests for deriveSocialCut — lib/video/social-derivation.ts
 *
 * The adapter consumed by the nexus-viral repurpose engine
 * (skills-library/skills/nexus-viral/engine/repurpose.ts). Contract:
 *   deriveSocialCut({ orgId, heroAssetId, target, maxSec, captionPlacement,
 *                     caption, trimFrom: 'tail', keepSubjectCentre })
 *     → Promise<{ assetId, subjectLost }>
 *
 * Covers:
 *  - Pure derivation internals: crop window, tail trim, caption placement vs
 *    the viral safe zone, subject-loss assessment
 *  - deriveSocialCut(): input validation, org-scoped hero resolution
 *    (video_assets first, videoGeneration fallback), cut row landing in
 *    video_assets, publish_queue enqueue as queued_human_gated
 *
 * Mock strategy:
 * - @/lib/prisma: videoAsset / videoGeneration / contentCalendar /
 *   publishQueueItem stubs + $transaction pass-through
 * - @/lib/logger: silent mocks
 * - Safe zone is the REAL data (viral-method-cards.json) — assertions are
 *   relational against VIRAL_SAFE_ZONE, not hardcoded copies.
 */

import { VIRAL_SAFE_ZONE } from '@/lib/services/ai/video/cards/viral-method-cards';

// ── Shared mock objects ───────────────────────────────────────────────────────

const mockVideoAsset = { findUnique: jest.fn(), create: jest.fn() };
const mockVideoGeneration = { findFirst: jest.fn() };
const mockContentCalendar = { findFirst: jest.fn(), create: jest.fn() };
const mockPublishQueueItem = { create: jest.fn() };
const mockVideoEpisode = {
  findUnique: jest.fn(),
  update: jest.fn(),
  findMany: jest.fn(),
};

const mockPrisma: Record<string, unknown> = {
  videoAsset: mockVideoAsset,
  videoGeneration: mockVideoGeneration,
  contentCalendar: mockContentCalendar,
  publishQueueItem: mockPublishQueueItem,
  videoEpisode: mockVideoEpisode,
};
// Callback-style $transaction: hand the same mock client to the callback
mockPrisma.$transaction = jest.fn(
  async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma)
);

const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
  default: mockPrisma,
}));
jest.mock('@/lib/logger', () => ({ logger: mockLogger }));

import {
  aspectToRatio,
  computeCropWindow,
  computeTailTrim,
  planCaptionPlacement,
  assessSubjectLoss,
  deriveSocialCut,
  type DeriveSocialCutInput,
} from '@/lib/video/social-derivation';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORG_ID = 'org-001';

/** Hero already promoted to video_assets (9:16, 42s, founder in ORG_ID) */
const HERO_VIDEO_ASSET = {
  id: 'hero-va-001',
  founderId: 'user-001',
  title: '3-second water-damage myth',
  url: 'https://storage.synthex.social/video/hero-va-001.mp4',
  thumbnail: 'https://storage.synthex.social/video/hero-va-001.jpg',
  duration: 42,
  status: 'ready',
  metadata: { aspectRatio: '9:16' },
  founder: { organizationId: ORG_ID },
};

/** Hero still in videoGeneration (generative engine output) */
const HERO_VIDEO_GENERATION = {
  id: 'hero-gen-001',
  userId: 'user-002',
  organizationId: ORG_ID,
  title: 'Espresso mistake every café makes',
  videoUrl: 'https://fal.media/files/hero-gen-001.mp4',
  thumbnailUrl: null,
  aspectRatio: '9:16',
  durationSeconds: 30,
  metadata: null,
};

const EXISTING_CALENDAR = { id: 'cal-001' };

const BASE_INPUT: DeriveSocialCutInput = {
  orgId: ORG_ID,
  heroAssetId: 'hero-va-001',
  target: '9:16',
  maxSec: 15,
  captionPlacement: 'upper',
  caption: 'Stop the scroll: the 3-second myth.',
  trimFrom: 'tail',
  keepSubjectCentre: true,
};

function primeHappyPath() {
  // jest.worktree.cjs sets resetMocks: true — every implementation must be
  // re-primed per test, including the $transaction pass-through.
  (mockPrisma.$transaction as jest.Mock).mockImplementation(
    async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma)
  );
  mockVideoAsset.findUnique.mockResolvedValue(HERO_VIDEO_ASSET);
  mockVideoGeneration.findFirst.mockResolvedValue(null);
  mockContentCalendar.findFirst.mockResolvedValue(EXISTING_CALENDAR);
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

// ── Pure internals: crop ──────────────────────────────────────────────────────

describe('aspectToRatio()', () => {
  it('parses the three supported targets', () => {
    expect(aspectToRatio('9:16')).toBeCloseTo(0.5625, 4);
    expect(aspectToRatio('1:1')).toBeCloseTo(1, 4);
    expect(aspectToRatio('16:9')).toBeCloseTo(1.7778, 3);
  });
});

describe('computeCropWindow()', () => {
  it('returns the full frame when source and target aspect match', () => {
    const win = computeCropWindow(aspectToRatio('9:16'), aspectToRatio('9:16'));
    expect(win).toEqual({ xPct: 0, yPct: 0, wPct: 100, hPct: 100 });
  });

  it('centre-crops height for 9:16 → 1:1 (keeps full width)', () => {
    const win = computeCropWindow(aspectToRatio('9:16'), aspectToRatio('1:1'));
    expect(win.wPct).toBe(100);
    expect(win.xPct).toBe(0);
    expect(win.hPct).toBeCloseTo(56.25, 2);
    expect(win.yPct).toBeCloseTo((100 - 56.25) / 2, 2);
  });

  it('centre-crops width for 16:9 → 9:16 (keeps full height)', () => {
    const win = computeCropWindow(aspectToRatio('16:9'), aspectToRatio('9:16'));
    expect(win.hPct).toBe(100);
    expect(win.yPct).toBe(0);
    // (9/16) / (16/9) = 81/256 ≈ 31.64% of the width survives
    expect(win.wPct).toBeCloseTo(31.64, 1);
    expect(win.xPct).toBeCloseTo((100 - 31.64) / 2, 1);
  });
});

// ── Pure internals: trim ──────────────────────────────────────────────────────

describe('computeTailTrim()', () => {
  it('trims the tail down to maxSec when the hero is longer', () => {
    expect(computeTailTrim(42, 15)).toEqual({
      fromSec: 0,
      toSec: 15,
      heroDurationKnown: true,
    });
  });

  it('keeps the full hero when it is already within maxSec', () => {
    expect(computeTailTrim(10, 15)).toEqual({
      fromSec: 0,
      toSec: 10,
      heroDurationKnown: true,
    });
  });

  it('plans to maxSec when the hero duration is unknown', () => {
    expect(computeTailTrim(null, 15)).toEqual({
      fromSec: 0,
      toSec: 15,
      heroDurationKnown: false,
    });
  });
});

// ── Pure internals: caption placement vs safe zone ────────────────────────────

describe('planCaptionPlacement()', () => {
  it.each(['upper', 'centre', 'cover'] as const)(
    '%s band stays out of the reserved bottom and right zones',
    placement => {
      const plan = planCaptionPlacement('Short caption', placement);
      expect(plan.band.yPct + plan.band.hPct).toBeLessThanOrEqual(
        100 - VIRAL_SAFE_ZONE.bottomReservedPct
      );
      expect(plan.band.xPct + plan.band.wPct).toBeLessThanOrEqual(
        100 - VIRAL_SAFE_ZONE.rightReservedPct
      );
    }
  );

  it('places upper above centre', () => {
    const upper = planCaptionPlacement('x', 'upper');
    const centre = planCaptionPlacement('x', 'centre');
    expect(upper.band.yPct).toBeLessThan(centre.band.yPct);
  });

  it('accepts a caption that fits captionMaxLines', () => {
    const plan = planCaptionPlacement('Short caption', 'upper');
    expect(plan.estimatedLines).toBeLessThanOrEqual(
      VIRAL_SAFE_ZONE.captionMaxLines
    );
    expect(plan.withinSafeZone).toBe(true);
  });

  it('flags a caption that overflows captionMaxLines', () => {
    const longCaption = 'A'.repeat(400);
    const plan = planCaptionPlacement(longCaption, 'upper');
    expect(plan.estimatedLines).toBeGreaterThan(
      VIRAL_SAFE_ZONE.captionMaxLines
    );
    expect(plan.withinSafeZone).toBe(false);
  });
});

// ── Pure internals: subject loss ──────────────────────────────────────────────

describe('assessSubjectLoss()', () => {
  const NO_CROP = { xPct: 0, yPct: 0, wPct: 100, hPct: 100 };
  const MILD_CROP = { xPct: 0, yPct: 21.875, wPct: 100, hPct: 56.25 }; // 9:16→1:1
  const DRASTIC_CROP = { xPct: 34.18, yPct: 0, wPct: 31.64, hPct: 100 }; // 16:9→9:16

  it('never flags when keepSubjectCentre is false', () => {
    expect(
      assessSubjectLoss({ keepSubjectCentre: false, crop: DRASTIC_CROP })
    ).toBe(false);
  });

  it('never flags when no crop occurs', () => {
    expect(assessSubjectLoss({ keepSubjectCentre: true, crop: NO_CROP })).toBe(
      false
    );
  });

  it('does not flag a mild centre-crop without subject evidence', () => {
    expect(
      assessSubjectLoss({ keepSubjectCentre: true, crop: MILD_CROP })
    ).toBe(false);
  });

  it('flags a drastic crop (under half a dimension retained) without subject evidence', () => {
    expect(
      assessSubjectLoss({ keepSubjectCentre: true, crop: DRASTIC_CROP })
    ).toBe(true);
  });

  it('does not flag when a known subject box fits inside the crop', () => {
    expect(
      assessSubjectLoss({
        keepSubjectCentre: true,
        crop: MILD_CROP,
        subjectBox: { xPct: 30, yPct: 30, wPct: 40, hPct: 40 },
      })
    ).toBe(false);
  });

  it('flags when a known subject box falls outside the crop', () => {
    expect(
      assessSubjectLoss({
        keepSubjectCentre: true,
        crop: MILD_CROP,
        subjectBox: { xPct: 10, yPct: 5, wPct: 80, hPct: 90 },
      })
    ).toBe(true);
  });
});

// ── deriveSocialCut(): input validation ───────────────────────────────────────

describe('deriveSocialCut() — validation', () => {
  it.each([
    ['non-positive maxSec', { ...BASE_INPUT, maxSec: 0 }],
    ['empty caption', { ...BASE_INPUT, caption: '   ' }],
    [
      'unsupported trimFrom',
      { ...BASE_INPUT, trimFrom: 'head' as unknown as 'tail' },
    ],
    [
      'unknown target',
      {
        ...BASE_INPUT,
        target: '4:3' as unknown as DeriveSocialCutInput['target'],
      },
    ],
    [
      'unknown captionPlacement',
      {
        ...BASE_INPUT,
        captionPlacement:
          'lower' as unknown as DeriveSocialCutInput['captionPlacement'],
      },
    ],
    ['missing orgId', { ...BASE_INPUT, orgId: '' }],
    ['missing heroAssetId', { ...BASE_INPUT, heroAssetId: '' }],
  ])('rejects %s', async (_label, input) => {
    await expect(deriveSocialCut(input)).rejects.toThrow();
    expect(mockVideoAsset.create).not.toHaveBeenCalled();
    expect(mockPublishQueueItem.create).not.toHaveBeenCalled();
  });
});

// ── deriveSocialCut(): hero resolution ────────────────────────────────────────

describe('deriveSocialCut() — hero resolution', () => {
  it('throws when the hero exists in neither video_assets nor videoGeneration', async () => {
    mockVideoAsset.findUnique.mockResolvedValue(null);
    mockVideoGeneration.findFirst.mockResolvedValue(null);

    await expect(deriveSocialCut(BASE_INPUT)).rejects.toThrow(/not found/i);
  });

  it('rejects a video_assets hero owned by another organisation', async () => {
    mockVideoAsset.findUnique.mockResolvedValue({
      ...HERO_VIDEO_ASSET,
      founder: { organizationId: 'org-other' },
    });
    mockVideoGeneration.findFirst.mockResolvedValue(null);

    await expect(deriveSocialCut(BASE_INPUT)).rejects.toThrow(/not found/i);
    expect(mockVideoAsset.create).not.toHaveBeenCalled();
  });

  it('falls back to an org-scoped videoGeneration lookup', async () => {
    mockVideoAsset.findUnique.mockResolvedValue(null);
    mockVideoGeneration.findFirst.mockResolvedValue(HERO_VIDEO_GENERATION);

    const result = await deriveSocialCut({
      ...BASE_INPUT,
      heroAssetId: 'hero-gen-001',
    });

    expect(mockVideoGeneration.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'hero-gen-001',
          organizationId: ORG_ID,
        }),
      })
    );
    expect(result.assetId).toBe('cut-001');
  });

  it('throws when a videoGeneration hero has no rendered videoUrl', async () => {
    mockVideoAsset.findUnique.mockResolvedValue(null);
    mockVideoGeneration.findFirst.mockResolvedValue({
      ...HERO_VIDEO_GENERATION,
      videoUrl: null,
    });

    await expect(
      deriveSocialCut({ ...BASE_INPUT, heroAssetId: 'hero-gen-001' })
    ).rejects.toThrow(/no rendered video/i);
  });
});

// ── deriveSocialCut(): the cut lands in video_assets ──────────────────────────

describe('deriveSocialCut() — video_assets row', () => {
  it('creates a pending cut owned by the hero founder with the derivation plan in metadata', async () => {
    await deriveSocialCut({ ...BASE_INPUT, target: '1:1', maxSec: 30 });

    expect(mockVideoAsset.create).toHaveBeenCalledTimes(1);
    const { data } = mockVideoAsset.create.mock.calls[0][0];

    expect(data.founderId).toBe('user-001');
    expect(data.status).toBe('pending');
    expect(data.duration).toBe(30);
    expect(data.title).toContain('1:1');

    const meta = data.metadata as Record<string, any>;
    expect(meta.source).toBe('deriveSocialCut');
    expect(meta.organizationId).toBe(ORG_ID);
    expect(meta.derivedFrom).toBe('hero-va-001');
    expect(meta.aspectRatio).toBe('1:1');
    expect(meta.derivation.crop.wPct).toBe(100);
    expect(meta.derivation.crop.hPct).toBeCloseTo(56.25, 2);
    expect(meta.derivation.trim).toEqual({
      fromSec: 0,
      toSec: 30,
      heroDurationKnown: true,
    });
    expect(meta.derivation.caption.text).toBe(BASE_INPUT.caption);
    expect(meta.derivation.caption.placement).toBe('upper');
  });

  it('encodes trim and crop into the cut URL as a media fragment', async () => {
    await deriveSocialCut({ ...BASE_INPUT, target: '1:1', maxSec: 15 });

    const { data } = mockVideoAsset.create.mock.calls[0][0];
    expect(data.url).toContain(HERO_VIDEO_ASSET.url);
    expect(data.url).toContain('#t=0,15');
    expect(data.url).toContain('xywh=percent:');
  });

  it('omits the crop fragment when no crop is needed', async () => {
    await deriveSocialCut(BASE_INPUT); // 9:16 hero → 9:16 target

    const { data } = mockVideoAsset.create.mock.calls[0][0];
    expect(data.url).toContain('#t=0,15');
    expect(data.url).not.toContain('xywh');
  });
});

// ── deriveSocialCut(): publish_queue enqueue ──────────────────────────────────

describe('deriveSocialCut() — publish_queue', () => {
  it('enqueues the cut as queued_human_gated against the latest org calendar', async () => {
    await deriveSocialCut(BASE_INPUT);

    expect(mockContentCalendar.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: ORG_ID }),
      })
    );
    expect(mockContentCalendar.create).not.toHaveBeenCalled();

    expect(mockPublishQueueItem.create).toHaveBeenCalledTimes(1);
    const { data } = mockPublishQueueItem.create.mock.calls[0][0];
    expect(data.organizationId).toBe(ORG_ID);
    expect(data.calendarId).toBe('cal-001');
    expect(data.slotId).toBe('social-cut:cut-001');
    expect(data.status).toBe('queued_human_gated');
    expect(data.platform).toBe('unassigned');
    expect(data.scheduledAt).toBeInstanceOf(Date);
  });

  it('passes a caller-supplied platform through to the queue row', async () => {
    await deriveSocialCut({ ...BASE_INPUT, platform: 'instagram' });

    const { data } = mockPublishQueueItem.create.mock.calls[0][0];
    expect(data.platform).toBe('instagram');
  });

  it('creates a draft anchor calendar when the org has none', async () => {
    mockContentCalendar.findFirst.mockResolvedValue(null);
    mockContentCalendar.create.mockResolvedValue({ id: 'cal-new' });

    await deriveSocialCut(BASE_INPUT);

    expect(mockContentCalendar.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG_ID,
          status: 'draft',
        }),
      })
    );
    const { data } = mockPublishQueueItem.create.mock.calls[0][0];
    expect(data.calendarId).toBe('cal-new');
  });

  it('creates the asset and the queue row inside one transaction', async () => {
    await deriveSocialCut(BASE_INPUT);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

// ── deriveSocialCut(): result contract ────────────────────────────────────────

describe('deriveSocialCut() — result', () => {
  it('returns the new asset id and subjectLost=false for a same-aspect cut', async () => {
    const result = await deriveSocialCut(BASE_INPUT);
    expect(result).toEqual({ assetId: 'cut-001', subjectLost: false });
  });

  it('reports subjectLost when the hero subject box does not survive the crop', async () => {
    mockVideoAsset.findUnique.mockResolvedValue({
      ...HERO_VIDEO_ASSET,
      metadata: {
        aspectRatio: '9:16',
        subjectBox: { xPct: 10, yPct: 5, wPct: 80, hPct: 90 },
      },
    });

    const result = await deriveSocialCut({ ...BASE_INPUT, target: '1:1' });
    expect(result.subjectLost).toBe(true);

    const { data } = mockVideoAsset.create.mock.calls[0][0];
    expect((data.metadata as Record<string, any>).derivation.subjectLost).toBe(
      true
    );
  });
});
