/**
 * Golden-transcript acceptance test — nexus-viral productionise WS3b
 * (SYN-1075, spec section 8(3) / section 15(3)).
 *
 * Proves the enforcer itself: a known-PASS and a known-FAIL verdict row are
 * pre-seeded via a mocked prisma.videoGateVerdict.findFirst — NO LLM call is
 * involved (that's WS3a's concern).
 *
 * WIRING NOTE: assertGatePassed is now wired into the live derive path
 * (lib/video/social-derivation.ts, SYN-1094) — deriveSocialCut() calls it
 * fail-closed before writing any row (covered by
 * __tests__/api/video/derive-social-cut.test.ts). This test proves the
 * enforcer contract in isolation: a FAIL/missing verdict row deterministically
 * blocks, a PASS row resolves.
 */

const mockVerdictFindFirst = jest.fn();
const mockCaptureServerException = jest.fn();
const mockIsSentryServerEnabled = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: { videoGateVerdict: { findFirst: mockVerdictFindFirst } },
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
    mockVerdictFindFirst.mockResolvedValue({
      status: 'blocked',
      blockedReasons: [
        'caption mismatch with transcript',
        'hook diluted in generation',
      ],
    });

    await expect(assertGatePassed(HERO_ASSET_ID, 'broadcast')).rejects.toThrow(
      GateFailedError
    );

    try {
      await assertGatePassed(HERO_ASSET_ID, 'broadcast');
    } catch (err) {
      expect(err).toBeInstanceOf(GateFailedError);
      expect((err as GateFailedError).blockedReasons).toContain(
        'caption mismatch with transcript'
      );
    }
  });

  it('MISSING QA row (never judged) -> assertGatePassed fails closed', async () => {
    mockVerdictFindFirst.mockResolvedValue(null);

    await expect(assertGatePassed(HERO_ASSET_ID, 'broadcast')).rejects.toThrow(
      GateFailedError
    );
  });

  it('known-PASS QA row -> assertGatePassed resolves (would allow derive/release)', async () => {
    mockVerdictFindFirst.mockResolvedValue({
      status: 'passed',
      blockedReasons: [],
    });

    await expect(
      assertGatePassed(HERO_ASSET_ID, 'broadcast')
    ).resolves.toBeUndefined();
    expect(mockCaptureServerException).not.toHaveBeenCalled();
  });

  it('queries the latest verdict for the given ref + gate specifically', async () => {
    mockVerdictFindFirst.mockResolvedValue({
      status: 'passed',
      blockedReasons: [],
    });

    await assertGatePassed(HERO_ASSET_ID, 'broadcast');

    expect(mockVerdictFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ref: HERO_ASSET_ID, gate: 'broadcast' },
        orderBy: { createdAt: 'desc' },
      })
    );
  });
});
