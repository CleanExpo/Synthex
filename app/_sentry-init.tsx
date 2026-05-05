'use client';

/**
 * SYN-906: Sentry client-side boot.
 *
 * `sentry.client.config.ts` calls `Sentry.init()` at module-evaluation time.
 * The @sentry/nextjs webpack plugin (which would auto-pick that file up) was
 * removed in Phase 114-02 to fix a Lambda cold-start hang — see
 * `next.config.mjs:156`. As a result the config file existed but was never
 * loaded, so client-side error capture has been silently broken since.
 *
 * This module fixes that by importing the config from a `'use client'`
 * boundary that the root layout renders once. The import is a side-effect
 * import — Sentry.init() runs the moment this chunk reaches the browser,
 * before any user interaction. From that point on, Sentry's global handlers
 * capture every uncaught error, unhandled rejection, and React error-
 * boundary catch (when the boundary calls Sentry.captureException — see
 * app/error.tsx + app/global-error.tsx).
 *
 * The component renders nothing — its job is the side-effect import.
 *
 * Requires `NEXT_PUBLIC_SENTRY_DSN` to be set in the runtime environment.
 * Sentry.init becomes a no-op when DSN is missing, so this is safe to ship
 * to environments without Sentry configured.
 */

import '../sentry.client.config';

export function SentryInit() {
  return null;
}
