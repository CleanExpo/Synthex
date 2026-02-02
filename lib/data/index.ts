/**
 * Data Module
 * Data validation, migration tracking, and integrity utilities
 *
 * @task UNI-431 - Data Migration & Integrity Epic
 *
 * @example
 * ```typescript
 * import {
 *   validateUser,
 *   validateCampaign,
 *   migrationTracker,
 *   createDataSnapshot,
 * } from '@/lib/data';
 * ```
 */

// Validators
export {
  // Validation functions
  validateUser,
  validateCampaign,
  validatePost,
  validateQuote,
  validateProject,
  validatePlatformConnection,
  validateBatch,
  // Sanitization
  sanitizeString,
  sanitizeEmail,
  sanitizeUrl,
  sanitizeStringArray,
  // Schemas
  schemas,
  userSchema,
  campaignSchema,
  postSchema,
  quoteSchema,
  projectSchema,
  platformConnectionSchema,
  // Integrity
  validateReference,
  integrityChecks,
  // Types
  type User,
  type Campaign,
  type Post,
  type Quote,
  type Project,
  type PlatformConnection,
  type ValidationError,
  type ValidationResult,
  type BatchValidationResult,
} from './validators';

// Migration tracking
export {
  MigrationTracker,
  migrationTracker,
  createRollbackPlan,
  executeRollback,
  createDataSnapshot,
  compareSnapshots,
  type Migration,
  type MigrationStep,
  type MigrationSummary,
  type RollbackPlan,
  type RollbackStep,
  type DataSnapshot,
} from './migration-tracker';
