import { SupabaseClient } from '@supabase/supabase-js';

export type JourneyEventType =
  | 'onboarding_30_day'
  | 'quarterly_milestone_review'
  | 'win_notification'
  | 'geo_score_published'
  | 'personalisation_activated';

export type JourneyChannel = 'email' | 'in_app';

export interface JourneyEvent {
  id: string;
  clientId: string;
  eventType: JourneyEventType;
  deliveredAt: string;
  channel: JourneyChannel;
  metadata?: Record<string, unknown>;
}

/**
 * Returns true if it is safe to deliver the journey event.
 * Non-fatal: logs errors and returns true (optimistic) on failure so delivery is not blocked.
 */
export async function shouldDeliverJourneyEvent(
  supabase: SupabaseClient,
  clientId: string,
  eventType: JourneyEventType,
  channel: JourneyChannel,
  minDaysBetween = 7
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('should_deliver_journey_event', {
      p_client_id: clientId,
      p_event_type: eventType,
      p_channel: channel,
      p_min_days_between: minDaysBetween,
    });
    if (error) {
      console.error(
        '[journey-events] shouldDeliverJourneyEvent error:',
        error.message
      );
      return true; // optimistic fallback
    }
    return data as boolean;
  } catch (err) {
    console.error(
      '[journey-events] shouldDeliverJourneyEvent unexpected error:',
      err
    );
    return true; // non-fatal
  }
}

/**
 * Records a delivered journey event.
 * Non-fatal: logs errors silently so calling code is not blocked.
 */
export async function recordJourneyEvent(
  supabase: SupabaseClient,
  clientId: string,
  eventType: JourneyEventType,
  channel: JourneyChannel,
  metadata?: Record<string, unknown>
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('record_journey_event', {
      p_client_id: clientId,
      p_event_type: eventType,
      p_channel: channel,
      p_metadata: metadata ?? null,
    });
    if (error) {
      console.error(
        '[journey-events] recordJourneyEvent error:',
        error.message
      );
      return null;
    }
    return data as string;
  } catch (err) {
    console.error('[journey-events] recordJourneyEvent unexpected error:', err);
    return null; // non-fatal
  }
}
