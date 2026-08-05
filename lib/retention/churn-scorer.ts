/**
 * Nightly churn risk scorer — SYN-618 / AT-023
 *
 * Derives churn probability from the latest ClientHealthScore per organisation
 * (verified marketing-health baseline). Heuristic probabilities are tagged
 * [hypothesis] per client-retention skill rule 5.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 */

import prisma from '@/lib/prisma';

export type ChurnRiskTier = 'low' | 'medium' | 'high' | 'critical';

export interface ChurnScore {
  organizationId: string;
  clientId: string | null;
  riskScore: number;
  riskTier: ChurnRiskTier;
  churnProbability30d: number;
  churnProbability90d: number;
  scoreSource: 'client_health_score' | 'insufficient_data';
  /** verified when sourced from ClientHealthScore; hypothesis for derived probabilities */
  verificationState: 'verified' | 'hypothesis';
}

export interface ChurnScoringResult {
  processed: number;
  scored: number;
  insufficientData: number;
  byTier: Record<ChurnRiskTier, number>;
  scores: ChurnScore[];
}

const EMPTY_TIER_COUNTS: Record<ChurnRiskTier, number> = {
  low: 0,
  medium: 0,
  high: 0,
  critical: 0,
};

/** Map ClientHealthScore risk levels to churn tiers. */
export function riskLevelToChurnTier(riskLevel: string | null): ChurnRiskTier {
  switch (riskLevel) {
    case 'critical':
      return 'critical';
    case 'at_risk':
      return 'high';
    case 'watch':
      return 'medium';
    case 'healthy':
      return 'low';
    default:
      return 'medium';
  }
}

/**
 * Heuristic churn probabilities from health score + week-over-week delta.
 * Outputs are [hypothesis] — not a trained model.
 */
export function deriveChurnProbabilities(
  overallScore: number,
  scoreDelta: number,
  riskLevel: string | null
): { churnProbability30d: number; churnProbability90d: number } {
  const baseByLevel: Record<string, { p30: number; p90: number }> = {
    critical: { p30: 0.45, p90: 0.7 },
    at_risk: { p30: 0.25, p90: 0.4 },
    watch: { p30: 0.1, p90: 0.2 },
    healthy: { p30: 0.05, p90: 0.1 },
  };

  const base = baseByLevel[riskLevel ?? 'watch'] ?? baseByLevel.watch;
  const declineBoost = scoreDelta < -10 ? 0.08 : scoreDelta < -5 ? 0.04 : 0;
  const scoreBoost = overallScore < 25 ? 0.05 : overallScore < 50 ? 0.02 : 0;

  const churnProbability30d = Math.min(
    0.95,
    Math.round((base.p30 + declineBoost + scoreBoost) * 1000) / 1000
  );
  const churnProbability90d = Math.min(
    0.99,
    Math.round((base.p90 + declineBoost + scoreBoost) * 1000) / 1000
  );

  return { churnProbability30d, churnProbability90d };
}

/** Higher risk score = higher churn likelihood (inverse of marketing health). */
export function computeRiskScore(
  overallScore: number,
  scoreDelta: number
): number {
  const inverse = Math.max(0, Math.min(100, 100 - overallScore));
  const declinePenalty =
    scoreDelta < 0 ? Math.min(20, Math.abs(scoreDelta)) : 0;
  return Math.max(0, Math.min(100, Math.round(inverse + declinePenalty)));
}

function latestScoreByOrg(
  rows: Array<{
    organizationId: string;
    clientId: string | null;
    overallScore: number;
    scoreDelta: number;
    riskLevel: string | null;
    weekStart: Date;
  }>
): Map<
  string,
  {
    organizationId: string;
    clientId: string | null;
    overallScore: number;
    scoreDelta: number;
    riskLevel: string | null;
  }
> {
  const map = new Map<
    string,
    {
      organizationId: string;
      clientId: string | null;
      overallScore: number;
      scoreDelta: number;
      riskLevel: string | null;
      weekStart: Date;
    }
  >();

  for (const row of rows) {
    const existing = map.get(row.organizationId);
    if (!existing || row.weekStart > existing.weekStart) {
      map.set(row.organizationId, row);
    }
  }

  return new Map(
    [...map.entries()].map(([orgId, row]) => [
      orgId,
      {
        organizationId: row.organizationId,
        clientId: row.clientId,
        overallScore: row.overallScore,
        scoreDelta: row.scoreDelta,
        riskLevel: row.riskLevel,
      },
    ])
  );
}

/**
 * Score churn risk for active organisations using the latest ClientHealthScore.
 */
export async function runChurnScoring(
  scope: 'all_organizations' | string = 'all_organizations'
): Promise<ChurnScoringResult> {
  const orgWhere =
    scope === 'all_organizations'
      ? { status: 'active' as const, plan: { not: 'free' as const } }
      : { id: scope, status: 'active' as const };

  const orgs = await prisma.organization.findMany({
    where: orgWhere,
    select: { id: true },
  });

  if (orgs.length === 0) {
    return {
      processed: 0,
      scored: 0,
      insufficientData: 0,
      byTier: { ...EMPTY_TIER_COUNTS },
      scores: [],
    };
  }

  const orgIds = orgs.map(o => o.id);
  const healthRows = await prisma.clientHealthScore.findMany({
    where: { organizationId: { in: orgIds } },
    select: {
      organizationId: true,
      clientId: true,
      overallScore: true,
      scoreDelta: true,
      riskLevel: true,
      weekStart: true,
    },
    orderBy: { weekStart: 'desc' },
  });

  const latestByOrg = latestScoreByOrg(healthRows);
  const scores: ChurnScore[] = [];
  const byTier = { ...EMPTY_TIER_COUNTS };
  let scored = 0;
  let insufficientData = 0;

  for (const org of orgs) {
    const latest = latestByOrg.get(org.id);

    if (!latest || latest.riskLevel == null) {
      insufficientData++;
      const tier: ChurnRiskTier = 'medium';
      byTier[tier]++;
      scores.push({
        organizationId: org.id,
        clientId: latest?.clientId ?? null,
        riskScore: 50,
        riskTier: tier,
        churnProbability30d: 0.15,
        churnProbability90d: 0.25,
        scoreSource: 'insufficient_data',
        verificationState: 'hypothesis',
      });
      continue;
    }

    scored++;
    const riskTier = riskLevelToChurnTier(latest.riskLevel);
    const { churnProbability30d, churnProbability90d } =
      deriveChurnProbabilities(
        latest.overallScore,
        latest.scoreDelta,
        latest.riskLevel
      );

    byTier[riskTier]++;

    scores.push({
      organizationId: org.id,
      clientId: latest.clientId,
      riskScore: computeRiskScore(latest.overallScore, latest.scoreDelta),
      riskTier,
      churnProbability30d,
      churnProbability90d,
      scoreSource: 'client_health_score',
      verificationState: 'hypothesis',
    });
  }

  return {
    processed: orgs.length,
    scored,
    insufficientData,
    byTier,
    scores,
  };
}
