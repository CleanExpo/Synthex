/**
 * Structured logger — wraps console methods and captures errors to Sentry.
 * Use this instead of console.error/console.warn in API routes and services.
 */
import * as Sentry from '@sentry/nextjs';

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
    Sentry.captureMessage(message, { level: 'warning', extra: context });
  },

  error(message: string, error?: unknown, context?: LogContext): void {
    console.error(formatMessage('[ERROR]', message, context), error ?? '');
    if (error instanceof Error) {
      Sentry.captureException(error, { extra: { message, ...context } });
    } else {
      Sentry.captureMessage(message, { level: 'error', extra: { error, ...context } });
    }
  },
};
