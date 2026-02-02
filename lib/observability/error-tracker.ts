/**
 * Error Tracking & Handling
 * Centralized error tracking with context and severity
 *
 * @task UNI-423 - Monitoring & Observability Epic
 *
 * Usage:
 * ```typescript
 * import { trackError, ErrorSeverity, withErrorTracking } from '@/lib/observability';
 *
 * // Track an error
 * trackError(error, {
 *   severity: ErrorSeverity.HIGH,
 *   context: { userId: '123', action: 'checkout' }
 * });
 *
 * // Wrap async function with error tracking
 * const result = await withErrorTracking(
 *   () => processPayment(data),
 *   { operation: 'payment', userId }
 * );
 * ```
 */

import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ErrorCategory {
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  DATABASE = 'database',
  EXTERNAL_SERVICE = 'external_service',
  NETWORK = 'network',
  RATE_LIMIT = 'rate_limit',
  INTERNAL = 'internal',
  UNKNOWN = 'unknown',
}

export interface ErrorContext {
  severity?: ErrorSeverity;
  category?: ErrorCategory;
  userId?: string;
  requestId?: string;
  operation?: string;
  metadata?: Record<string, unknown>;
}

export interface TrackedError {
  id: string;
  timestamp: Date;
  message: string;
  stack?: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  context: Record<string, unknown>;
  fingerprint: string;
  count: number;
}

// ============================================================================
// ERROR STORAGE
// ============================================================================

// In-memory error store (in production, use Redis or database)
const errorStore: Map<string, TrackedError> = new Map();
const MAX_STORED_ERRORS = 1000;
const ERROR_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate error fingerprint for deduplication
 */
function generateFingerprint(error: Error, context: ErrorContext): string {
  const components = [
    error.name,
    error.message.slice(0, 100),
    context.category || 'unknown',
    context.operation || 'unknown',
  ];
  return components.join('|');
}

/**
 * Generate unique error ID
 */
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Classify error into category
 */
function classifyError(error: Error): ErrorCategory {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  if (message.includes('validation') || name.includes('validation')) {
    return ErrorCategory.VALIDATION;
  }
  if (message.includes('unauthorized') || message.includes('authentication')) {
    return ErrorCategory.AUTHENTICATION;
  }
  if (message.includes('forbidden') || message.includes('permission')) {
    return ErrorCategory.AUTHORIZATION;
  }
  if (message.includes('database') || message.includes('prisma') || message.includes('postgres')) {
    return ErrorCategory.DATABASE;
  }
  if (message.includes('timeout') || message.includes('econnrefused')) {
    return ErrorCategory.NETWORK;
  }
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return ErrorCategory.RATE_LIMIT;
  }
  if (message.includes('external') || message.includes('api')) {
    return ErrorCategory.EXTERNAL_SERVICE;
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * Determine error severity based on category and context
 */
function determineSeverity(error: Error, category: ErrorCategory): ErrorSeverity {
  // Critical: Database and auth issues
  if (category === ErrorCategory.DATABASE || category === ErrorCategory.AUTHENTICATION) {
    return ErrorSeverity.HIGH;
  }

  // High: Authorization and external service issues
  if (category === ErrorCategory.AUTHORIZATION || category === ErrorCategory.EXTERNAL_SERVICE) {
    return ErrorSeverity.MEDIUM;
  }

  // Medium: Network and rate limiting
  if (category === ErrorCategory.NETWORK || category === ErrorCategory.RATE_LIMIT) {
    return ErrorSeverity.MEDIUM;
  }

  // Low: Validation errors
  if (category === ErrorCategory.VALIDATION) {
    return ErrorSeverity.LOW;
  }

  return ErrorSeverity.MEDIUM;
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Track an error with context
 */
export function trackError(
  error: Error | unknown,
  context: ErrorContext = {}
): TrackedError {
  const err = error instanceof Error ? error : new Error(String(error));

  // Auto-classify if not provided
  const category = context.category || classifyError(err);
  const severity = context.severity || determineSeverity(err, category);

  // Generate fingerprint for deduplication
  const fingerprint = generateFingerprint(err, { ...context, category });

  // Check for existing error
  const existing = errorStore.get(fingerprint);

  if (existing) {
    existing.count++;
    existing.timestamp = new Date();

    // Log as deduplicated
    logger.warn('Duplicate error tracked', {
      errorId: existing.id,
      message: err.message,
      count: existing.count,
      severity,
      category,
    });

    return existing;
  }

  // Create new tracked error
  const trackedError: TrackedError = {
    id: generateErrorId(),
    timestamp: new Date(),
    message: err.message,
    stack: err.stack,
    severity,
    category,
    context: {
      ...context.metadata,
      userId: context.userId,
      requestId: context.requestId,
      operation: context.operation,
    },
    fingerprint,
    count: 1,
  };

  // Store error
  errorStore.set(fingerprint, trackedError);

  // Enforce max size
  if (errorStore.size > MAX_STORED_ERRORS) {
    cleanupOldErrors();
  }

  // Log the error
  logger.error('Error tracked', {
    errorId: trackedError.id,
    message: err.message,
    stack: err.stack,
    severity,
    category,
    ...trackedError.context,
  });

  // Send to Sentry if critical
  if (severity === ErrorSeverity.CRITICAL || severity === ErrorSeverity.HIGH) {
    // Sentry integration happens automatically via @sentry/nextjs
    // Just ensure the error is properly thrown/logged
  }

  return trackedError;
}

/**
 * Wrapper for async functions with automatic error tracking
 */
export async function withErrorTracking<T>(
  fn: () => Promise<T>,
  context: ErrorContext = {}
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    trackError(error, context);
    throw error;
  }
}

/**
 * Wrapper for sync functions with automatic error tracking
 */
export function withErrorTrackingSync<T>(
  fn: () => T,
  context: ErrorContext = {}
): T {
  try {
    return fn();
  } catch (error) {
    trackError(error, context);
    throw error;
  }
}

/**
 * Clean up old errors from storage
 */
function cleanupOldErrors(): void {
  const now = Date.now();
  const cutoff = now - ERROR_RETENTION_MS;

  for (const [fingerprint, error] of errorStore.entries()) {
    if (error.timestamp.getTime() < cutoff) {
      errorStore.delete(fingerprint);
    }
  }

  // If still too many, remove oldest
  if (errorStore.size > MAX_STORED_ERRORS) {
    const sorted = Array.from(errorStore.entries())
      .sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime());

    const toRemove = sorted.slice(0, errorStore.size - MAX_STORED_ERRORS);
    toRemove.forEach(([fingerprint]) => errorStore.delete(fingerprint));
  }
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get recent errors
 */
export function getRecentErrors(
  count: number = 50,
  filter?: {
    severity?: ErrorSeverity;
    category?: ErrorCategory;
    since?: Date;
  }
): TrackedError[] {
  let errors = Array.from(errorStore.values());

  if (filter?.severity) {
    errors = errors.filter((e) => e.severity === filter.severity);
  }
  if (filter?.category) {
    errors = errors.filter((e) => e.category === filter.category);
  }
  if (filter?.since) {
    errors = errors.filter((e) => e.timestamp >= filter.since);
  }

  return errors
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, count);
}

/**
 * Get error statistics
 */
export function getErrorStats(periodMinutes: number = 60): {
  total: number;
  bySeverity: Record<ErrorSeverity, number>;
  byCategory: Record<ErrorCategory, number>;
  topErrors: Array<{ message: string; count: number }>;
} {
  const since = new Date(Date.now() - periodMinutes * 60 * 1000);
  const errors = getRecentErrors(1000, { since });

  const bySeverity: Record<ErrorSeverity, number> = {
    [ErrorSeverity.LOW]: 0,
    [ErrorSeverity.MEDIUM]: 0,
    [ErrorSeverity.HIGH]: 0,
    [ErrorSeverity.CRITICAL]: 0,
  };

  const byCategory: Record<ErrorCategory, number> = {
    [ErrorCategory.VALIDATION]: 0,
    [ErrorCategory.AUTHENTICATION]: 0,
    [ErrorCategory.AUTHORIZATION]: 0,
    [ErrorCategory.DATABASE]: 0,
    [ErrorCategory.EXTERNAL_SERVICE]: 0,
    [ErrorCategory.NETWORK]: 0,
    [ErrorCategory.RATE_LIMIT]: 0,
    [ErrorCategory.INTERNAL]: 0,
    [ErrorCategory.UNKNOWN]: 0,
  };

  const messageCount = new Map<string, number>();

  for (const error of errors) {
    bySeverity[error.severity]++;
    byCategory[error.category]++;
    messageCount.set(
      error.message,
      (messageCount.get(error.message) || 0) + error.count
    );
  }

  const topErrors = Array.from(messageCount.entries())
    .map(([message, count]) => ({ message: message.slice(0, 100), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    total: errors.reduce((sum, e) => sum + e.count, 0),
    bySeverity,
    byCategory,
    topErrors,
  };
}

/**
 * Clear all tracked errors (for testing)
 */
export function clearTrackedErrors(): void {
  errorStore.clear();
}

export default {
  trackError,
  withErrorTracking,
  withErrorTrackingSync,
  getRecentErrors,
  getErrorStats,
  clearTrackedErrors,
  ErrorSeverity,
  ErrorCategory,
};
