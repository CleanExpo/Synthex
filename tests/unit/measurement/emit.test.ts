/**
 * Jest tests for the CVML emit() wrapper — SYN-724.
 *
 * Covers all 6 event types × 7 featureIds = 42 combinations, plus validation
 * edge-cases and dependency-failure behaviour.
 *
 * Uses dependency injection (EmitDependencies) to avoid touching real GA4 or
 * Supabase — the defaults are exercised in one smoke test per stage.
 */

import {
  CLIENT_VALUE_EVENT_TYPES,
  CLIENT_VALUE_FEATURE_IDS,
  isClientValueEventType,
  isClientValueFeatureId,
  toGa4EventName,
  type ClientValueEvent,
  type ClientValueEventType,
  type ClientValueFeatureId,
} from '@/lib/measurement/client-value-events';
import {
  emit,
  validateClientValueEvent,
  type EmitDependencies,
} from '@/lib/measurement/emit';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(
  featureId: ClientValueFeatureId,
  eventType: ClientValueEventType,
  overrides: Partial<ClientValueEvent> = {}
): ClientValueEvent {
  return {
    featureId,
    eventType,
    clientId: '11111111-1111-1111-1111-111111111111',
    userId: '22222222-2222-2222-2222-222222222222',
    timestamp: '2026-04-17T02:08:00.000Z',
    sessionId: 'sess_abc123',
    metadata: { foo: 'bar' },
    ...overrides,
  };
}

function makeStubDeps(): {
  fireGa4: jest.Mock;
  insert: jest.Mock;
  onError: jest.Mock;
  deps: EmitDependencies;
} {
  const fireGa4 = jest.fn();
  const insert = jest.fn(async (_values: unknown) => ({ error: null }));
  const onError = jest.fn();
  const client = {
    from: (_table: string) => ({ insert }),
  };
  return {
    fireGa4,
    insert,
    onError,
    deps: {
      fireGa4,
      getSupabaseClient: async () => client,
      onError,
    },
  };
}

// ---------------------------------------------------------------------------
// 1. Constant / type-guard coverage
// ---------------------------------------------------------------------------

describe('CVML constants', () => {
  it('exports exactly 7 feature IDs', () => {
    expect(CLIENT_VALUE_FEATURE_IDS).toHaveLength(7);
    expect(new Set(CLIENT_VALUE_FEATURE_IDS).size).toBe(7);
  });

  it('exports exactly 6 event types', () => {
    expect(CLIENT_VALUE_EVENT_TYPES).toHaveLength(6);
    expect(new Set(CLIENT_VALUE_EVENT_TYPES).size).toBe(6);
  });

  it('type guards accept every valid value and reject unknowns', () => {
    for (const id of CLIENT_VALUE_FEATURE_IDS) expect(isClientValueFeatureId(id)).toBe(true);
    for (const t of CLIENT_VALUE_EVENT_TYPES) expect(isClientValueEventType(t)).toBe(true);
    expect(isClientValueFeatureId('not_a_feature')).toBe(false);
    expect(isClientValueEventType('not_an_event')).toBe(false);
  });

  it('toGa4EventName stays within the 40-char GA4 limit', () => {
    for (const f of CLIENT_VALUE_FEATURE_IDS) {
      for (const t of CLIENT_VALUE_EVENT_TYPES) {
        const name = toGa4EventName(f, t);
        expect(name.length).toBeLessThanOrEqual(40);
        expect(name).toMatch(/^[a-z0-9_]+$/);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 2. 42-case matrix — 7 featureIds × 6 eventTypes
// ---------------------------------------------------------------------------

describe('emit() — 7 featureIds × 6 eventTypes = 42 combinations', () => {
  for (const featureId of CLIENT_VALUE_FEATURE_IDS) {
    for (const eventType of CLIENT_VALUE_EVENT_TYPES) {
      it(`emits ${featureId} / ${eventType} through GA4 and Supabase`, async () => {
        const { fireGa4, insert, onError, deps } = makeStubDeps();
        const event = makeEvent(featureId, eventType);

        await emit(event, deps);

        expect(onError).not.toHaveBeenCalled();
        expect(fireGa4).toHaveBeenCalledTimes(1);
        expect(fireGa4).toHaveBeenCalledWith(
          toGa4EventName(featureId, eventType),
          expect.objectContaining({
            feature_id: featureId,
            event_type: eventType,
            client_id: event.clientId,
            session_id: event.sessionId,
          })
        );

        expect(insert).toHaveBeenCalledTimes(1);
        const [row] = insert.mock.calls[0] as [Record<string, unknown>];
        expect(row).toMatchObject({
          client_id: event.clientId,
          user_id: event.userId,
          event_name: `cvml_${featureId}_${eventType}`,
          event_source: 'cvml',
          feature_id: featureId,
          event_type: eventType,
          session_id: event.sessionId,
          occurred_at: event.timestamp,
        });
        expect(row.metadata).toEqual(event.metadata);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// 3. Validation coverage
// ---------------------------------------------------------------------------

describe('validateClientValueEvent', () => {
  it('returns null for a valid event', () => {
    const event = makeEvent('weekly_digest', 'view');
    expect(validateClientValueEvent(event)).toBeNull();
  });

  it('rejects an invalid featureId', () => {
    const event = { ...makeEvent('weekly_digest', 'view'), featureId: 'nope' as ClientValueFeatureId };
    expect(validateClientValueEvent(event)).toMatch(/Invalid featureId/);
  });

  it('rejects an invalid eventType', () => {
    const event = { ...makeEvent('weekly_digest', 'view'), eventType: 'nope' as ClientValueEventType };
    expect(validateClientValueEvent(event)).toMatch(/Invalid eventType/);
  });

  it('rejects an empty clientId', () => {
    expect(validateClientValueEvent(makeEvent('weekly_digest', 'view', { clientId: '' }))).toMatch(/clientId/);
  });

  it('allows a null userId', () => {
    expect(validateClientValueEvent(makeEvent('weekly_digest', 'view', { userId: null }))).toBeNull();
  });

  it('rejects a non-ISO timestamp', () => {
    expect(validateClientValueEvent(makeEvent('weekly_digest', 'view', { timestamp: 'yesterday' }))).toMatch(/timestamp/);
  });

  it('rejects an empty sessionId', () => {
    expect(validateClientValueEvent(makeEvent('weekly_digest', 'view', { sessionId: '' }))).toMatch(/sessionId/);
  });
});

// ---------------------------------------------------------------------------
// 4. Failure handling — emit() must never throw
// ---------------------------------------------------------------------------

describe('emit() failure handling', () => {
  it('reports validation errors via onError and does not fire anything', async () => {
    const { fireGa4, insert, onError, deps } = makeStubDeps();
    const bad = makeEvent('weekly_digest', 'view', { clientId: '' });

    await expect(emit(bad, deps)).resolves.toBeUndefined();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(fireGa4).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('reports supabase errors via onError but still resolves void', async () => {
    const fireGa4 = jest.fn();
    const insert = jest.fn(async () => ({ error: new Error('pg down') }));
    const onError = jest.fn();
    await expect(
      emit(makeEvent('auto_calendar', 'interact'), {
        fireGa4,
        getSupabaseClient: async () => ({ from: () => ({ insert }) }),
        onError,
      })
    ).resolves.toBeUndefined();
    expect(fireGa4).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error), { stage: 'supabase' });
  });

  it('reports GA4 throws but still writes to supabase', async () => {
    const fireGa4 = jest.fn(() => {
      throw new Error('gtag exploded');
    });
    const insert = jest.fn(async () => ({ error: null }));
    const onError = jest.fn();
    await emit(makeEvent('monthly_story', 'share'), {
      fireGa4,
      getSupabaseClient: async () => ({ from: () => ({ insert }) }),
      onError,
    });
    expect(onError).toHaveBeenCalledWith(expect.any(Error), { stage: 'ga4' });
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('silently skips supabase when the resolver returns null', async () => {
    const fireGa4 = jest.fn();
    const onError = jest.fn();
    await emit(makeEvent('authority_hub', 'convert'), {
      fireGa4,
      getSupabaseClient: async () => null,
      onError,
    });
    expect(fireGa4).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('survives a supabase resolver that rejects', async () => {
    const fireGa4 = jest.fn();
    const onError = jest.fn();
    await emit(makeEvent('seasonal_engine', 'dismiss'), {
      fireGa4,
      getSupabaseClient: async () => {
        throw new Error('no client');
      },
      onError,
    });
    expect(onError).toHaveBeenCalledWith(expect.any(Error), { stage: 'supabase' });
  });
});
