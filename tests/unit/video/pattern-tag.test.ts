/**
 * Pattern tag (Build Spec R1, R6) — lib/video/social-derivation.ts +
 * lib/publish/socialCutSource.ts
 *
 * Every social cut records the pattern it was made with (metadata.pattern) so a
 * published post's metrics can be read against it. A hero with no method card
 * is 'unknown' — recorded, never refused. An upright cut of <=180s is a Short;
 * a YouTube Short carries #Shorts in its title.
 *
 * Mock strategy mirrors __tests__/api/video/derive-social-cut.test.ts: mocked
 * prisma with a $transaction pass-through, the REAL Gate B check against a
 * mocked passing verdict.
 */

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

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: mockPrisma,
  default: mockPrisma,
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('@/lib/observability/sentry-server', () => ({
  captureServerException: jest.fn(),
  isSentryServerEnabled: jest.fn().mockReturnValue(false),
}));

import {
  buildCutPattern,
  deriveSocialCut,
  lengthBandFor,
  withShortsTag,
  type DeriveSocialCutInput,
} from '@/lib/video/social-derivation';
import {
  readSocialCutPattern,
  resolveSocialCutSource,
  UNKNOWN_SOCIAL_CUT_PATTERN,
} from '@/lib/publish/socialCutSource';

const ORG_ID = 'org-001';

const HERO_VIDEO_ASSET = {
  id: 'hero-va-001',
  founderId: 'user-001',
  title: 'Water damage myth',
  url: 'https://storage.synthex.social/video/hero-va-001.mp4',
  thumbnail: null,
  duration: 42,
  status: 'ready',
  metadata: { aspectRatio: '9:16' },
  founder: { organizationId: ORG_ID },
};

const HERO_GENERATION = {
  id: 'hero-gen-001',
  userId: 'user-002',
  organizationId: ORG_ID,
  title: 'Flood drying in 4 hours',
  videoUrl: 'https://fal.media/files/hero-gen-001.mp4',
  thumbnailUrl: null,
  aspectRatio: '9:16',
  durationSeconds: 30,
  methodCardId: 'retention-3beat',
  metadata: null,
};

const BASE_INPUT: DeriveSocialCutInput = {
  orgId: ORG_ID,
  heroAssetId: 'hero-va-001',
  target: '9:16',
  maxSec: 60,
  captionPlacement: 'upper',
  caption: 'We dried a flooded office in 4 hours',
  trimFrom: 'tail',
  keepSubjectCentre: true,
};

function writtenMetadata(): Record<string, any> {
  return mockVideoAsset.create.mock.calls[0][0].data.metadata;
}

beforeEach(() => {
  jest.clearAllMocks();
  (mockPrisma as any).$transaction = jest.fn(
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
  mockPublishQueueItem.create.mockResolvedValue({ id: 'pq-001' });
});

describe('lengthBandFor()', () => {
  it('bands by the upper edge, inclusive', () => {
    expect(lengthBandFor(15)).toBe('0-15');
    expect(lengthBandFor(15.5)).toBe('15-30');
    expect(lengthBandFor(60)).toBe('30-60');
    expect(lengthBandFor(180)).toBe('90-180');
    expect(lengthBandFor(181)).toBe('180+');
  });
});

describe('withShortsTag()', () => {
  it('appends #Shorts once', () => {
    expect(withShortsTag('Dry in 4 hours')).toBe('Dry in 4 hours #Shorts');
    expect(withShortsTag('Dry in 4 hours #shorts')).toBe(
      'Dry in 4 hours #shorts'
    );
  });

  it('keeps a full-length title within 100 characters', () => {
    const tagged = withShortsTag('x'.repeat(100));
    expect(tagged.length).toBeLessThanOrEqual(100);
    expect(tagged.endsWith(' #Shorts')).toBe(true);
  });
});

describe('buildCutPattern()', () => {
  it('is a Short only when upright and 180 s or less', () => {
    const base = { methodCardId: 'viral-hero-short', platform: 'youtube' };
    expect(
      buildCutPattern({ ...base, target: '9:16', durationSec: 180 }).format
    ).toBe('short');
    expect(
      buildCutPattern({ ...base, target: '9:16', durationSec: 181 }).format
    ).toBe('long');
    expect(
      buildCutPattern({ ...base, target: '16:9', durationSec: 30 }).format
    ).toBe('long');
  });

  it('marks a cut with no method card as unknown', () => {
    const pattern = buildCutPattern({
      methodCardId: null,
      target: '1:1',
      durationSec: 20,
      platform: undefined,
    });
    expect(pattern).toMatchObject({
      source: 'unknown',
      methodCardId: null,
      platform: null,
    });
  });
});

describe('deriveSocialCut() stamps metadata.pattern', () => {
  it('records the method card of a videoGeneration hero, titled as a Short for YouTube', async () => {
    mockVideoAsset.findUnique.mockResolvedValueOnce(null);
    mockVideoGeneration.findFirst.mockResolvedValue(HERO_GENERATION);

    await deriveSocialCut({
      ...BASE_INPUT,
      heroAssetId: 'hero-gen-001',
      platform: 'youtube',
    });

    const meta = writtenMetadata();
    expect(meta.pattern).toEqual({
      source: 'method-card',
      methodCardId: 'retention-3beat',
      libraryPatternId: null,
      lengthBandSec: '15-30',
      aspect: '9:16',
      platform: 'youtube',
      format: 'short',
    });
    expect(meta.youtube.title).toBe(
      'We dried a flooded office in 4 hours #Shorts'
    );
  });

  it('records unknown for a video_asset hero with no method card (and still derives)', async () => {
    const result = await deriveSocialCut({
      ...BASE_INPUT,
      platform: 'instagram',
    });

    expect(result.assetId).toBe('cut-001');
    expect(writtenMetadata().pattern).toMatchObject({
      source: 'unknown',
      methodCardId: null,
      lengthBandSec: '30-60',
      platform: 'instagram',
    });
  });

  it('leaves a 16:9 YouTube cut as long-form, with no #Shorts', async () => {
    await deriveSocialCut({
      ...BASE_INPUT,
      target: '16:9',
      platform: 'youtube',
    });

    const meta = writtenMetadata();
    expect(meta.pattern.format).toBe('long');
    expect(meta.youtube.title).toBe('We dried a flooded office in 4 hours');
  });
});

describe('readSocialCutPattern()', () => {
  it('reads absent or malformed input as unknown', () => {
    for (const value of [
      null,
      undefined,
      'x',
      [],
      {},
      { source: 'method-card' },
      { source: 'method-card', methodCardId: '' },
      { source: 'other', methodCardId: 'viral-hero-short' },
    ]) {
      expect(readSocialCutPattern(value)).toEqual(UNKNOWN_SOCIAL_CUT_PATTERN);
    }
  });

  it('drops an invalid format but keeps a valid card', () => {
    expect(
      readSocialCutPattern({
        source: 'method-card',
        methodCardId: 'viral-hero-short',
        format: 'vertical',
      })
    ).toMatchObject({ methodCardId: 'viral-hero-short', format: null });
  });
});

describe('resolveSocialCutSource() returns the stored pattern', () => {
  it('round-trips what deriveSocialCut wrote', async () => {
    mockVideoAsset.findUnique.mockResolvedValueOnce(null);
    mockVideoGeneration.findFirst.mockResolvedValue(HERO_GENERATION);
    await deriveSocialCut({
      ...BASE_INPUT,
      heroAssetId: 'hero-gen-001',
      platform: 'youtube',
    });
    const { data } = mockVideoAsset.create.mock.calls[0][0];

    mockVideoAsset.findUnique.mockResolvedValue({
      url: data.url,
      thumbnail: data.thumbnail,
      metadata: data.metadata,
    });
    const source = await resolveSocialCutSource('social-cut:cut-001', ORG_ID);

    expect(source?.pattern).toEqual(data.metadata.pattern);
    expect(source?.pattern.methodCardId).toBe('retention-3beat');
  });
});
