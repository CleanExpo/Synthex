/**
 * Structured logger — wraps console methods.
 * Use this instead of console.error/console.warn in API routes and services.
 *
 * NOTE: This logger deliberately does NOT import any Sentry SDK. The
 * dynamic import('@sentry/nextjs') pattern — even fire-and-forget — causes
 * webpack to emit Promise.resolve(require('@sentry/nextjs')) for externalised
 * packages, which registers require-in-the-middle / import-in-the-middle OTel
 * hooks synchronously, blocking the event loop for 10+ s and hanging ALL Lambda
 * cold starts (Phase 114-02).
 *
 * Server-side Sentry capture is instead handled by the SDK-free, DSN-gated
 * envelope transport in lib/observability/sentry-server.ts, wired through
 * lib/observability/error-tracker.ts (trackError) so it has zero cold-start cost.
 * Client-side Sentry remains active via sentry.client.config.ts.
 */

type LogContext = Record<string, unknown>;

function formatMessage(prefix: string, message: string, context?: LogContext): string {
  return context ? `${prefix} ${message} ${JSON.stringify(context)}` : `${prefix} ${message}`;
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatMessage('[DEBUG]', message, context));
    }
  },

  info(message: string, context?: LogContext): void {
    console.info(formatMessage('[INFO]', message, context));
  },

  warn(message: string, context?: LogContext): void {
    console.warn(formatMessage('[WARN]', message, context));
    // NOTE: Sentry.captureMessage() removed — server-side Sentry disabled (Phase 114-02).
  },

  error(message: string, error?: unknown, context?: LogContext): void {
    console.error(formatMessage('[ERROR]', message, context), error ?? '');
    // NOTE: Sentry.captureException() removed — server-side Sentry disabled (Phase 114-02).
  },
};
