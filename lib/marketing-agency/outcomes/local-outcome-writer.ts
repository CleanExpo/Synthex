/**
 * Single writer for local-presence outcomes (calls, bookings, directions,
 * reviews, rank and listing drift). Every P6 entry point calls this; the
 * location travels in outcome metadata (no schema change).
 *
 * organizationId is the caller's verified org — never derived from payload here.
 * Dedupe: one signal per captured event, namespaced by kind, source and
 * location so provider event ids cannot collide; at most one outcome per
 * (org, signal, eventType). The check and the create run in one transaction
 * with the signal row locked, so concurrent replays serialise. (A unique index
 * on the outcome table is a founder-gated schema follow-up.)
 */
import { prisma } from '@/lib/prisma';
import { recordMarketingAgencyOutcome } from '@/lib/marketing-agency/intelligence/signal-persistence';

export type LocalOutcomeKind =
  | 'call'
  | 'booking'
  | 'direction'
  | 'review'
  | 'rank'
  | 'listing';

export const LOCAL_OUTCOME_EVENT_TYPE: Record<LocalOutcomeKind, string> = {
  call: 'local_call',
  booking: 'local_booking',
  direction: 'local_direction_request',
  review: 'local_review_received',
  rank: 'local_rank_change',
  listing: 'local_listing_drift',
};

type PersistenceClient = NonNullable<
  Parameters<typeof recordMarketingAgencyOutcome>[1]
>;

type LocalOutcomeClient = Omit<
  PersistenceClient,
  'marketingAgencyOutcomeEvent'
> & {
  /** Absent on a Prisma interactive-transaction client. */
  $transaction?: PersistenceClient['$transaction'];
  $queryRaw?: (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<unknown>;
  marketingAgencyOutcomeEvent: PersistenceClient['marketingAgencyOutcomeEvent'] & {
    findMany: (args: unknown) => Promise<unknown[]>;
  };
};

export interface RecordLocalOutcomeInput {
  organizationId: string;
  locationId: string;
  kind: LocalOutcomeKind;
  dedupeKey: string;
  source: string;
  attribution?: { source?: string; medium?: string; campaign?: string };
  outcomeMetric?: string;
  observedValue?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  recordedAt?: Date;
  client?: LocalOutcomeClient;
}

export interface RecordLocalOutcomeResult {
  status: 'recorded' | 'duplicate';
  outcomeId: string | null;
  signalId: string;
  eventType: string;
}

export async function recordLocalOutcome(
  input: RecordLocalOutcomeInput
): Promise<RecordLocalOutcomeResult> {
  const base = input.client ?? (prisma as unknown as LocalOutcomeClient);
  if (typeof base.$transaction !== 'function') return writeOutcome(base, input);
  return base.$transaction(tx =>
    writeOutcome(tx as unknown as LocalOutcomeClient, input)
  );
}

async function writeOutcome(
  tx: LocalOutcomeClient,
  input: RecordLocalOutcomeInput
): Promise<RecordLocalOutcomeResult> {
  // recordMarketingAgencyOutcome opens its own transaction; fold it into ours.
  const client = Object.assign(Object.create(tx), {
    $transaction: <T>(fn: (c: unknown) => Promise<T>) => fn(tx),
  }) as LocalOutcomeClient & PersistenceClient;
  const { client: _client, ...raw } = input;
  const eventType = LOCAL_OUTCOME_EVENT_TYPE[input.kind];
  const externalId = `local-outcome:${input.kind}:${input.source}:${input.locationId}:${input.dedupeKey}`;
  const capturedAt = input.recordedAt ?? new Date();
  const uniqueKey = {
    organizationId_externalId: {
      organizationId: input.organizationId,
      externalId,
    },
  };

  const signalData = {
    organizationId: input.organizationId,
    externalId,
    sourceId: input.source,
    sourceKind: 'local_outcome',
    sourceLabel: `Local ${input.kind} (${input.source})`,
    permissionContext: 'first_party',
    capturedAt,
    business: input.organizationId,
    client: input.organizationId,
    product: 'local-presence',
    audienceSegment: 'local',
    narrative: `Local ${input.kind} observed for location ${input.locationId}`,
    content: `Local ${input.kind} outcome from ${input.source} (event ${input.dedupeKey})`,
    freshness: 1,
    confidence: 1,
    commercialImpact: 0,
    creativePotential: 0,
    risk: 0,
    scoreTotal: 0,
    status: 'observed',
    riskState: 'clear',
    riskReasons: [],
    approvalStatus: 'not_required',
    blockedReasons: [],
    warnings: [],
    evidenceRefs: [],
    rawSignal: raw,
    metadata: { locationId: input.locationId },
  };

  await client.marketingAgencySignal.upsert({
    where: uniqueKey,
    create: signalData,
    update: signalData,
  });

  const signal = (await client.marketingAgencySignal.findUnique?.({
    where: uniqueKey,
    select: { id: true },
  })) as { id: string } | null | undefined;
  if (!signal) {
    throw new Error(`Local outcome signal ${externalId} missing after upsert.`);
  }

  // Serialise concurrent replays of this event on the signal row.
  if (tx.$queryRaw) {
    await tx.$queryRaw`SELECT id FROM marketing_agency_signals WHERE id = ${signal.id} FOR UPDATE`;
  }

  const existing = await client.marketingAgencyOutcomeEvent.findMany({
    where: {
      organizationId: input.organizationId,
      signalId: signal.id,
      eventType,
    },
    take: 1,
  });
  if (existing.length > 0) {
    const prior = existing[0] as { id?: string };
    return {
      status: 'duplicate',
      outcomeId: prior.id ?? null,
      signalId: signal.id,
      eventType,
    };
  }

  const outcome = (await recordMarketingAgencyOutcome(
    {
      organizationId: input.organizationId,
      signalExternalId: externalId,
      eventType,
      status: 'observed',
      outcomeMetric: input.outcomeMetric,
      observedValue: input.observedValue,
      notes: input.notes,
      metadata: {
        locationId: input.locationId,
        dedupeKey: input.dedupeKey,
        source: input.source,
        attribution: { ...input.attribution },
        ...input.metadata,
      },
      recordedAt: input.recordedAt,
    },
    client
  )) as { id?: string } | null;

  return {
    status: 'recorded',
    outcomeId: outcome?.id ?? null,
    signalId: signal.id,
    eventType,
  };
}
