/**
 * CVML emitter — SYN-724
 *
 * Wraps the SYN-612 client-engagement telemetry path (Prisma write to
 * `client_engagement_events`) so every client-value feature emits the same
 * shape. Additive only — does NOT remove or change any existing emissions.
 *
 * Usage:
 *
 *   import { emit } from '@/lib/measurement/emit';
 *
 *   await emit({
 *     featureId: 'weekly_digest',
 *     eventType: 'view',
 *     clientId: org.id,
 *     userId: currentUser?.id ?? null,
 *     timestamp: new Date().toISOString(),
 *     sessionId,
 *     metadata: { digest_id: digest.id },
 *   });
 *
 * Events are fire-and-forget — the emitter never throws and never blocks
 * the calling path on telemetry failures.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { Prisma } from '@prisma/client';
import type { ClientValueEvent } from './client-value-events';

/**
 * Emit a client-value event.
 *
 * Writes a row into `client_engagement_events` with `eventType = 'cvml'`
 * and the feature + CVML-event fields carried in `eventData`. This keeps
 * the SYN-612 schema unchanged and lets the scorecard view discriminate
 * on `eventData->>'feature_id'` and `eventData->>'cvml_event_type'`.
 *
 * Returns `void` — never throws. Failures are logged at error level.
 */
export async function emit(event: ClientValueEvent): Promise<void> {
  try {
    await prisma.clientEngagementEvent.create({
      data: {
        clientId: event.clientId,
        eventType: 'cvml',
        eventData: buildEventData(event) as Prisma.InputJsonValue,
        pagePath: null,
        sessionId: event.sessionId,
      },
    });
  } catch (err) {
    logger.error('[cvml-emit] Failed to write client-value event', {
      featureId: event.featureId,
      eventType: event.eventType,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Construct the eventData JSON payload written to Supabase. Exported for test
 *  inspection — lets tests assert the canonical shape without a DB round-trip.
 *
 *  Journey moment context (SYN-768 / SYN-729) is included when the emitter
 *  carries it; absent when it doesn't, so existing feature-only events keep
 *  their identical shape and the scorecard view can discriminate on
 *  `eventData->>'journey_moment_id' IS NOT NULL`. */
export function buildEventData(
  event: ClientValueEvent
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    cvml_event_type: event.eventType,
    feature_id: event.featureId,
    user_id: event.userId,
    timestamp: event.timestamp,
    metadata: event.metadata,
  };
  if (event.journey_moment_id !== undefined) {
    data.journey_moment_id = event.journey_moment_id;
  }
  if (event.journey_stage !== undefined) {
    data.journey_stage = event.journey_stage;
  }
  return data;
}
