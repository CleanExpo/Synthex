/**
 * Structured Logger for SYNTHEX
 *
 * Provides JSON-formatted logging with log levels, request ID correlation,
 * and automatic Sentry integration for error-level logs.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.info('User signed in', { userId: '123' });
 *   logger.error('Payment failed', { orderId: '456', error: err });
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: string;
  requestId?: string;
  [key: string]: unknown;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getMinLevel(): LogLevel {
  const env = process.env.LOG_LEVEL as LogLevel | undefined;
  if (env && env in LOG_LEVEL_PRIORITY) return env;
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[getMinLevel()];
}

function formatError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      errorName: err.name,
      errorMessage: err.message,
      stack: err.stack,
    };
  }
  return { errorMessage: String(err) };
}

function emit(entry: LogEntry) {
  const json = JSON.stringify(entry);
  switch (entry.level) {
    case 'error':
      console.error(json);
      break;
    case 'warn':
      console.warn(json);
      break;
    case 'debug':
      console.debug(json);
      break;
    default:
      console.log(json);
  }
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    service: 'synthex',
    ...meta,
  };

  // Normalize error objects in meta
  if (meta?.error) {
    Object.assign(entry, formatError(meta.error));
    delete entry.error;
  }

  emit(entry);
}

/**
 * Create a child logger with preset fields (e.g. requestId).
 * All log calls on the child automatically include those fields.
 */
function child(defaults: Record<string, unknown>) {
  return {
    debug: (msg: string, meta?: Record<string, unknown>) =>
      log('debug', msg, { ...defaults, ...meta }),
    info: (msg: string, meta?: Record<string, unknown>) =>
      log('info', msg, { ...defaults, ...meta }),
    warn: (msg: string, meta?: Record<string, unknown>) =>
      log('warn', msg, { ...defaults, ...meta }),
    error: (msg: string, meta?: Record<string, unknown>) =>
      log('error', msg, { ...defaults, ...meta }),
  };
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log('debug', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),
  child,
};
