/**
 * Structured logger — wraps console methods.
 * Use this instead of console.error/console.warn in API routes and services.
 *
 * NOTE: Server-side Sentry capture intentionally removed (2026-03-12, Phase 114-02).
 * The dynamic import('@sentry/nextjs') pattern — even fire-and-forget — causes
 * webpack to emit Promise.resolve(require('@sentry/nextjs')) for externalised packages.
 * When require('@sentry/nextjs') first runs it registers require-in-the-middle /
 * import-in-the-middle OTel hooks synchronously, blocking the event loop for 10+ s
 * and hanging ALL Lambda cold starts that call logger.warn/error during init.
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
