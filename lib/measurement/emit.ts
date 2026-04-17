/**
 * Client Value Measurement Layer (CVML) — emit() wrapper — SYN-724 (Session 34)
 *
 * Strict-typed wrapper over the existing SYN-612 dual-write telemetry path
 * (GA4 via `window.gtag` + Supabase `client_engagement_events` table).
 *
 * This module is **additive only** — it does NOT replace any existing
 * emission. Existing `fireAdvisorEvent`, `fireEvent` (onboarding),
 * `fireStoryEvent`, `fireTeamEvent`, etc. continue to fire as before. The
 * CVML scorecard (SYN-725) reads from `client_engagement_events` rows tagged
 * with a CVML `event_name`, so retrofit work (SYN-726) calls `emit()` in
 * addition to the legacy fire() functions.
 *
 * Isomorphic:
 *   • Browser — fires GA4 `window.gtag` (queueing via dataLayer if not loaded)
 *               AND performs a best-effort insert into `client_engagement_events`
 *               via the browser Supabase client.
 *   • Server  — inserts into `client_engagement_events` via the server
 *               Supabase client. GA4 firing is skipped (no window).
 *
 * Failure handling:
 *   • Never throws. A failed Supabase write is logged (console.error) but
 *     swallowed — parity with the existing `fireEvent` contract.
 *   • Callers do not need to `try/catch`. `emit()` resolves `void`.
 *
 * @module lib/measurement/emit
 * @see lib/measurement/client-value-events
 * @see board-cron/decisions/client-value-2026-04-17-0600.md
 */

import {
  CLIENT_VALUE_EVENT_TYPES,
  CLIENT_VALUE_FEATURE_IDS,
  isClientValueEventType,
  isClientValueFeatureId,
  toGa4EventName,
  type ClientValueEvent,
} from '@/lib/measurement/client-value-events';

// ============================================================================
// TYPES
// ============================================================================

type GTagWindow = Window & {
  gtag?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
};

/**
 * Minimal shape of the Supabase client we need. Typed loosely so the wrapper
 * can accept either `@supabase/supabase-js` browser/server clients or a test
 * double — the production imports lazy-load the real clients only when a
 * Supabase call is actually needed.
 */
interface MinimalSupabaseClient {
  from(table: string): {
    insert(values: Record<string, unknown>): Promise<{ error: unknown }>;
  };
}

/**
 * Dependency override shape used by unit tests. Callers should NEVER pass
 * this in production code — the defaults wire up the real GA4 + Supabase
 * paths.
 */
export interface EmitDependencies {
  /** Override gtag / dataLayer fire. Defaults to `window.gtag`. */
  readonly fireGa4?: (eventName: string, params: Record<string, unknown>) => void;
  /** Override Supabase client resolver. Defaults to the isomorphic resolver below. */
  readonly getSupabaseClient?: () => Promise<MinimalSupabaseClient | null>;
  /** Override console error surface. Defaults to `console.error`. */
  readonly onError?: (error: unknown, context: { stage: 'ga4' | 'supabase' }) => void;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate a CVML event at runtime.
 *
 * Returns an error message string if invalid, or `null` if the event is
 * safe to emit. This is defensive — TypeScript already guarantees the shape
 * at compile time, but runtime callers (API routes, webhook handlers) may
 * pass parsed JSON of unknown provenance.
 */
export function validateClientValueEvent(event: ClientValueEvent): string | null {
  if (!isClientValueFeatureId(event.featureId)) {
    return `Invalid featureId: ${String(event.featureId)}. Must be one of ${CLIENT_VALUE_FEATURE_IDS.join(', ')}`;
  }
  if (!isClientValueEventType(event.eventType)) {
    return `Invalid eventType: ${String(event.eventType)}. Must be one of ${CLIENT_VALUE_EVENT_TYPES.join(', ')}`;
  }
  if (typeof event.clientId !== 'string' || event.clientId.length === 0) {
    return 'clientId must be a non-empty string (UUID)';
  }
  if (event.userId !== null && (typeof event.userId !== 'string' || event.userId.length === 0)) {
    return 'userId must be a non-empty string (UUID) or null';
  }
  if (typeof event.timestamp !== 'string' || Number.isNaN(Date.parse(event.timestamp))) {
    return 'timestamp must be an ISO 8601 string';
  }
  if (typeof event.sessionId !== 'string' || event.sessionId.length === 0) {
    return 'sessionId must be a non-empty string';
  }
  if (event.metadata === null || typeof event.metadata !== 'object') {
    return 'metadata must be an object (use {} for an empty payload)';
  }
  return null;
}

// ============================================================================
// ISOMORPHIC SUPABASE RESOLVER
// ============================================================================

/**
 * Lazy-resolve a Supabase client appropriate for the current runtime.
 *
 * Browser → `lib/supabase-browser` (anon key, subject to RLS).
 * Server  → `lib/supabase-server` (service-role-aware, used by Edge Functions
 *           and API routes).
 *
 * Dynamic import avoids pulling the server-only module into the client bundle.
 * Returns `null` if neither can be loaded (e.g. in a test environment without
 * Supabase installed) — in which case the emit() call silently skips the
 * Supabase write rather than crashing.
 */
async function defaultGetSupabaseClient(): Promise<MinimalSupabaseClient | null> {
  try {
    if (typeof window !== 'undefined') {
      const mod = (await import('@/lib/supabase-browser')) as {
        supabaseBrowser?: MinimalSupabaseClient;
        default?: MinimalSupabaseClient;
        createClient?: () => MinimalSupabaseClient;
      };
      if (mod.supabaseBrowser) return mod.supabaseBrowser;
      if (mod.default) return mod.default;
      if (typeof mod.createClient === 'function') return mod.createClient();
      return null;
    }
    const mod = (await import('@/lib/supabase-server')) as {
      supabaseServer?: MinimalSupabaseClient;
      default?: MinimalSupabaseClient;
      createClient?: () => MinimalSupabaseClient;
    };
    if (mod.supabaseServer) return mod.supabaseServer;
    if (mod.default) return mod.default;
    if (typeof mod.createClient === 'function') return mod.createClient();
    return null;
  } catch {
    // Module resolution failed — emit() falls back to GA4-only.
    return null;
  }
}

// ============================================================================
// DEFAULT GA4 FIRE
// ============================================================================

function defaultFireGa4(eventName: string, params: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const win = window as GTagWindow;
  if (typeof win.gtag === 'function') {
    win.gtag('event', eventName, params);
    return;
  }
  // Queue via dataLayer so the event is captured when gtag loads.
  win.dataLayer = win.dataLayer ?? [];
  win.dataLayer.push({ event: eventName, ...params });
}

function defaultOnError(error: unknown, context: { stage: 'ga4' | 'supabase' }): void {
  // eslint-disable-next-line no-console
  console.error(`[CVML emit] ${context.stage} failure`, error);
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Emit a CVML event to GA4 (browser) and Supabase `client_engagement_events`.
 *
 * @example
 *   await emit({
 *     featureId: 'weekly_digest',
 *     eventType: 'view',
 *     clientId: client.id,
 *     userId: session.user.id,
 *     timestamp: new Date().toISOString(),
 *     sessionId: session.id,
 *     metadata: { digest_week: '2026-W16' },
 *   });
 *
 * @param event - The CVML event to emit.
 * @param deps  - (Testing only) dependency overrides.
 * @returns     - Promise that always resolves `void`. Never throws.
 */
export async function emit(
  event: ClientValueEvent,
  deps: EmitDependencies = {}
): Promise<void> {
  const validationError = validateClientValueEvent(event);
  if (validationError !== null) {
    const onError = deps.onError ?? defaultOnError;
    onError(new Error(validationError), { stage: 'supabase' });
    return;
  }

  const fireGa4 = deps.fireGa4 ?? defaultFireGa4;
  const getSupabaseClient = deps.getSupabaseClient ?? defaultGetSupabaseClient;
  const onError = deps.onError ?? defaultOnError;

  // 1. GA4 — browser only. Server calls are a no-op by design.
  try {
    const ga4Name = toGa4EventName(event.featureId, event.eventType);
    fireGa4(ga4Name, {
      feature_id: event.featureId,
      event_type: event.eventType,
      client_id: event.clientId,
      session_id: event.sessionId,
    });
  } catch (err) {
    onError(err, { stage: 'ga4' });
  }

  // 2. Supabase — dual-write to client_engagement_events (SYN-612 table).
  try {
    const client = await getSupabaseClient();
    if (client === null) return;
    const { error } = await client.from('client_engagement_events').insert({
      client_id: event.clientId,
      user_id: event.userId,
      event_name: `cvml_${event.featureId}_${event.eventType}`,
      event_source: 'cvml',
      feature_id: event.featureId,
      event_type: event.eventType,
      session_id: event.sessionId,
      metadata: event.metadata,
      occurred_at: event.timestamp,
    });
    if (error) {
      onError(error, { stage: 'supabase' });
    }
  } catch (err) {
    onError(err, { stage: 'supabase' });
  }
}
