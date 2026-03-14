/**
 * Vault Types & Zod Schemas
 *
 * Centralised type definitions for the Vault secrets management system.
 * All API routes and the VaultService validate input through these schemas.
 */

import { z } from 'zod';

// =============================================================================
// Enums
// =============================================================================

export const SECRET_TYPES = [
  'api_key',
  'oauth_token',
  'oauth_refresh_token',
  'env_var',
  'custom',
] as const;

export type SecretType = (typeof SECRET_TYPES)[number];

export const PROVIDERS = [
  'openrouter',
  'anthropic',
  'openai',
  'google',
  'twitter',
  'linkedin',
  'instagram',
  'facebook',
  'tiktok',
  'youtube',
  'pinterest',
  'reddit',
  'threads',
  'searchconsole',
  'googleanalytics',
  'googledrive',
  'stripe',
  'custom',
] as const;

export type Provider = (typeof PROVIDERS)[number];

export const SECRET_SOURCES = [
  'manual',
  'onboarding',
  'oauth_flow',
  'migration',
] as const;

export type SecretSource = (typeof SECRET_SOURCES)[number];

export const VAULT_ACTIONS = [
  'read',
  'create',
  'update',
  'rotate',
  'delete',
  'decrypt',
  'list',
] as const;

export type VaultAction = (typeof VAULT_ACTIONS)[number];

export const ACTOR_TYPES = ['user', 'system', 'workflow'] as const;

export type ActorType = (typeof ACTOR_TYPES)[number];

export const OUTCOMES = ['success', 'failure', 'denied'] as const;

export type Outcome = (typeof OUTCOMES)[number];

// =============================================================================
// Zod Schemas — API Input Validation
// =============================================================================

/** Slug: lowercase alphanumeric + hyphens, 2-100 chars */
const SlugSchema = z
  .string()
  .min(2, 'Slug must be at least 2 characters')
  .max(100, 'Slug must be at most 100 characters')
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Slug must be lowercase alphanumeric with hyphens');

/** Create a new vault secret */
export const CreateSecretSchema = z.object({
  organizationId: z.string().min(1, 'Organisation ID is required'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(200),
  slug: SlugSchema.optional(), // Auto-generated from name if omitted
  secretType: z.enum(SECRET_TYPES),
  provider: z.enum(PROVIDERS).optional(),
  value: z.string().min(1, 'Secret value cannot be empty'),
  description: z.string().max(500).optional(),
  expiresAt: z.string().datetime().optional(), // ISO 8601
  isRotatable: z.boolean().optional().default(false),
});

export type CreateSecretInput = z.infer<typeof CreateSecretSchema>;

/** Rotate a secret's value */
export const RotateSecretSchema = z.object({
  organizationId: z.string().min(1, 'Organisation ID is required'),
  slug: SlugSchema,
  newValue: z.string().min(1, 'New secret value cannot be empty'),
});

export type RotateSecretInput = z.infer<typeof RotateSecretSchema>;

/** Delete (soft-delete) a secret */
export const DeleteSecretSchema = z.object({
  organizationId: z.string().min(1, 'Organisation ID is required'),
  slug: SlugSchema,
});

export type DeleteSecretInput = z.infer<typeof DeleteSecretSchema>;

/** Decrypt a secret (owner-only, heavily audited) */
export const DecryptSecretSchema = z.object({
  organizationId: z.string().min(1, 'Organisation ID is required'),
  slug: SlugSchema,
  reason: z.string().max(500).optional(),
});

export type DecryptSecretInput = z.infer<typeof DecryptSecretSchema>;

/** List query params */
export const ListSecretsQuerySchema = z.object({
  organizationId: z.string().min(1),
  secretType: z.enum(SECRET_TYPES).optional(),
  provider: z.enum(PROVIDERS).optional(),
  includeInactive: z.coerce.boolean().optional().default(false),
});

export type ListSecretsQuery = z.infer<typeof ListSecretsQuerySchema>;

/** Access log query params */
export const AccessLogQuerySchema = z.object({
  organizationId: z.string().min(1),
  vaultSecretId: z.string().optional(),
  action: z.enum(VAULT_ACTIONS).optional(),
  limit: z.coerce.number().min(1).max(200).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type AccessLogQuery = z.infer<typeof AccessLogQuerySchema>;

// =============================================================================
// Output Types — What the API returns (never includes decrypted values)
// =============================================================================

/** Metadata-only representation of a vault secret (safe to return from API) */
export interface VaultSecretOutput {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string | null;
  secretType: string;
  provider: string | null;
  maskedValue: string;
  isActive: boolean;
  isRotatable: boolean;
  expiresAt: string | null;
  lastUsedAt: string | null;
  usageCount: number;
  lastRotatedAt: string | null;
  source: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Access log entry */
export interface VaultAccessLogEntry {
  id: string;
  vaultSecretId: string | null;
  organizationId: string;
  action: string;
  actor: string;
  actorType: string;
  outcome: string;
  ipAddress: string | null;
  userAgent: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

// =============================================================================
// Internal Types — Used by VaultService (not exposed via API)
// =============================================================================

/** Actor context for audit logging */
export interface VaultActor {
  id: string;
  type: ActorType;
  ipAddress?: string;
  userAgent?: string;
}

/** Internal create input (after slug generation + encryption) */
export interface VaultCreateParams {
  organizationId: string;
  name: string;
  slug: string;
  description?: string;
  secretType: string;
  provider?: string;
  encryptedValue: string;
  maskedValue: string;
  expiresAt?: Date;
  isRotatable: boolean;
  source: SecretSource;
  createdBy?: string;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Generate a URL-safe slug from a human-readable name.
 *
 * @example slugify("OpenRouter API Key") → "openrouter-api-key"
 * @example slugify("Twitter OAuth Token") → "twitter-oauth-token"
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}
