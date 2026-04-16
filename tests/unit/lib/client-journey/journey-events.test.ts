import {
  shouldDeliverJourneyEvent,
  recordJourneyEvent,
} from '../../../../lib/client-journey/journey-events';
import { SupabaseClient } from '@supabase/supabase-js';

describe('shouldDeliverJourneyEvent', () => {
  it('returns true when no recent delivery exists (RPC returns true)', async () => {
    const mockSupabase = {
      rpc: jest.fn().mockResolvedValue({ data: true, error: null }),
    } as unknown as SupabaseClient;

    const result = await shouldDeliverJourneyEvent(
      mockSupabase,
      'client-123',
      'onboarding_30_day',
      'email',
      30
    );
    expect(result).toBe(true);
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'should_deliver_journey_event',
      {
        p_client_id: 'client-123',
        p_event_type: 'onboarding_30_day',
        p_channel: 'email',
        p_min_days_between: 30,
      }
    );
  });

  it('returns false when within throttle window (RPC returns false)', async () => {
    const mockSupabase = {
      rpc: jest.fn().mockResolvedValue({ data: false, error: null }),
    } as unknown as SupabaseClient;

    const result = await shouldDeliverJourneyEvent(
      mockSupabase,
      'client-123',
      'onboarding_30_day',
      'email',
      30
    );
    expect(result).toBe(false);
  });

  it('returns true optimistically when RPC errors (non-fatal)', async () => {
    const mockSupabase = {
      rpc: jest
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'DB error' } }),
    } as unknown as SupabaseClient;

    const result = await shouldDeliverJourneyEvent(
      mockSupabase,
      'client-123',
      'onboarding_30_day',
      'email'
    );
    expect(result).toBe(true);
  });

  it('uses default minDaysBetween of 7 when not provided', async () => {
    const mockSupabase = {
      rpc: jest.fn().mockResolvedValue({ data: true, error: null }),
    } as unknown as SupabaseClient;

    await shouldDeliverJourneyEvent(
      mockSupabase,
      'client-123',
      'win_notification',
      'in_app'
    );
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'should_deliver_journey_event',
      {
        p_client_id: 'client-123',
        p_event_type: 'win_notification',
        p_channel: 'in_app',
        p_min_days_between: 7,
      }
    );
  });

  it('returns true optimistically when RPC throws unexpectedly (non-fatal)', async () => {
    const mockSupabase = {
      rpc: jest.fn().mockRejectedValue(new Error('Network error')),
    } as unknown as SupabaseClient;

    const result = await shouldDeliverJourneyEvent(
      mockSupabase,
      'client-123',
      'geo_score_published',
      'email'
    );
    expect(result).toBe(true);
  });
});

describe('recordJourneyEvent', () => {
  it('returns the inserted event id on success', async () => {
    const mockSupabase = {
      rpc: jest.fn().mockResolvedValue({ data: 'event-uuid-123', error: null }),
    } as unknown as SupabaseClient;

    const result = await recordJourneyEvent(
      mockSupabase,
      'client-123',
      'onboarding_30_day',
      'email',
      { foo: 'bar' }
    );
    expect(result).toBe('event-uuid-123');
    expect(mockSupabase.rpc).toHaveBeenCalledWith('record_journey_event', {
      p_client_id: 'client-123',
      p_event_type: 'onboarding_30_day',
      p_channel: 'email',
      p_metadata: { foo: 'bar' },
    });
  });

  it('returns null on error (non-fatal)', async () => {
    const mockSupabase = {
      rpc: jest
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'DB error' } }),
    } as unknown as SupabaseClient;

    const result = await recordJourneyEvent(
      mockSupabase,
      'client-123',
      'onboarding_30_day',
      'email'
    );
    expect(result).toBeNull();
  });

  it('passes null metadata when not provided', async () => {
    const mockSupabase = {
      rpc: jest.fn().mockResolvedValue({ data: 'event-uuid-456', error: null }),
    } as unknown as SupabaseClient;

    await recordJourneyEvent(
      mockSupabase,
      'client-456',
      'personalisation_activated',
      'in_app'
    );
    expect(mockSupabase.rpc).toHaveBeenCalledWith('record_journey_event', {
      p_client_id: 'client-456',
      p_event_type: 'personalisation_activated',
      p_channel: 'in_app',
      p_metadata: null,
    });
  });

  it('returns null when RPC throws unexpectedly (non-fatal)', async () => {
    const mockSupabase = {
      rpc: jest.fn().mockRejectedValue(new Error('Connection timeout')),
    } as unknown as SupabaseClient;

    const result = await recordJourneyEvent(
      mockSupabase,
      'client-123',
      'quarterly_milestone_review',
      'email'
    );
    expect(result).toBeNull();
  });
});
