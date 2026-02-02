/**
 * Data Validation Module
 * Type-safe validation utilities for database operations
 *
 * @task UNI-431 - Data Migration & Integrity Epic
 *
 * Usage:
 * ```typescript
 * import { validateUser, validateCampaign, ValidationError } from '@/lib/data/validators';
 *
 * const result = validateUser(data);
 * if (!result.valid) {
 *   console.log(result.errors);
 * }
 * ```
 */

import { z } from 'zod';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

/**
 * User validation schema
 */
export const userSchema = z.object({
  id: z.string().cuid().optional(),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  name: z.string().min(1).max(100).optional(),
  authProvider: z.enum(['local', 'google']).default('local'),
  emailVerified: z.boolean().default(false),
  preferences: z.record(z.unknown()).optional(),
});

/**
 * Campaign validation schema
 */
export const campaignSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().min(1, 'Campaign name is required').max(200),
  description: z.string().max(2000).optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'archived']).default('draft'),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  budget: z.number().min(0).optional(),
  goals: z.record(z.unknown()).optional(),
  userId: z.string().cuid('Invalid user ID'),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.endDate > data.startDate;
    }
    return true;
  },
  { message: 'End date must be after start date', path: ['endDate'] }
);

/**
 * Post validation schema
 */
export const postSchema = z.object({
  id: z.string().cuid().optional(),
  content: z.string().min(1, 'Content is required').max(5000),
  platform: z.enum(['twitter', 'instagram', 'facebook', 'linkedin', 'tiktok']),
  status: z.enum(['draft', 'scheduled', 'published', 'failed', 'archived']).default('draft'),
  scheduledAt: z.coerce.date().optional(),
  publishedAt: z.coerce.date().optional(),
  campaignId: z.string().cuid('Invalid campaign ID'),
  mediaUrls: z.array(z.string().url()).max(10).optional(),
  hashtags: z.array(z.string()).max(30).optional(),
});

/**
 * Quote validation schema
 */
export const quoteSchema = z.object({
  id: z.string().cuid().optional(),
  content: z.string().min(1, 'Content is required').max(1000),
  author: z.string().min(1).max(200).optional(),
  source: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  aiGenerated: z.boolean().default(false),
  usageCount: z.number().int().min(0).default(0),
  expiresAt: z.coerce.date().optional(),
});

/**
 * Project validation schema
 */
export const projectSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().min(1, 'Project name is required').max(200),
  description: z.string().max(2000).optional(),
  status: z.enum(['active', 'paused', 'completed', 'archived']).default('active'),
  settings: z.record(z.unknown()).optional(),
  userId: z.string().cuid('Invalid user ID'),
});

/**
 * Platform connection validation schema
 */
export const platformConnectionSchema = z.object({
  id: z.string().cuid().optional(),
  platform: z.enum(['twitter', 'instagram', 'facebook', 'linkedin', 'tiktok']),
  accountId: z.string().min(1, 'Account ID is required'),
  accountName: z.string().optional(),
  accessToken: z.string().min(1, 'Access token is required'),
  refreshToken: z.string().optional(),
  expiresAt: z.coerce.date().optional(),
  isActive: z.boolean().default(true),
  userId: z.string().cuid('Invalid user ID'),
});

// ============================================================================
// VALIDATION TYPES
// ============================================================================

export type User = z.infer<typeof userSchema>;
export type Campaign = z.infer<typeof campaignSchema>;
export type Post = z.infer<typeof postSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export type Project = z.infer<typeof projectSchema>;
export type PlatformConnection = z.infer<typeof platformConnectionSchema>;

// ============================================================================
// VALIDATION RESULT TYPES
// ============================================================================

export interface ValidationError {
  path: (string | number)[];
  message: string;
  code: string;
}

export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  errors: ValidationError[];
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Generic validation function
 */
function validate<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return {
      valid: true,
      data: result.data,
      errors: [],
    };
  }

  return {
    valid: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path,
      message: issue.message,
      code: issue.code,
    })),
  };
}

/**
 * Validate user data
 */
export function validateUser(data: unknown): ValidationResult<User> {
  return validate(userSchema, data);
}

/**
 * Validate campaign data
 */
export function validateCampaign(data: unknown): ValidationResult<Campaign> {
  return validate(campaignSchema, data);
}

/**
 * Validate post data
 */
export function validatePost(data: unknown): ValidationResult<Post> {
  return validate(postSchema, data);
}

/**
 * Validate quote data
 */
export function validateQuote(data: unknown): ValidationResult<Quote> {
  return validate(quoteSchema, data);
}

/**
 * Validate project data
 */
export function validateProject(data: unknown): ValidationResult<Project> {
  return validate(projectSchema, data);
}

/**
 * Validate platform connection data
 */
export function validatePlatformConnection(data: unknown): ValidationResult<PlatformConnection> {
  return validate(platformConnectionSchema, data);
}

// ============================================================================
// BATCH VALIDATION
// ============================================================================

export interface BatchValidationResult<T> {
  valid: T[];
  invalid: Array<{ index: number; data: unknown; errors: ValidationError[] }>;
  stats: {
    total: number;
    valid: number;
    invalid: number;
  };
}

/**
 * Validate an array of items
 */
export function validateBatch<T>(
  schema: z.ZodSchema<T>,
  items: unknown[]
): BatchValidationResult<T> {
  const valid: T[] = [];
  const invalid: Array<{ index: number; data: unknown; errors: ValidationError[] }> = [];

  items.forEach((item, index) => {
    const result = validate(schema, item);
    if (result.valid && result.data) {
      valid.push(result.data);
    } else {
      invalid.push({ index, data: item, errors: result.errors });
    }
  });

  return {
    valid,
    invalid,
    stats: {
      total: items.length,
      valid: valid.length,
      invalid: invalid.length,
    },
  };
}

// ============================================================================
// SANITIZATION UTILITIES
// ============================================================================

/**
 * Sanitize string input (trim and remove null bytes)
 */
export function sanitizeString(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined;
  return input.trim().replace(/\0/g, '');
}

/**
 * Sanitize email (lowercase and trim)
 */
export function sanitizeEmail(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined;
  return input.trim().toLowerCase();
}

/**
 * Sanitize and validate URL
 */
export function sanitizeUrl(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined;
  try {
    const url = new URL(input.trim());
    return url.toString();
  } catch {
    return undefined;
  }
}

/**
 * Sanitize array of strings
 */
export function sanitizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

// ============================================================================
// INTEGRITY CHECKS
// ============================================================================

/**
 * Check referential integrity for a record
 */
export interface IntegrityCheck {
  table: string;
  field: string;
  referencedTable: string;
  referencedField: string;
}

export const integrityChecks: IntegrityCheck[] = [
  { table: 'campaigns', field: 'userId', referencedTable: 'users', referencedField: 'id' },
  { table: 'posts', field: 'campaignId', referencedTable: 'campaigns', referencedField: 'id' },
  { table: 'projects', field: 'userId', referencedTable: 'users', referencedField: 'id' },
  { table: 'platformConnections', field: 'userId', referencedTable: 'users', referencedField: 'id' },
  { table: 'notifications', field: 'userId', referencedTable: 'users', referencedField: 'id' },
  { table: 'sessions', field: 'userId', referencedTable: 'users', referencedField: 'id' },
];

/**
 * Validate that a reference exists
 */
export async function validateReference(
  prisma: any,
  table: string,
  id: string
): Promise<boolean> {
  try {
    const record = await prisma[table].findUnique({
      where: { id },
      select: { id: true },
    });
    return record !== null;
  } catch {
    return false;
  }
}

// ============================================================================
// EXPORT SCHEMAS FOR REUSE
// ============================================================================

export const schemas = {
  user: userSchema,
  campaign: campaignSchema,
  post: postSchema,
  quote: quoteSchema,
  project: projectSchema,
  platformConnection: platformConnectionSchema,
};

export default {
  validateUser,
  validateCampaign,
  validatePost,
  validateQuote,
  validateProject,
  validatePlatformConnection,
  validateBatch,
  sanitizeString,
  sanitizeEmail,
  sanitizeUrl,
  sanitizeStringArray,
  schemas,
};
