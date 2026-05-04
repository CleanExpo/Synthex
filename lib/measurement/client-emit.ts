/**
 * Client-side CVML emit helper — SYN-729
 *
 * Wraps `POST /api/cvml/emit` so client components (`'use client'`) can
 * fire CVML events without importing the server-only Prisma path.
 *
 * Fire-and-forget like server-side `emit()`: never throws, never blocks,
 * never surfaces an error to the calling component. CVML is observability
 * — a failed event must not affect the user-facing flow.
 *
 * Session ID generation:
 *   - First call per browser tab generates a UUID and stores it in
 *     sessionStorage under SESSION_KEY.
 *   - Subsequent calls reuse it. Tab close = new session (matches the
 *     SYN-612 sessionId contract).
 *   - SSR-safe: returns null if window is undefined; the caller short-
 *     circuits and we drop the event rather than crashing.
 */

'use client';

import type {
  ClientValueEventType,
  ClientValueFeatureId,
  JourneyStage,
} from './client-value-events';

const SESSION_KEY = 'synthex-cvml-session-id';

function getSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  let id = window.sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `cvml-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export interface ClientEmitInput {
  featureId: ClientValueFeatureId;
  eventType: ClientValueEventType;
  metadata?: Record<string, unknown>;
  journey_moment_id?: string;
  journey_stage?: JourneyStage;
}

/**
 * Fire a client-side CVML event.
 *
 * The server resolves `clientId` (organisation) and `userId` from the
 * authenticated session — clients cannot spoof either. Returns a Promise
 * that always resolves; failures are logged to console at debug level
 * and never thrown.
 */
export async function clientEmit(input: ClientEmitInput): Promise<void> {
  const sessionId = getSessionId();
  if (!sessionId) return; // SSR or sessionStorage unavailable — drop.

  try {
    await fetch('/api/cvml/emit', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true, // Survive page unload (e.g. dismiss → navigate away).
      body: JSON.stringify({
        featureId: input.featureId,
        eventType: input.eventType,
        sessionId,
        metadata: input.metadata ?? {},
        journey_moment_id: input.journey_moment_id,
        journey_stage: input.journey_stage,
      }),
    });
  } catch {
    // Fire-and-forget — never affect the calling flow.
  }
}
