/**
 * Golden-transcript acceptance test — nexus-viral productionise WS3b
 * (SYN-1075, spec section 8(3) / section 15(3)).
 *
 * Proves the enforcer itself: a known-PASS and a known-FAIL QA row are
 * pre-seeded via a mocked prisma.marketingAgencyQaReport.findFirst — NO LLM
 * call is involved (that's WS3a's concern).
 *
 * DEFERRED WIRING NOTE: assertGatePassed is called DIRECTLY here, not via
 * deriveSocialCut(). Wiring it into the live derive path (lib/video/social-derivation.ts,
 * see the TODO comment there) is deferred pending Phill's QA-row schema
 * decision — MarketingAgencyQaReport has a required campaignId FK and no
 * asset/video-ref column (lib/video/gates/index.ts). Wiring it into the live
 * path overnight broke 13 tests in __tests__/api/video/derive-social-cut.test.ts
 * because those existing fixtures never seed a QA row, so the fail-closed
 * enforcer blocked the entire (unrelated) happy path. This test still proves
 * the full section 15(3) contract — a FAIL/missing QA row deterministically
 * blocks, a PASS row resolves — exactly what the future call-site will rely on.
 */

const mockQaReportFindFirst = jest.fn();
const mockCaptureServerException = jest.fn();
const mockIsSentryServerEnabled = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: { marketingAgencyQaReport: { findFirst: mockQaReportFindFirst } },
}));

jest.mock('@/lib/observability/sentry-server', () => ({
  captureServerException: mockCaptureServerException,
  isSentryServerEnabled: mockIsSentryServerEnabled,
}));

import { assertGatePassed } from '@/lib/video/gates/assert-gate-passed';
import { GateFailedError } from '@/lib/video/gates/types';

const HERO_ASSET_ID = 'hero-asset-1';

describe('golden-transcript: assertGatePassed (section 15(3))', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsSentryServerEnabled.mockReturnValue(true);
  });

  it('known-FAIL QA row -> assertGatePassed throws GateFailedError (would block release/derive)', async () => {
    mockQaReportFindFirst.mockResolvedValue({
      status: 'blocked',
      blockedReasons: ['caption mismatch with transcript', 'hook diluted in generation'],
    });

    await expect(assertGatePassed(HERO_ASSET_ID, 'broadcast')).rejects.toThrow(GateFailedError);

    try {
      await assertGatePassed(HERO_ASSET_ID, 'broadcast');
    } catch (err) {
      expect(err).toBeInstanceOf(GateFailedError);
      expect((err as GateFailedError).blockedReasons).toContain('caption mismatch with transcript');
    }
  });

  it('MISSING QA row (never judged) -> assertGatePassed fails closed', async () => {
    mockQaReportFindFirst.mockResolvedValue(null);

    await expect(assertGatePassed(HERO_ASSET_ID, 'broadcast')).rejects.toThrow(GateFailedError);
  });

  it('known-PASS QA row -> assertGatePassed resolves (would allow derive/release)', async () => {
    mockQaReportFindFirst.mockResolvedValue({ status: 'passed', blockedReasons: [] });

    await expect(assertGatePassed(HERO_ASSET_ID, 'broadcast')).resolves.toBeUndefined();
    expect(mockCaptureServerException).not.toHaveBeenCalled();
  });

  it('queries the latest report for the given assetRef + gate specifically', async () => {
    mockQaReportFindFirst.mockResolvedValue({ status: 'passed', blockedReasons: [] });

    await assertGatePassed(HERO_ASSET_ID, 'broadcast');

    expect(mockQaReportFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { metadata: { path: ['assetRef'], equals: HERO_ASSET_ID } },
            { metadata: { path: ['gate'], equals: 'broadcast' } },
          ]),
        }),
      })
    );
  });
});
