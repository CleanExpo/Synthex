/**
 * Lazy, ESM-safe loader for the Resend SDK (SYN-999).
 *
 * `lib/email/queue.ts` previously did a top-level `require('resend')`, which runs at module
 * load and throws `ERR_REQUIRE_ESM` ("require() of ES Module") under the serverless bundle —
 * 500ing every route that imports the queue (e.g. `/api/cron/seo-audits`). `import()` is
 * ESM-safe and defers the load to the call site, so importing the queue has no resend side effect.
 */

export type ResendCtor = typeof import('resend').Resend;

let cached: Promise<ResendCtor | null> | null = null;

/**
 * Returns the Resend constructor (cached), or null if the SDK can't be loaded — in which
 * case callers fall back to SendGrid. Never throws at import time.
 */
export function loadResendCtor(): Promise<ResendCtor | null> {
  if (!cached) {
    cached = import('resend')
      .then(mod => mod.Resend)
      .catch(() => null);
  }
  return cached;
}
