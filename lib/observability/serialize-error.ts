/**
 * Serialize an unknown thrown value into an enumerable, log-safe object.
 *
 * `logger.error(msg, context)` stringifies `context` with JSON.stringify, but an Error's
 * `message` and `stack` are NON-enumerable — so `logger.error('x', { error })` logs
 * `{"error":{}}`, silently dropping the cause. Combined with server-side Sentry capture
 * being disabled (see lib/logger.ts), this left `/api/cron/autopilot` fatal failures with
 * no recoverable error anywhere (SYN-999). Use this to capture the real message + stack as
 * plain, serialisable fields.
 */

export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
}

export function serializeError(error: unknown, maxStack = 2000): SerializedError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ? error.stack.slice(0, maxStack) : undefined,
    };
  }
  if (typeof error === 'string') {
    return { name: 'NonError', message: error };
  }
  try {
    return { name: 'NonError', message: JSON.stringify(error) };
  } catch {
    return { name: 'NonError', message: String(error) };
  }
}
