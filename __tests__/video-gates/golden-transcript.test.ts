/**
 * Golden-transcript acceptance test — nexus-viral productionise WS3b
 * (SYN-1075, spec section 8(3) / section 15(3)).
 *
 * Proves the enforcer, not the producer: a known-PASS and a known-FAIL QA
 * row are pre-seeded via a mocked prisma.marketingAgencyQaReport.findFirst —
 * NO LLM call is involved (that's WS3a's concern). This test asserts that
 * assertGatePassed() gates the REAL deriveSocialCut() derive path:
 *
 *  (a) FAIL/missing QA row -> deriveSocialCut aborts BEFORE any write —
 *      no video_assets row, no publish_queue row is created.
 *  (b) PASS QA row -> deriveSocialCut behaves exactly as before this
 *      workstream (unchanged happy path).
 */

const mockVideoAssetFindUnique = jest.fn();
const mockVideoGenerationFindFirst = jest.fn();
const mockContentCalendarFindFirst = jest.fn();
const mockContentCalendarCreate = jest.fn();
const mockTransaction = jest.fn();
const mockVideoAssetCreateInTx = jest.fn();
const mockPublishQueueItemCreateInTx = jest.fn();
const mockQaReportFindFirst = jest.fn();
const mockCaptureServerException = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    videoAsset: { findUnique: mockVideoAssetFindUnique },
    videoGeneration: { findFirst: mockVideoGenerationFindFirst },
    contentCalendar: {
      findFirst: mockContentCalendarFindFirst,
      create: mockContentCalendarCreate,
    },
    marketingAgencyQaReport: { findFirst: mockQaReportFindFirst },
    $transaction: mockTransaction,
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('@/lib/observability/sentry-server', () => ({
  captureServerException: mockCaptureServerException,
  isSentryServerEnabled: jest.fn(() => false),
}));

import { deriveSocialCut } from '@/lib/video/social-derivation';
import { GateFailedError } from '@/lib/video/gates/types';

const HERO_ASSET = {
  id: 'hero-asset-1',
  founderId: 'founder-1',
  title: 'Golden Hero',
  url: 'https://cdn.example.com/hero.mp4',
  thumbnail: 'https://cdn.example.com/hero.jpg',
  duration: 30,
  status: 'ready',
  metadata: { aspectRatio: '16:9' },
  founder: { organizationId: 'org-golden' },
};

const DERIVE_INPUT = {
  orgId: 'org-golden',
  heroAssetId: 'hero-asset-1',
  target: '9:16' as const,
  maxSec: 15,
  captionPlacement: 'upper' as const,
  caption: 'Golden transcript caption',
  trimFrom: 'tail' as const,
  keepSubjectCentre: true,
};

describe('golden-transcript: assertGatePassed gates deriveSocialCut', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVideoAssetFindUnique.mockResolvedValue(HERO_ASSET);
    mockContentCalendarFindFirst.mockResolvedValue({ id: 'calendar-1' });

    mockTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
      const tx = {
        videoAsset: { create: mockVideoAssetCreateInTx },
        publishQueueItem: { create: mockPublishQueueItemCreateInTx },
      };
      return cb(tx);
    });
    mockVideoAssetCreateInTx.mockResolvedValue({ id: 'cut-asset-1' });
    mockPublishQueueItemCreateInTx.mockResolvedValue({ id: 'queue-1' });
  });

  it('known-FAIL QA row -> deriveSocialCut aborts, NO video_assets/publish_queue row created', async () => {
    mockQaReportFindFirst.mockResolvedValue({
      status: 'blocked',
      blockedReasons: ['caption mismatch with transcript', 'hook diluted in generation'],
    });

    await expect(deriveSocialCut(DERIVE_INPUT)).rejects.toThrow(GateFailedError);

    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockVideoAssetCreateInTx).not.toHaveBeenCalled();
    expect(mockPublishQueueItemCreateInTx).not.toHaveBeenCalled();
  });

  it('MISSING QA row (never judged) -> deriveSocialCut fails closed, no writes', async () => {
    mockQaReportFindFirst.mockResolvedValue(null);

    await expect(deriveSocialCut(DERIVE_INPUT)).rejects.toThrow(GateFailedError);

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('known-PASS QA row -> deriveSocialCut proceeds and creates the cut + queue row (unchanged happy path)', async () => {
    mockQaReportFindFirst.mockResolvedValue({ status: 'passed', blockedReasons: [] });

    const result = await deriveSocialCut(DERIVE_INPUT);

    expect(result.assetId).toBe('cut-asset-1');
    expect(mockVideoAssetCreateInTx).toHaveBeenCalledTimes(1);
    expect(mockPublishQueueItemCreateInTx).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'queued_human_gated' }),
      })
    );
  });

  it('assertGatePassed is queried for the "broadcast" gate specifically', async () => {
    mockQaReportFindFirst.mockResolvedValue({ status: 'passed', blockedReasons: [] });

    await deriveSocialCut(DERIVE_INPUT);

    expect(mockQaReportFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { metadata: { path: ['assetRef'], equals: 'hero-asset-1' } },
            { metadata: { path: ['gate'], equals: 'broadcast' } },
          ]),
        }),
      })
    );
  });
});
