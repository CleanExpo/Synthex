/**
 * Unit tests — Client Value Measurement Layer — SYN-724
 *
 * Covers:
 *   - All 7 featureId × 6 eventType combinations (42 cases) write the
 *     canonical event shape
 *   - `emit()` never throws on Prisma failure (fire-and-forget contract)
 *   - `eventData` JSON has the shape the scorecard materialised view expects
 *   - Type guards reject unknown featureId / eventType values
 */

const mockCreate = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    clientEngagementEvent: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

import {
  CLIENT_VALUE_EVENT_TYPES,
  CLIENT_VALUE_FEATURE_IDS,
  isClientValueEventType,
  isClientValueFeatureId,
  type ClientValueEvent,
  type ClientValueEventType,
  type ClientValueFeatureId,
} from '@/lib/measurement/client-value-events';
import { buildEventData, emit } from '@/lib/measurement/emit';

function sampleEvent(
  featureId: ClientValueFeatureId,
  eventType: ClientValueEventType
): ClientValueEvent {
  return {
    featureId,
    eventType,
    clientId: '00000000-0000-0000-0000-000000000001',
    userId: '00000000-0000-0000-0000-000000000002',
    timestamp: '2026-04-24T00:00:00.000Z',
    sessionId: '00000000-0000-0000-0000-000000000003',
    metadata: { sample_key: 'sample_value' },
  };
}

// Generate all 42 featureId × eventType combinations for parameterised tests.
const allCombinations = CLIENT_VALUE_FEATURE_IDS.flatMap(featureId =>
  CLIENT_VALUE_EVENT_TYPES.map(eventType => [featureId, eventType] as const)
);

describe('SYN-724 — CVML schema', () => {
  it('exposes 7 feature IDs', () => {
    expect(CLIENT_VALUE_FEATURE_IDS).toHaveLength(7);
  });

  it('exposes 6 event types', () => {
    expect(CLIENT_VALUE_EVENT_TYPES).toHaveLength(6);
  });

  it('covers all 7 shipped features by name', () => {
    expect(CLIENT_VALUE_FEATURE_IDS).toEqual(
      expect.arrayContaining([
        'weekly_digest',
        'auto_calendar',
        'review_intelligence',
        'authority_hub',
        'seasonal_engine',
        'first_win_notification',
        'monthly_story',
      ])
    );
  });

  it('covers the 6 canonical CVML events', () => {
    expect(CLIENT_VALUE_EVENT_TYPES).toEqual(
      expect.arrayContaining([
        'view',
        'interact',
        'act_within_72h',
        'convert',
        'dismiss',
        'share',
      ])
    );
  });
});

describe('SYN-724 — type guards', () => {
  it('isClientValueFeatureId accepts every known feature', () => {
    for (const id of CLIENT_VALUE_FEATURE_IDS) {
      expect(isClientValueFeatureId(id)).toBe(true);
    }
  });

  it('isClientValueFeatureId rejects unknown values', () => {
    expect(isClientValueFeatureId('not_a_feature')).toBe(false);
    expect(isClientValueFeatureId(null)).toBe(false);
    expect(isClientValueFeatureId(42)).toBe(false);
    expect(isClientValueFeatureId(undefined)).toBe(false);
  });

  it('isClientValueEventType accepts every known event', () => {
    for (const t of CLIENT_VALUE_EVENT_TYPES) {
      expect(isClientValueEventType(t)).toBe(true);
    }
  });

  it('isClientValueEventType rejects unknown values', () => {
    expect(isClientValueEventType('clicked')).toBe(false);
    expect(isClientValueEventType(null)).toBe(false);
  });
});

describe('SYN-724 — buildEventData canonical shape', () => {
  it.each(allCombinations)(
    '%s / %s produces canonical eventData',
    (featureId, eventType) => {
      const data = buildEventData(sampleEvent(featureId, eventType));
      expect(data).toEqual({
        cvml_event_type: eventType,
        feature_id: featureId,
        user_id: '00000000-0000-0000-0000-000000000002',
        timestamp: '2026-04-24T00:00:00.000Z',
        metadata: { sample_key: 'sample_value' },
      });
    }
  );

  it('preserves null userId for cron-sourced events', () => {
    const ev = sampleEvent('weekly_digest', 'view');
    ev.userId = null;
    expect(buildEventData(ev).user_id).toBeNull();
  });
});

describe('SYN-724 — emit() writes to client_engagement_events', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockCreate.mockResolvedValue(undefined);
  });

  it.each(allCombinations)(
    '%s / %s writes one row with eventType=cvml',
    async (featureId, eventType) => {
      await emit(sampleEvent(featureId, eventType));
      expect(mockCreate).toHaveBeenCalledTimes(1);
      const args = mockCreate.mock.calls[0][0] as {
        data: {
          eventType: string;
          clientId: string;
          sessionId: string;
          eventData: Record<string, unknown>;
        };
      };
      expect(args.data.eventType).toBe('cvml');
      expect(args.data.clientId).toBe('00000000-0000-0000-0000-000000000001');
      expect(args.data.sessionId).toBe('00000000-0000-0000-0000-000000000003');
      expect(args.data.eventData).toEqual({
        cvml_event_type: eventType,
        feature_id: featureId,
        user_id: '00000000-0000-0000-0000-000000000002',
        timestamp: '2026-04-24T00:00:00.000Z',
        metadata: { sample_key: 'sample_value' },
      });
    }
  );

  it('never throws when the Prisma write fails — fire-and-forget contract', async () => {
    mockCreate.mockRejectedValueOnce(new Error('DB is down'));
    await expect(
      emit(sampleEvent('weekly_digest', 'convert'))
    ).resolves.toBeUndefined();
  });
});
