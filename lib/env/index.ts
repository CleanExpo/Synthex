/**
 * Typed, Zod-validated environment module — single source of truth for env access.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS MODULE EXISTS
 * Env access used to be scattered across `lib/security/env-validator.ts` (a
 * custom EnvValidator) plus hundreds of ad-hoc `process.env.X` reads. This module
 * consolidates the schema onto a single typed Zod definition that parses
 * `process.env` ONCE and exposes a frozen, typed `env` object plus a structured
 * `validateEnv()`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HARD CONSTRAINTS (do not break these)
 *
 * 1. EDGE-SAFE. This module is reachable from `instrumentation.ts`, which Next.js
 *    compiles for BOTH the Node.js and Edge runtimes. It MUST NOT import any
 *    node-only module (`crypto`, `pg`, prisma, fs, …). It imports ONLY `zod`
 *    (isomorphic) and `@/lib/logger` (console wrappers — edge-safe). Keep it that
 *    way: the `DATABASE_URL="" npm run build:vercel` edge build is the trap.
 *
 * 2. NEVER THROW AT IMPORT. Parsing uses `.safeParse` and every field is
 *    optional at the Zod layer, so a missing/invalid required var degrades to a
 *    structured error rather than a thrown exception. This preserves the
 *    Lambda-cold-start rule from instrumentation.ts: `register()` must never
 *    throw or the Lambda dies before handling any request (Phase 114-02).
 *    "Log loudly, don't crash" — same semantics as the old EnvValidator.
 *
 * 3. BEHAVIOUR PRESERVED. The required/optional split, the security levels, and
 *    the format rules below are ported 1:1 from `lib/security/env-validator.ts`.
 *    `validateEnv()` returns the same structured-error shape that
 *    `instrumentation.ts` already consumes, so the wiring is a drop-in.
 *
 * NOTE on OAUTH_STATE_SECRET: it is derived from JWT_SECRET in instrumentation.ts
 * (async, via Web Crypto) BEFORE this module's `validateEnv()` runs, so by the
 * time we read `process.env.OAUTH_STATE_SECRET` it is already populated. We do
 * not re-derive it here (that would require crypto and break edge-safety).
 */

import { z } from 'zod';

/** Security classification — mirrors lib/security/env-validator.ts. */
export enum SecurityLevel {
  PUBLIC = 'PUBLIC', // Safe for client-side (NEXT_PUBLIC_*)
  INTERNAL = 'INTERNAL', // Server-side only
  SECRET = 'SECRET', // Sensitive (API keys, passwords)
  CRITICAL = 'CRITICAL', // Highly sensitive (DB URLs, encryption keys)
}

// ============================================================================
// SERVER SCHEMA (never exposed to the client)
// ============================================================================
// Every field is `.optional()` so a missing required var does NOT throw at parse
// time. `validateEnv()` enforces the required-ness separately and reports it as a
// structured error. This is the "never throw at import" rule in code form.

const serverSchema = z.object({
  // ── Database (CRITICAL) ────────────────────────────────────────────────
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL cannot be empty')
    .regex(
      /^(prisma\+)?postgres(ql)?:\/\/.+/,
      'Invalid PostgreSQL connection string format'
    )
    .optional(),
  DIRECT_URL: z
    .string()
    .regex(
      /^(prisma\+)?postgres(ql)?:\/\/.+/,
      'Invalid PostgreSQL connection string format'
    )
    .optional(),

  // ── Auth / signing secrets (CRITICAL) ──────────────────────────────────
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters')
    .regex(/^[A-Za-z0-9+/=]+$/, 'JWT_SECRET must be base64 encoded')
    .optional(),
  OAUTH_STATE_SECRET: z
    .string()
    .min(32, 'OAUTH_STATE_SECRET must be at least 32 characters')
    .regex(
      /^[A-Za-z0-9+/=_-]+$/,
      'OAUTH_STATE_SECRET must contain only base64 characters'
    )
    .optional(),

  // ── Encryption keys (CRITICAL) — three non-interchangeable keys ─────────
  FIELD_ENCRYPTION_KEY: z
    .string()
    .length(
      64,
      'FIELD_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)'
    )
    .regex(/^[A-Fa-f0-9]+$/, 'FIELD_ENCRYPTION_KEY must be valid hex encoding')
    .refine(
      v => !/^0+$/.test(v),
      'FIELD_ENCRYPTION_KEY is all zeros — generate a real key: openssl rand -hex 32'
    )
    .optional(),
  ENCRYPTION_KEY: z
    .string()
    .length(64, 'ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)')
    .regex(/^[A-Fa-f0-9]+$/, 'ENCRYPTION_KEY must be valid hex encoding')
    .refine(
      v => !/^0+$/.test(v),
      'ENCRYPTION_KEY is all zeros — generate a real key: openssl rand -hex 32'
    )
    .optional(),
  ENCRYPTION_KEY_V1: z
    .string()
    .length(
      64,
      'ENCRYPTION_KEY_V1 must be exactly 64 hex characters (32 bytes)'
    )
    .regex(/^[A-Fa-f0-9]+$/, 'ENCRYPTION_KEY_V1 must be valid hex encoding')
    .refine(
      v => !/^0+$/.test(v),
      'ENCRYPTION_KEY_V1 is all zeros — generate a real key: openssl rand -hex 32'
    )
    .optional(),

  // ── AI / LLM (SECRET) ──────────────────────────────────────────────────
  OPENROUTER_API_KEY: z
    .string()
    .min(20)
    .regex(/^sk-or-/, 'Must start with sk-or-')
    .optional(),
  OPENAI_API_KEY: z
    .string()
    .regex(
      /^sk-(proj-|svcacct-)?[A-Za-z0-9_-]{20,}$/,
      'Invalid OpenAI API key format. Must start with sk-, sk-proj-, or sk-svcacct-'
    )
    .optional(),
  ANTHROPIC_API_KEY: z
    .string()
    .regex(/^sk-ant-/, 'Must start with sk-ant-')
    .optional(),

  // ── Application config (INTERNAL) ──────────────────────────────────────
  NODE_ENV: z.enum(['development', 'test', 'production']).optional(),
  OWNER_EMAILS: z.string().optional(),

  // ── Alerting (INTERNAL, optional) ──────────────────────────────────────
  ALERT_SLACK_WEBHOOK_URL: z.string().url().optional(),
});

// ============================================================================
// CLIENT SCHEMA (NEXT_PUBLIC_* — safe to ship to the browser)
// ============================================================================

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

// ============================================================================
// METADATA — the single source of truth for required-ness / security level.
// Kept as a plain table (not Zod internals) so validateEnv() can reason about it
// edge-safely without reflecting on the schema shape.
// ============================================================================

interface EnvMeta {
  key: string;
  required: boolean;
  securityLevel: SecurityLevel;
  scope: 'server' | 'client';
  /** Optional default applied by `env` when the var is unset. */
  defaultValue?: string;
}

export const ENV_META: readonly EnvMeta[] = [
  // server — required
  {
    key: 'DATABASE_URL',
    required: true,
    securityLevel: SecurityLevel.CRITICAL,
    scope: 'server',
  },
  {
    key: 'JWT_SECRET',
    required: true,
    securityLevel: SecurityLevel.CRITICAL,
    scope: 'server',
  },
  {
    key: 'OAUTH_STATE_SECRET',
    required: true,
    securityLevel: SecurityLevel.CRITICAL,
    scope: 'server',
  },
  {
    key: 'FIELD_ENCRYPTION_KEY',
    required: true,
    securityLevel: SecurityLevel.CRITICAL,
    scope: 'server',
  },
  {
    key: 'ENCRYPTION_KEY',
    required: true,
    securityLevel: SecurityLevel.CRITICAL,
    scope: 'server',
  },
  {
    key: 'ENCRYPTION_KEY_V1',
    required: true,
    securityLevel: SecurityLevel.CRITICAL,
    scope: 'server',
  },
  {
    key: 'OPENROUTER_API_KEY',
    required: true,
    securityLevel: SecurityLevel.SECRET,
    scope: 'server',
  },
  // server — optional
  {
    key: 'DIRECT_URL',
    required: false,
    securityLevel: SecurityLevel.CRITICAL,
    scope: 'server',
  },
  {
    key: 'OPENAI_API_KEY',
    required: false,
    securityLevel: SecurityLevel.SECRET,
    scope: 'server',
  },
  {
    key: 'ANTHROPIC_API_KEY',
    required: false,
    securityLevel: SecurityLevel.SECRET,
    scope: 'server',
  },
  {
    key: 'NODE_ENV',
    required: false,
    securityLevel: SecurityLevel.INTERNAL,
    scope: 'server',
    defaultValue: 'development',
  },
  {
    key: 'OWNER_EMAILS',
    required: false,
    securityLevel: SecurityLevel.INTERNAL,
    scope: 'server',
  },
  {
    key: 'ALERT_SLACK_WEBHOOK_URL',
    required: false,
    securityLevel: SecurityLevel.INTERNAL,
    scope: 'server',
  },
  // client — optional
  {
    key: 'NEXT_PUBLIC_APP_URL',
    required: false,
    securityLevel: SecurityLevel.PUBLIC,
    scope: 'client',
  },
] as const;

// ============================================================================
// STRUCTURED VALIDATION RESULT — shape mirrors lib/security/env-validator.ts so
// instrumentation.ts can consume it without changing its branching.
// ============================================================================

export interface EnvValidationError {
  key: string;
  message: string;
  securityLevel: SecurityLevel;
  suggestion?: string;
}

export interface EnvValidationResult {
  isValid: boolean;
  errors: EnvValidationError[];
  /** Required keys that are missing or invalid. */
  missingRequired: string[];
  /** Keys present and valid. */
  configured: string[];
}

// ============================================================================
// PARSE ONCE — frozen typed env object.
// ============================================================================

const rawServer = serverSchema.safeParse(process.env);
const rawClient = clientSchema.safeParse(process.env);

/**
 * Build the typed env object. We re-read each known key from `process.env`
 * directly (applying defaults from ENV_META) rather than trusting safeParse's
 * stripped output, so that a value that FAILED format validation is still
 * surfaced to consumers exactly as the old `process.env.X` read did — preserving
 * runtime behaviour. validateEnv() is the place that reports format failures.
 */
type ServerEnv = z.infer<typeof serverSchema>;
type ClientEnv = z.infer<typeof clientSchema>;
export type Env = ServerEnv & ClientEnv;

function buildEnv(): Env {
  const out: Record<string, string | undefined> = {};
  for (const meta of ENV_META) {
    const v = process.env[meta.key];
    out[meta.key] = v !== undefined && v !== '' ? v : meta.defaultValue;
  }
  return Object.freeze(out) as unknown as Env;
}

/**
 * The single, typed, frozen source of truth for env access.
 *
 * Reads return the raw string value (with ENV_META defaults applied). Format
 * validity is reported by `validateEnv()`, never enforced at access time — so
 * swapping a `process.env.X` read for `env.X` never changes runtime behaviour.
 *
 * SNAPSHOT SEMANTICS: `env` is built ONCE at import time. Use it for modules
 * whose env is fixed for the process lifetime (the common case). For consumers
 * exercised by tests that mutate `process.env` AFTER import — encryption-key
 * self-tests, db/platform client factories — use `getEnv()` below, which reads
 * through `process.env` at call time.
 */
export const env: Env = buildEnv();

/** Quick lookup of ENV_META by key for default application in `getEnv()`. */
const META_BY_KEY = new Map(ENV_META.map(m => [m.key, m]));

/**
 * Call-time typed env accessor — reads `process.env[key]` at the moment of the
 * call, applying the same ENV_META default + empty-string normalisation as the
 * frozen `env` object.
 *
 * WHY THIS EXISTS (the frozen-snapshot test-timing caveat): the `env` object is
 * a snapshot frozen at module import. Many unit tests set `process.env.X` AFTER
 * importing the consumer (e.g. encryption-keys.test.ts swaps FIELD_ENCRYPTION_KEY
 * between cases without re-importing). Such consumers MUST read through at call
 * time or the snapshot would mask the test's mutation. `getEnv()` gives those
 * consumers a typed accessor that preserves the existing `process.env.X` runtime
 * semantics exactly — same value, same defaults, same undefined-on-empty — while
 * routing env truth through this single module.
 *
 * Edge-safe: zod-only, no node imports, never throws.
 */
export function getEnv<K extends keyof Env>(key: K): Env[K] {
  const v = process.env[key as string];
  if (v !== undefined && v !== '') return v as Env[K];
  return META_BY_KEY.get(key as string)?.defaultValue as Env[K];
}

// ============================================================================
// validateEnv() — structured, never-throwing validation.
// ============================================================================

/** Map a parsed safeParse result into a quick lookup of failed keys → message. */
function indexIssues(
  result: z.ZodSafeParseResult<unknown>
): Map<string, string> {
  const map = new Map<string, string>();
  if (result.success) return map;
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? '');
    if (key && !map.has(key)) map.set(key, issue.message);
  }
  return map;
}

/**
 * Validate the environment. NEVER throws — returns a structured result.
 *
 * Rules (ported from EnvValidator):
 *  - A required var that is missing → error.
 *  - Any var (required or optional) that is PRESENT but fails its format → error.
 *  - A missing optional var is fine (not reported as an error).
 */
export function validateEnv(): EnvValidationResult {
  const serverIssues = indexIssues(rawServer);
  const clientIssues = indexIssues(rawClient);

  const errors: EnvValidationError[] = [];
  const missingRequired: string[] = [];
  const configured: string[] = [];

  for (const meta of ENV_META) {
    const value = process.env[meta.key];
    const present = value !== undefined && value !== '';
    const issue =
      meta.scope === 'server'
        ? serverIssues.get(meta.key)
        : clientIssues.get(meta.key);

    if (!present) {
      if (meta.required) {
        missingRequired.push(meta.key);
        errors.push({
          key: meta.key,
          message: `Required env var ${meta.key} is missing`,
          securityLevel: meta.securityLevel,
          suggestion: `Set ${meta.key} in your environment`,
        });
      }
      continue;
    }

    if (issue) {
      errors.push({
        key: meta.key,
        message: `Invalid format for ${meta.key}: ${issue}`,
        securityLevel: meta.securityLevel,
      });
      if (meta.required) missingRequired.push(meta.key);
      continue;
    }

    configured.push(meta.key);
  }

  return {
    isValid: errors.length === 0,
    errors,
    missingRequired,
    configured,
  };
}
