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
  it('keeps the same dedupeKey from two sources as two signals and two events', async () => {
    const { client, outcomes } = createClient();
    await recordLocalOutcome({
      ...input({ source: 'callrail' }),
      client: client as any,
    });
    await recordLocalOutcome({
      ...input({ source: 'twilio' }),
      client: client as any,
    });
    expect(outcomes).toHaveLength(2);
    expect(new Set(outcomes.map(o => o.signalId)).size).toBe(2);
  });

  it('keeps the same dedupeKey from two locations as two signals and two events', async () => {
    const { client, outcomes } = createClient();
    await recordLocalOutcome({
      ...input({ locationId: 'loc-1' }),
      client: client as any,
    });
    await recordLocalOutcome({
      ...input({ locationId: 'loc-2' }),
      client: client as any,
    });
    expect(outcomes).toHaveLength(2);
    expect(new Set(outcomes.map(o => o.signalId)).size).toBe(2);
  });

  it('namespaces the signal externalId by kind, source and location', async () => {
    const { client } = createClient();
    await recordLocalOutcome({ ...input(), client: client as any });
    expect(
      client.marketingAgencySignal.upsert.mock.calls[0][0].create.externalId
    ).toBe('local-outcome:call:callrail:loc-1:call-123');
  });

  it('locks the signal row with FOR UPDATE inside the transaction before checking for a prior event', async () => {
    const { client } = createClient();
    const order: string[] = [];
    let inTx = false;
    client.$transaction.mockImplementation(async (cb: any) => {
      inTx = true;
      try {
        return await cb(client);
      } finally {
        inTx = false;
      }
    });
    (client as any).$queryRaw = jest.fn(
      async (strings: TemplateStringsArray, ...values: unknown[]) => {
        order.push(
          `lock:${inTx}:${strings.join('?').replace(/\s+/g, ' ')}:${values[0]}`
        );
        return [];
      }
    );
    client.marketingAgencyOutcomeEvent.findMany.mockImplementationOnce(
      async () => {
        order.push('check');
        return [];
      }
    );
    await recordLocalOutcome({ ...input(), client: client as any });
    expect(order).toEqual([
      'lock:true:SELECT id FROM marketing_agency_signals WHERE id = ? FOR UPDATE:sig-local-outcome:call:callrail:loc-1:call-123',
      'check',
    ]);
  });

  it('works on an interactive-transaction client that has no $transaction', async () => {
    const { client, outcomes } = createClient();
    const { $transaction: _t, ...txClient } = client;
    const first = await recordLocalOutcome({
      ...input(),
      client: txClient as any,
    });
    const second = await recordLocalOutcome({
      ...input(),
      client: txClient as any,
    });
    expect([first.status, second.status]).toEqual(['recorded', 'duplicate']);
    expect(outcomes).toHaveLength(1);
  });
});
