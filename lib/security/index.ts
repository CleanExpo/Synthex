/**
 * Security Module Exports
 *
 * @description Centralized exports for all security components
 */

// Rate Limiting (consolidated module)
export {
  RateLimiter,
  createRateLimiter,
  withRateLimit,
  rateLimiters,
  PRESET_CONFIG,
  type RateLimitConfig,
  type RateLimitResult,
  type RateLimitHeaders,
} from '@/lib/rate-limit';

// Audit Logging
export {
  auditLogger,
  type AuditEvent,
  type AuditCategory,
  type AuditSeverity,
  type AuditOutcome,
  type AuditQuery,
} from './audit-logger';

// CORS
export {
  CorsValidator,
  corsValidator,
  applyCorsHeaders,
  createPreflightResponse,
  DEFAULT_CORS_CONFIG,
  STRICT_CORS_CONFIG,
  PUBLIC_CORS_CONFIG,
  type CorsConfig,
  type CorsResult,
} from './cors-config';

// Environment Validation
export { envValidator, EnvValidator } from './env-validator';

// API Security
export {
  APISecurityChecker,
  DEFAULT_POLICIES,
  type SecurityPolicy,
} from './api-security-checker';
