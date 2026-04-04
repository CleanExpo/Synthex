/**
 * Environment Variable Check Utility
 *
 * Lightweight startup validator for environment variables. Complements the
 * full schema-based EnvValidator at `lib/security/env-validator.ts` with a
 * simpler, dependency-free interface suited for early-boot checks and admin
 * status APIs.
 *
 * Three tiers:
 *   REQUIRED    — App cannot function; throw in production if missing.
 *   RECOMMENDED — Important features degrade; warn but never throw.
 *   OPTIONAL    — Nice-to-have integrations; log info only.
 *
 * @module lib/env-check
 */

// ---------------------------------------------------------------------------
// Variable lists
// ---------------------------------------------------------------------------

/**
 * Variables that must be present for the application to boot correctly.
 * Missing any of these in production will throw an Error.
 */
const REQUIRED_VARS = ['DATABASE_URL', 'JWT_SECRET'] as const;

/**
 * Variables that enable important functionality. Their absence degrades the
 * product but does not prevent the app from starting.
 */
const RECOMMENDED_VARS = [
  'OPENROUTER_API_KEY',
  'FIELD_ENCRYPTION_KEY',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'CRON_SECRET',
] as const;

/**
 * Variables for optional third-party integrations. Logged at info level only.
 */
const OPTIONAL_VARS = [
  'STRIPE_SECRET_KEY',
  'RESEND_API_KEY',
  'SENDGRID_API_KEY',
  'TWITTER_CLIENT_ID',
  'LINKEDIN_CLIENT_ID',
  'FACEBOOK_APP_ID',
  'TIKTOK_CLIENT_KEY',
  'INSTAGRAM_CLIENT_ID',
] as const;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Narrowed union of all known variable names. */
export type RequiredVar = (typeof REQUIRED_VARS)[number];
export type RecommendedVar = (typeof RECOMMENDED_VARS)[number];
export type OptionalVar = (typeof OPTIONAL_VARS)[number];

/** Return type of `validateEnvironment`. */
export interface ValidationOutcome {
  /** True when every REQUIRED variable is present and non-empty. */
  valid: boolean;
  /** Names of REQUIRED variables that are absent or empty. */
  missing: string[];
  /** Human-readable warning messages for RECOMMENDED variables. */
  warnings: string[];
}

/** Summary object returned by `getEnvStatus` for admin/API consumption. */
export interface EnvStatus {
  /** 'ok' when all REQUIRED vars are present, 'missing' otherwise. */
  required: 'ok' | 'missing';
  /** Names of missing REQUIRED variables. */
  missingRequired: string[];
  /** Warning strings for absent RECOMMENDED variables. */
  warnings: string[];
  /** Which OPTIONAL variables are configured (names only, no values). */
  configuredOptional: string[];
  /** Which OPTIONAL variables are absent. */
  missingOptional: string[];
  /** ISO-8601 timestamp of when this status was generated. */
  checkedAt: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when a variable is present in `process.env` and non-empty
 * after trimming whitespace.
 */
function isDefined(key: string): boolean {
  const value = process.env[key];
  return typeof value === 'string' && value.trim().length > 0;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validates the environment variable state at startup.
 *
 * - Checks every REQUIRED variable for presence and non-empty value.
 * - Emits `console.warn` for each absent RECOMMENDED variable.
 * - In production (`NODE_ENV === 'production'`), throws an `Error` if any
 *   REQUIRED variable is missing.
 * - In all other environments, logs warnings and returns without throwing.
 *
 * @returns `ValidationOutcome` describing the full check result.
 * @throws `Error` in production when one or more REQUIRED vars are absent.
 */
export function validateEnvironment(): ValidationOutcome {
  const isProduction = process.env['NODE_ENV'] === 'production';
  const missing: string[] = [];
  const warnings: string[] = [];

  // -- Required vars --------------------------------------------------------
  for (const key of REQUIRED_VARS) {
    if (!isDefined(key)) {
      missing.push(key);

      if (isProduction) {
        // Emit before throwing so the log is always visible.
        console.warn(`[ENV] MISSING required variable: ${key}`);
      } else {
        console.warn(`[ENV] WARNING Missing required variable: ${key}`);
      }
    }
  }

  // -- Recommended vars -----------------------------------------------------
  for (const key of RECOMMENDED_VARS) {
    if (!isDefined(key)) {
      const message = `Missing recommended: ${key}`;
      warnings.push(message);
      console.warn(`[ENV] WARNING ${message}`);
    }
  }

  // -- Optional vars (info only) --------------------------------------------
  for (const key of OPTIONAL_VARS) {
    if (!isDefined(key)) {
      console.info(`[ENV] INFO Optional variable not configured: ${key}`);
    }
  }

  const valid = missing.length === 0;

  // Throw in production so the process fails fast with a clear error.
  if (!valid && isProduction) {
    throw new Error(
      `[ENV] Production startup aborted. Missing required environment variable(s): ${missing.join(', ')}`
    );
  }

  return { valid, missing, warnings };
}

/**
 * Returns a snapshot of the current environment variable status.
 *
 * Designed to be consumed by admin/health API routes. Never includes values —
 * only variable names and aggregate state.
 *
 * This function never throws; it is safe to call in any context.
 */
export function getEnvStatus(): EnvStatus {
  const missingRequired: string[] = [];
  const warnings: string[] = [];
  const configuredOptional: string[] = [];
  const missingOptional: string[] = [];

  for (const key of REQUIRED_VARS) {
    if (!isDefined(key)) {
      missingRequired.push(key);
    }
  }

  for (const key of RECOMMENDED_VARS) {
    if (!isDefined(key)) {
      warnings.push(`Missing recommended: ${key}`);
    }
  }

  for (const key of OPTIONAL_VARS) {
    if (isDefined(key)) {
      configuredOptional.push(key);
    } else {
      missingOptional.push(key);
    }
  }

  return {
    required: missingRequired.length === 0 ? 'ok' : 'missing',
    missingRequired,
    warnings,
    configuredOptional,
    missingOptional,
    checkedAt: new Date().toISOString(),
  };
}
