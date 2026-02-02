/**
 * Observability Module
 * Error tracking, health monitoring, and system observability
 *
 * @task UNI-423 - Monitoring & Observability Epic
 *
 * @example
 * ```typescript
 * import {
 *   trackError,
 *   getSystemHealth,
 *   ErrorSeverity,
 * } from '@/lib/observability';
 * ```
 */

// Error tracking
export {
  trackError,
  withErrorTracking,
  withErrorTrackingSync,
  getRecentErrors,
  getErrorStats,
  clearTrackedErrors,
  ErrorSeverity,
  ErrorCategory,
  type ErrorContext,
  type TrackedError,
} from './error-tracker';

// Health dashboard
export {
  getSystemHealth,
  getQuickHealth,
  formatUptime,
  type HealthStatus,
  type ComponentHealth,
  type SystemHealth,
} from './health-dashboard';
