import { prisma } from '@/lib/prisma';

interface MarketingAgencyOpportunityReaderClient {
  marketingAgencyOpportunity: {
    findMany: (args: unknown) => Promise<unknown[]>;
  };
}

interface PersistedOpportunitySignal {
  externalId: string;
  sourceKind: string;
  sourceLabel: string;
  capturedAt: Date;
  scoreTotal: number;
  riskState: string;
}

interface PersistedOpportunityRecord {
  id: string;
  externalId: string;
  title: string;
  recommendation: string;
  score: number;
  confidence: number;
  risk: number;
  status: string;
  approvalStatus: string;
  blockedReasons: unknown;
  warnings: unknown;
  evidenceRefs: unknown;
  nextAction: string;
  outcomeMetric: string;
  createdAt: Date;
  signal: PersistedOpportunitySignal;
}

export interface MarketingAgencyOpportunitySummary {
  id: string;
  externalId: string;
  title: string;
  recommendation: string;
  score: number;
  confidence: number;
  risk: number;
  status: string;
  approvalStatus: string;
  blockedReasons: string[];
  warnings: string[];
  evidenceRefs: string[];
  nextAction: string;
  outcomeMetric: string;
  createdAt: string;
  signal: {
    externalId: string;
    sourceKind: string;
    sourceLabel: string;
    capturedAt: string;
    scoreTotal: number;
    riskState: string;
  };
}

export interface ListMarketingAgencyOpportunitiesInput {
  organizationId: string;
  limit?: number;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function mapOpportunity(
  opportunity: PersistedOpportunityRecord
): MarketingAgencyOpportunitySummary {
  return {
    id: opportunity.id,
    externalId: opportunity.externalId,
    title: opportunity.title,
    recommendation: opportunity.recommendation,
    score: opportunity.score,
    confidence: opportunity.confidence,
    risk: opportunity.risk,
    status: opportunity.status,
    approvalStatus: opportunity.approvalStatus,
    blockedReasons: stringArray(opportunity.blockedReasons),
    warnings: stringArray(opportunity.warnings),
    evidenceRefs: stringArray(opportunity.evidenceRefs),
    nextAction: opportunity.nextAction,
    outcomeMetric: opportunity.outcomeMetric,
    createdAt: opportunity.createdAt.toISOString(),
    signal: {
      externalId: opportunity.signal.externalId,
      sourceKind: opportunity.signal.sourceKind,
      sourceLabel: opportunity.signal.sourceLabel,
      capturedAt: opportunity.signal.capturedAt.toISOString(),
      scoreTotal: opportunity.signal.scoreTotal,
      riskState: opportunity.signal.riskState,
    },
  };
}

export async function listMarketingAgencyOpportunities(
  input: ListMarketingAgencyOpportunitiesInput,
  client: MarketingAgencyOpportunityReaderClient =
    prisma as unknown as MarketingAgencyOpportunityReaderClient
): Promise<MarketingAgencyOpportunitySummary[]> {
  const take = Math.min(Math.max(input.limit ?? 10, 1), 25);
  const rows = (await client.marketingAgencyOpportunity.findMany({
    where: { organizationId: input.organizationId },
    take,
    orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      externalId: true,
      title: true,
      recommendation: true,
      score: true,
      confidence: true,
      risk: true,
      status: true,
      approvalStatus: true,
      blockedReasons: true,
      warnings: true,
      evidenceRefs: true,
      nextAction: true,
      outcomeMetric: true,
      createdAt: true,
      signal: {
        select: {
          externalId: true,
          sourceKind: true,
          sourceLabel: true,
          capturedAt: true,
          scoreTotal: true,
          riskState: true,
        },
      },
    },
  })) as PersistedOpportunityRecord[];

  return rows.map(mapOpportunity);
}
