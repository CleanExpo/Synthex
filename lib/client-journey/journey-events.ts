/**
 * Client journey event delivery gate and log.
 *
 * NOT PROVISIONED: these helpers called the `should_deliver_journey_event` and
 * `record_journey_event` RPCs over the `client_journey_events` table, which has
 * no Prisma model in `prisma/schema.prisma`. Both functions throw
 * {@link JourneyEventsNotProvisionedError} instead of guessing: the old
 * fallbacks reported "safe to deliver" and swallowed failed writes, so a caller
 * could not tell an unprovisioned feature from a working one.
 */

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

/** Minimal RPC-capable client shape accepted for API compatibility. */
export interface JourneyRpcClient {
  rpc(fn: string, params: Record<string, unknown>): PromiseLike<unknown>;
}

export class JourneyEventsNotProvisionedError extends Error {
  readonly code = 'FEATURE_NOT_PROVISIONED' as const;
  readonly table = 'client_journey_events' as const;

  constructor(operation: string) {
    super(
      `[journey-events] ${operation} unavailable: the client_journey_events table is not provisioned`
    );
    this.name = 'JourneyEventsNotProvisionedError';
  }
}

/**
 * Whether it is safe to deliver the journey event.
 * @throws JourneyEventsNotProvisionedError until client_journey_events exists.
 */
export async function shouldDeliverJourneyEvent(
  _platform: JourneyRpcClient,
  _clientId: string,
  _eventType: JourneyEventType,
  _channel: JourneyChannel,
  _minDaysBetween = 7
): Promise<boolean> {
  throw new JourneyEventsNotProvisionedError('shouldDeliverJourneyEvent');
}

/**
 * Records a delivered journey event.
 * @throws JourneyEventsNotProvisionedError until client_journey_events exists.
 */
export async function recordJourneyEvent(
  _platform: JourneyRpcClient,
  _clientId: string,
  _eventType: JourneyEventType,
  _channel: JourneyChannel,
  _metadata?: Record<string, unknown>
): Promise<string | null> {
  throw new JourneyEventsNotProvisionedError('recordJourneyEvent');
}
