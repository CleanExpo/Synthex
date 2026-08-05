/**
 * Unit tests for lib/retention/churn-scorer — AT-023 wiring.
 */

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    organization: { findMany: jest.fn() },
    clientHealthScore: { findMany: jest.fn() },
  },
}));

import {
  computeRiskScore,
  deriveChurnProbabilities,
  riskLevelToChurnTier,
  runChurnScoring,
} from '@/lib/retention/churn-scorer';
import prisma from '@/lib/prisma';

const prismaMock = prisma as unknown as {
  organization: { findMany: jest.Mock };
  clientHealthScore: { findMany: jest.Mock };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('riskLevelToChurnTier', () => {
  it('maps ClientHealthScore risk levels to churn tiers', () => {
    expect(riskLevelToChurnTier('healthy')).toBe('low');
    expect(riskLevelToChurnTier('watch')).toBe('medium');
    expect(riskLevelToChurnTier('at_risk')).toBe('high');
    expect(riskLevelToChurnTier('critical')).toBe('critical');
    expect(riskLevelToChurnTier(null)).toBe('medium');
  });
});

describe('deriveChurnProbabilities', () => {
  it('returns higher probabilities for critical clients', () => {
    const critical = deriveChurnProbabilities(20, -12, 'critical');
    const healthy = deriveChurnProbabilities(85, 2, 'healthy');
    expect(critical.churnProbability30d).toBeGreaterThan(
      healthy.churnProbability30d
    );
    expect(critical.churnProbability90d).toBeGreaterThan(
      healthy.churnProbability90d
    );
  });

  it('boosts probability when score is declining', () => {
    const declining = deriveChurnProbabilities(55, -12, 'watch');
    const stable = deriveChurnProbabilities(55, 0, 'watch');
    expect(declining.churnProbability30d).toBeGreaterThan(
      stable.churnProbability30d
    );
  });
});

describe('computeRiskScore', () => {
  it('increases risk when health score drops and delta is negative', () => {
    expect(computeRiskScore(80, 0)).toBeLessThan(computeRiskScore(30, -10));
  });
});

describe('runChurnScoring', () => {
  it('scores organisations from latest ClientHealthScore rows', async () => {
    prismaMock.organization.findMany.mockResolvedValue([
      { id: 'org-healthy' },
      { id: 'org-critical' },
      { id: 'org-missing' },
    ]);
    prismaMock.clientHealthScore.findMany.mockResolvedValue([
      {
        organizationId: 'org-healthy',
        clientId: 'client-a',
        overallScore: 82,
        scoreDelta: 3,
        riskLevel: 'healthy',
        weekStart: new Date('2026-08-04'),
      },
      {
        organizationId: 'org-critical',
        clientId: 'client-b',
        overallScore: 18,
        scoreDelta: -8,
        riskLevel: 'critical',
        weekStart: new Date('2026-08-04'),
      },
      {
        organizationId: 'org-healthy',
        clientId: 'client-a',
        overallScore: 70,
        scoreDelta: -2,
        riskLevel: 'watch',
        weekStart: new Date('2026-07-28'),
      },
    ]);

    const result = await runChurnScoring('all_organizations');

    expect(result.processed).toBe(3);
    expect(result.scored).toBe(2);
    expect(result.insufficientData).toBe(1);
    expect(result.byTier.low).toBe(1);
    expect(result.byTier.critical).toBe(1);
    expect(result.byTier.medium).toBe(1);

    const healthy = result.scores.find(s => s.organizationId === 'org-healthy');
    const critical = result.scores.find(
      s => s.organizationId === 'org-critical'
    );
    const missing = result.scores.find(s => s.organizationId === 'org-missing');

    expect(healthy?.scoreSource).toBe('client_health_score');
    expect(healthy?.riskTier).toBe('low');
    expect(critical?.riskTier).toBe('critical');
    expect(missing?.scoreSource).toBe('insufficient_data');
  });

  it('returns empty result when no active organisations match scope', async () => {
    prismaMock.organization.findMany.mockResolvedValue([]);

    const result = await runChurnScoring('org-unknown');

    expect(result.processed).toBe(0);
    expect(result.scores).toEqual([]);
    expect(prismaMock.clientHealthScore.findMany).not.toHaveBeenCalled();
  });
});
