/**
 * SEAM: recordLocalOutcome(input, fakeClient) — the single local-outcome writer.
 * Catches: replayed deliveries double-writing, lost org/location/attribution,
 * wrong event type per kind. Misses: real Prisma query semantics (fake client).
 */
import {
  recordLocalOutcome,
  LOCAL_OUTCOME_EVENT_TYPE,
  type LocalOutcomeKind,
  type RecordLocalOutcomeInput,
} from '@/lib/marketing-agency/outcomes/local-outcome-writer';

function createClient() {
  const signals = new Map<string, { id: string; externalId: string }>();
  const outcomes: Array<Record<string, any>> = [];
  const client = {
    $transaction: jest.fn(async (cb: any) => cb(client)),
    marketingAgencySignal: {
      upsert: jest.fn(async (args: any) => {
        const rec = {
          id: `sig-${args.create.externalId}`,
          externalId: args.create.externalId,
        };
        signals.set(args.create.externalId, rec);
        return rec;
      }),
      findUnique: jest.fn(
        async (args: any) =>
          signals.get(args.where.organizationId_externalId.externalId) ?? null
      ),
    },
    marketingAgencyOpportunity: { upsert: jest.fn(), findUnique: jest.fn() },
    marketingAgencyOutcomeEvent: {
      upsert: jest.fn(),
      create: jest.fn(async (args: any) => {
        const row = { id: `out-${outcomes.length + 1}`, ...args.data };
        outcomes.push(row);
        return row;
      }),
      findMany: jest.fn(async (args: any) =>
        outcomes
          .filter(o => Object.entries(args.where).every(([k, v]) => o[k] === v))
          .slice(0, args.take)
      ),
    },
  };
  return { client, outcomes };
}

function input(
  over: Partial<RecordLocalOutcomeInput> = {}
): RecordLocalOutcomeInput {
  return {
    organizationId: 'org-A',
    locationId: 'loc-1',
    kind: 'call',
    dedupeKey: 'call-123',
    source: 'callrail',
    attribution: { source: 'google', medium: 'organic' },
    ...over,
  };
}

describe('recordLocalOutcome', () => {
  it('writes exactly one outcome when the same dedupeKey is delivered twice', async () => {
    const { client, outcomes } = createClient();
    const first = await recordLocalOutcome({
      ...input(),
      client: client as any,
    });
    const second = await recordLocalOutcome({
      ...input(),
      client: client as any,
    });

    expect(first.status).toBe('recorded');
    expect(second.status).toBe('duplicate');
    expect(outcomes).toHaveLength(1);
    expect(client.marketingAgencyOutcomeEvent.create).toHaveBeenCalledTimes(1);
  });

  it('writes two outcomes for two distinct dedupeKeys', async () => {
    const { client, outcomes } = createClient();
    await recordLocalOutcome({
      ...input({ dedupeKey: 'a' }),
      client: client as any,
    });
    await recordLocalOutcome({
      ...input({ dedupeKey: 'b' }),
      client: client as any,
    });
    expect(outcomes).toHaveLength(2);
  });

  it('carries the caller org, location, attribution and mapped eventType', async () => {
    const { client, outcomes } = createClient();
    const res = await recordLocalOutcome({
      ...input({ kind: 'review', dedupeKey: 'rev-1', metadata: { stars: 5 } }),
      client: client as any,
    });
    expect(res.eventType).toBe('local_review_received');
    expect(outcomes[0]).toMatchObject({
      organizationId: 'org-A',
      eventType: 'local_review_received',
      status: 'observed',
      metadata: {
        locationId: 'loc-1',
        dedupeKey: 'rev-1',
        source: 'callrail',
        attribution: { source: 'google', medium: 'organic' },
        stars: 5,
      },
    });
  });

  it('always writes attribution as an object, even when none is given', async () => {
    const { client, outcomes } = createClient();
    await recordLocalOutcome({
      ...input({ attribution: undefined }),
      client: client as any,
    });
    expect(outcomes[0].metadata.attribution).toEqual({});
  });

  it('maps every kind to its event type', () => {
    const kinds: LocalOutcomeKind[] = [
      'call',
      'booking',
      'direction',
      'review',
      'rank',
      'listing',
    ];
    expect(kinds.map(k => LOCAL_OUTCOME_EVENT_TYPE[k])).toEqual([
      'local_call',
      'local_booking',
      'local_direction_request',
      'local_review_received',
      'local_rank_change',
      'local_listing_drift',
    ]);
  });

  it('does not dedupe across organizations', async () => {
    const { client, outcomes } = createClient();
    await recordLocalOutcome({ ...input(), client: client as any });
    await recordLocalOutcome({
      ...input({ organizationId: 'org-B' }),
      client: client as any,
    });
    expect(outcomes.map(o => o.organizationId)).toEqual(['org-A', 'org-B']);
  });
});
