/**
 * Unit tests — effect-report/sections.ts buildProprietaryMetrics — P2 truth
 *
 * `client_geo_scores` has no Prisma model, so the GEO score is reported as
 * unavailable (null) while the health score still comes from an org-scoped
 * Prisma read.
 */

import { prisma } from '@/lib/prisma';
import { buildProprietaryMetrics } from '@/lib/effect-report/sections';

jest.mock('@/lib/ai/providers/anthropic-provider', () => ({
  AnthropicProvider: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: { clientHealthScore: { findMany: jest.fn() } },
}));

const findMany = (
  prisma as unknown as {
    clientHealthScore: { findMany: jest.Mock };
  }
).clientHealthScore.findMany;

describe('buildProprietaryMetrics', () => {
  it('scopes health scores to the org and reports GEO score as unavailable', async () => {
    findMany.mockResolvedValue([
      { overallScore: 70, weekStart: new Date('2026-09-28T00:00:00Z') },
      { overallScore: 60, weekStart: new Date('2026-03-01T00:00:00Z') },
    ]);

    const result = await buildProprietaryMetrics(
      'org-1',
      undefined,
      new Date('2026-07-01T00:00:00Z'),
      new Date('2026-09-30T23:59:59Z')
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-1' } })
    );
    expect(result.healthScore).toBe(70);
    expect(result.healthScoreQoQDelta).toBe(10);
    expect(result.geoScore).toBeNull();
    expect(result.geoScoreQoQDelta).toBeNull();
  });
});
