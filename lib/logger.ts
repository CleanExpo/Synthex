/**
 * Structured logger — wraps console methods and captures errors to Sentry.
 * Use this instead of console.error/console.warn in API routes and services.
 *
 * Sentry is loaded via dynamic import (fire-and-forget) to keep it out of
 * the shared webpack bundle. A static top-level import would pull @sentry/nextjs
 * into every Lambda's shared chunk, triggering OTel module-load hooks on
 * cold start and causing 10+ second hangs.
 */

type LogContext = Record<string, unknown>;
type SentryModule = typeof import('@sentry/nextjs');

function formatMessage(prefix: string, message: string, context?: LogContext): string {
  return context ? `${prefix} ${message} ${JSON.stringify(context)}` : `${prefix} ${message}`;
}

/**
 * Fire-and-forget Sentry capture — does not block the caller.
 * Silently no-ops if Sentry is unavailable or not yet initialised.
 */
function captureToSentry(fn: (sentry: SentryModule) => void): void {
  import('@sentry/nextjs').then(fn).catch(() => {
    // Sentry unavailable — swallow silently, logging already went to console
  });
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
    captureToSentry((Sentry) =>
      Sentry.captureMessage(message, { level: 'warning', extra: context })
    );
  },

  error(message: string, error?: unknown, context?: LogContext): void {
    console.error(formatMessage('[ERROR]', message, context), error ?? '');
    if (error instanceof Error) {
      captureToSentry((Sentry) =>
        Sentry.captureException(error, { extra: { message, ...context } })
      );
    } else {
      captureToSentry((Sentry) =>
        Sentry.captureMessage(message, { level: 'error', extra: { error, ...context } })
      );
    }
  },
};
