/**
 * Unit tests — content-scorer.ts — SYN-664 / P2 truth
 *
 * `content_score_history` has no Prisma model. The score itself is computed
 * from org-scoped Prisma reads; the week-over-week delta is reported as null
 * (unavailable) and saving throws ContentScoreHistoryNotProvisionedError
 * instead of dropping the write. The ledger is not written for an unsaved score.
 */

import prisma from '@/lib/prisma';
import {
  computeContentScore,
  saveContentScore,
  ContentScoreHistoryNotProvisionedError,
  type ComputedContentScore,
} from '@/lib/intelligence/content-scorer';
import { recordScoreIssued } from '@/lib/intelligence/accuracy-ledger';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    contentPerformanceProfile: { findUnique: jest.fn() },
    contentImprovementTracking: { findFirst: jest.fn() },
  },
}));

jest.mock('@/lib/intelligence/accuracy-ledger', () => ({
  recordScoreIssued: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const mockedPrisma = prisma as unknown as {
  contentPerformanceProfile: { findUnique: jest.Mock };
  contentImprovementTracking: { findFirst: jest.Mock };
};

function buildComputed(
  overrides: Partial<ComputedContentScore> = {}
): ComputedContentScore {
  return {
    organizationId: 'org-abc',
    weekStart: '2026-06-08',
    score: 72,
    delta: null,
    components: {
      data_availability: 32,
      engagement_lift: 28,
      volume_bonus: 12,
    },
    dataPoints: 18,
    ...overrides,
  };
}

describe('computeContentScore', () => {
  it('scopes both reads to the organisation and reports delta as unavailable', async () => {
    mockedPrisma.contentPerformanceProfile.findUnique.mockResolvedValue({
      confidenceLevel: 0.5,
      postCount: 50,
    });
    mockedPrisma.contentImprovementTracking.findFirst.mockResolvedValue({
      improvementRate: 0.1,
    });

    const weekStart = new Date('2026-06-08T00:00:00Z');
    const result = await computeContentScore('org-abc', weekStart);

    expect(
      mockedPrisma.contentPerformanceProfile.findUnique
    ).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-abc' } })
    );
    expect(
      mockedPrisma.contentImprovementTracking.findFirst
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-abc' }),
      })
    );
    // 20 (data) + 30 (lift) + 10 (volume)
    expect(result).toEqual(
      expect.objectContaining({
        organizationId: 'org-abc',
        score: 60,
        delta: null,
      })
    );
  });

  it('returns null when the org has no performance profile', async () => {
    mockedPrisma.contentPerformanceProfile.findUnique.mockResolvedValue(null);

    await expect(
      computeContentScore('org-none', new Date('2026-06-08T00:00:00Z'))
    ).resolves.toBeNull();
  });
});

describe('saveContentScore — not provisioned', () => {
  it('throws ContentScoreHistoryNotProvisionedError and skips the ledger', async () => {
    const err = await saveContentScore(buildComputed()).catch(e => e);

    expect(err).toBeInstanceOf(ContentScoreHistoryNotProvisionedError);
    expect(err).toMatchObject({
      code: 'FEATURE_NOT_PROVISIONED',
      table: 'content_score_history',
    });
    expect(recordScoreIssued).not.toHaveBeenCalled();
  });
});
