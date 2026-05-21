import { prisma } from '@/lib/prisma';
import type { GovernedOpportunity, RankedSignal } from './signal-ledger';

interface PersistenceDelegate {
  create?: (args: unknown) => Promise<unknown>;
  findUnique?: (args: unknown) => Promise<unknown>;
  upsert: (args: unknown) => Promise<unknown>;
}

interface SignalPersistenceClient {
  marketingAgencySignal: PersistenceDelegate;
  marketingAgencyOpportunity: PersistenceDelegate;
  marketingAgencyOutcomeEvent: PersistenceDelegate;
  $transaction: <T>(callback: (tx: SignalPersistenceClient) => Promise<T>) => Promise<T>;
}

interface PersistedSignalRecord {
  id: string;
  externalId: string;
  campaignId?: string | null;
}

interface PersistedOpportunityRecord {
  id: string;
  externalId: string;
  signalId: string;
}

export interface PersistGovernedSignalRunInput {
  organizationId: string;
  campaignId?: string;
  rankedSignals: RankedSignal[];
  opportunities: GovernedOpportunity[];
  metadata?: Record<string, unknown>;
}

export interface PersistGovernedSignalRunResult {
  signalsPersisted: number;
  opportunitiesPersisted: number;
}

export interface RecordMarketingAgencyOutcomeInput {
  organizationId: string;
  signalExternalId: string;
  opportunityExternalId?: string;
  campaignId?: string;
  eventType: string;
  status?: string;
  outcomeMetric?: string;
  observedValue?: string;
  confidence?: number;
  notes?: string;
  metadata?: Record<string, unknown>;
  recordedAt?: Date;
}

function toCapturedDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid governed signal capturedAt timestamp: ${value}`);
  }

  return date;
}

function campaignPatch(campaignId?: string): { campaignId: string } | Record<string, never> {
  return campaignId ? { campaignId } : {};
}

function signalData(
  organizationId: string,
  ranked: RankedSignal,
  campaignId?: string,
  metadata?: Record<string, unknown>
) {
  const { signal, score, riskState, approvalGate } = ranked;

  return {
    organizationId,
    ...campaignPatch(campaignId),
    externalId: signal.id,
    sourceId: signal.source.id,
    sourceKind: signal.source.kind,
    sourceLabel: signal.source.label,
    sourceUrl: signal.source.sourceUrl,
    sourcePath: signal.source.sourcePath,
    permissionContext: signal.source.permissionContext,
    capturedAt: toCapturedDate(signal.capturedAt),
    business: signal.business,
    client: signal.client,
    product: signal.product,
    audienceSegment: signal.audienceSegment,
    narrative: signal.narrative,
    content: signal.content,
    freshness: score.freshness,
    confidence: score.confidence,
    commercialImpact: score.commercialImpact,
    creativePotential: score.creativePotential,
    risk: score.risk,
    scoreTotal: score.total,
    status: signal.status,
    riskState: riskState.state,
    riskReasons: riskState.reasons,
    approvalStatus: approvalGate.status,
    blockedReasons: approvalGate.blockedReasons,
    warnings: approvalGate.warnings,
    evidenceRefs: signal.evidenceRefs,
    rawSignal: signal,
    metadata,
  };
}

function opportunityData(
  organizationId: string,
  opportunity: GovernedOpportunity,
  signalId: string,
  campaignId?: string,
  metadata?: Record<string, unknown>
) {
  return {
    organizationId,
    ...campaignPatch(campaignId),
    signalId,
    externalId: opportunity.id,
    title: opportunity.title,
    recommendation: opportunity.recommendation,
    score: opportunity.score,
    confidence: opportunity.confidence,
    risk: opportunity.risk,
    status: opportunity.approvalGate.status === 'blocked' ? 'blocked' : 'draft',
    approvalStatus: opportunity.approvalGate.status,
    blockedReasons: opportunity.approvalGate.blockedReasons,
    warnings: opportunity.approvalGate.warnings,
    evidenceRefs: opportunity.evidenceRefs,
    nextAction: opportunity.nextAction,
    outcomeMetric: opportunity.outcomeMetric,
    rawOpportunity: opportunity,
    metadata,
  };
}

export async function persistGovernedSignalRun(
  input: PersistGovernedSignalRunInput,
  client: SignalPersistenceClient = prisma as unknown as SignalPersistenceClient
): Promise<PersistGovernedSignalRunResult> {
  return client.$transaction(async tx => {
    const signalIdsByExternalId = new Map<string, string>();

    for (const ranked of input.rankedSignals) {
      const data = signalData(
        input.organizationId,
        ranked,
        input.campaignId,
        input.metadata
      );
      const record = (await tx.marketingAgencySignal.upsert({
        where: {
          organizationId_externalId: {
            organizationId: input.organizationId,
            externalId: ranked.signal.id,
          },
        },
        create: data,
        update: data,
      })) as PersistedSignalRecord;

      signalIdsByExternalId.set(record.externalId, record.id);
    }

    let opportunitiesPersisted = 0;

    for (const opportunity of input.opportunities) {
      const signalId = signalIdsByExternalId.get(opportunity.signalId);
      if (!signalId) continue;

      const data = opportunityData(
        input.organizationId,
        opportunity,
        signalId,
        input.campaignId,
        input.metadata
      );

      await tx.marketingAgencyOpportunity.upsert({
        where: {
          organizationId_externalId: {
            organizationId: input.organizationId,
            externalId: opportunity.id,
          },
        },
        create: data,
        update: data,
      });
      opportunitiesPersisted++;
    }

    return {
      signalsPersisted: signalIdsByExternalId.size,
      opportunitiesPersisted,
    };
  });
}

export async function recordMarketingAgencyOutcome(
  input: RecordMarketingAgencyOutcomeInput,
  client: SignalPersistenceClient = prisma as unknown as SignalPersistenceClient
): Promise<unknown> {
  return client.$transaction(async tx => {
    if (!tx.marketingAgencySignal.findUnique || !tx.marketingAgencyOutcomeEvent.create) {
      throw new Error('Signal persistence client does not support outcome recording.');
    }

    const signal = (await tx.marketingAgencySignal.findUnique({
      where: {
        organizationId_externalId: {
          organizationId: input.organizationId,
          externalId: input.signalExternalId,
        },
      },
      select: { id: true, campaignId: true },
    })) as PersistedSignalRecord | null;

    if (!signal) {
      throw new Error(`Cannot record outcome for missing signal ${input.signalExternalId}.`);
    }

    let opportunity: PersistedOpportunityRecord | null = null;
    if (input.opportunityExternalId) {
      if (!tx.marketingAgencyOpportunity.findUnique) {
        throw new Error('Signal persistence client does not support opportunity lookup.');
      }

      opportunity = (await tx.marketingAgencyOpportunity.findUnique({
        where: {
          organizationId_externalId: {
            organizationId: input.organizationId,
            externalId: input.opportunityExternalId,
          },
        },
        select: { id: true, externalId: true, signalId: true },
      })) as PersistedOpportunityRecord | null;

      if (!opportunity) {
        throw new Error(
          `Cannot record outcome for missing opportunity ${input.opportunityExternalId}.`
        );
      }

      if (opportunity.signalId !== signal.id) {
        throw new Error(
          `Cannot record outcome for opportunity ${input.opportunityExternalId} linked to a different signal.`
        );
      }
    }

    return tx.marketingAgencyOutcomeEvent.create({
      data: {
        organizationId: input.organizationId,
        campaignId: input.campaignId ?? signal.campaignId ?? undefined,
        signalId: signal.id,
        opportunityId: opportunity?.id,
        eventType: input.eventType,
        status: input.status ?? 'observed',
        outcomeMetric: input.outcomeMetric,
        observedValue: input.observedValue,
        confidence: input.confidence,
        notes: input.notes,
        metadata: input.metadata,
        recordedAt: input.recordedAt,
      },
    });
  });
}
