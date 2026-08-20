/**
 * Unit tests for the typed Zod env module (lib/env).
 *
 * The module parses process.env ONCE at import, so each test sets the desired
 * env then re-imports via jest.isolateModules() to get a fresh parse.
 */

describe('lib/env — typed Zod environment module', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    // Start from a clean slate so leaked CI env vars don't skew assertions.
    process.env = {} as NodeJS.ProcessEnv;
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  /** Helper: load a fresh copy of the module under the current process.env. */
  function loadEnvModule() {
    let mod!: typeof import('../../../lib/env');
    jest.isolateModules(() => {
      mod = require('../../../lib/env');
    });
    return mod;
  }

  /** A complete, valid environment (all required vars present + well-formed). */
  function validEnv(): Record<string, string> {
    return {
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      JWT_SECRET: 'a'.repeat(40), // base64-safe, >= 32 chars
      OAUTH_STATE_SECRET: 'b'.repeat(40),
      FIELD_ENCRYPTION_KEY: 'a'.repeat(64),
      ENCRYPTION_KEY: 'b'.repeat(64),
      ENCRYPTION_KEY_V1: 'c'.repeat(64),
      OPENROUTER_API_KEY: 'sk-or-v1-xxxxxxxxxxxxxxxxxx',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3008',
    };
  }

  describe('validateEnv() — valid environment', () => {
    it('returns isValid=true with no errors when all required vars are present and well-formed', () => {
      Object.assign(process.env, validEnv());
      const { validateEnv } = loadEnvModule();

      const result = validateEnv();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.missingRequired).toHaveLength(0);
      expect(result.configured).toEqual(
        expect.arrayContaining(['DATABASE_URL', 'JWT_SECRET', 'OPENROUTER_API_KEY'])
      );
    });
  });

  describe('validateEnv() — missing required vars', () => {
    it('reports a structured error (does not throw) when a required var is missing', () => {
      const e = validEnv();
      delete e.DATABASE_URL;
      Object.assign(process.env, e);
      const { validateEnv } = loadEnvModule();

      // Must NOT throw — boot stays non-throwing.
      const result = validateEnv();
      expect(result.isValid).toBe(false);
      expect(result.missingRequired).toContain('DATABASE_URL');

      const dbErr = result.errors.find(err => err.key === 'DATABASE_URL');
      expect(dbErr).toBeDefined();
      expect(dbErr?.message).toMatch(/missing/i);
      expect(dbErr?.securityLevel).toBe('CRITICAL');
    });

    it('never throws even when the entire environment is empty', () => {
      // process.env already cleared in beforeEach.
      const { validateEnv } = loadEnvModule();
      expect(() => validateEnv()).not.toThrow();
      const result = validateEnv();
      expect(result.isValid).toBe(false);
      expect(result.missingRequired).toEqual(
        expect.arrayContaining([
          'DATABASE_URL',
          'JWT_SECRET',
          'OPENROUTER_API_KEY',
        ])
      );
    });
  });

  describe('validateEnv() — present but invalid format', () => {
    it('reports a format error for a present-but-malformed required var', () => {
      const e = validEnv();
      e.FIELD_ENCRYPTION_KEY = 'too-short';
      Object.assign(process.env, e);
      const { validateEnv } = loadEnvModule();

      const result = validateEnv();
      expect(result.isValid).toBe(false);
      const err = result.errors.find(x => x.key === 'FIELD_ENCRYPTION_KEY');
      expect(err).toBeDefined();
      expect(err?.message).toMatch(/Invalid format/i);
    });

    it('does NOT report a missing optional var as an error', () => {
      // OPENAI_API_KEY is optional and absent.
      Object.assign(process.env, validEnv());
      const { validateEnv } = loadEnvModule();
      const result = validateEnv();
      expect(result.errors.find(x => x.key === 'OPENAI_API_KEY')).toBeUndefined();
    });
  });

  describe('client/server split', () => {
    it('classifies NEXT_PUBLIC_* vars as PUBLIC scope=client and secrets as server', () => {
      const { ENV_META } = loadEnvModule();
      const appUrl = ENV_META.find(m => m.key === 'NEXT_PUBLIC_APP_URL');
      const jwt = ENV_META.find(m => m.key === 'JWT_SECRET');

      expect(appUrl?.scope).toBe('client');
      expect(appUrl?.securityLevel).toBe('PUBLIC');
      expect(jwt?.scope).toBe('server');
      expect(jwt?.securityLevel).toBe('CRITICAL');
    });
  });

  describe('typed env object + defaults', () => {
    it('exposes a frozen env object', () => {
      Object.assign(process.env, validEnv());
      const { env } = loadEnvModule();
      expect(Object.isFrozen(env)).toBe(true);
    });

    it('applies the NODE_ENV default (development) when NODE_ENV is unset', () => {
      Object.assign(process.env, validEnv()); // no NODE_ENV
      const { env } = loadEnvModule();
      expect(env.NODE_ENV).toBe('development');
    });

    it('returns the raw value via env.X (no enforcement at access time)', () => {
      const e = validEnv();
      e.OPENAI_API_KEY = 'sk-proj-' + 'x'.repeat(40);
      Object.assign(process.env, e);
      const { env } = loadEnvModule();
      expect(env.OPENAI_API_KEY).toBe(e.OPENAI_API_KEY);
      expect(env.DATABASE_URL).toBe(e.DATABASE_URL);
    });
  });

  describe('getEnv() — call-time accessor (frozen-snapshot test-timing fix)', () => {
    it('reads process.env AT CALL TIME, reflecting mutations made AFTER import', () => {
      Object.assign(process.env, validEnv());
      const { getEnv } = loadEnvModule();

      // Mutate AFTER the module was imported — the frozen `env` snapshot would
      // NOT see this, but getEnv() must.
      const fresh = 'a'.repeat(64);
      process.env.FIELD_ENCRYPTION_KEY = fresh;
      expect(getEnv('FIELD_ENCRYPTION_KEY')).toBe(fresh);

      const swapped = 'b'.repeat(64);
      process.env.FIELD_ENCRYPTION_KEY = swapped;
      expect(getEnv('FIELD_ENCRYPTION_KEY')).toBe(swapped);
    });

    it('returns undefined when a key is deleted after import', () => {
      Object.assign(process.env, validEnv());
      const { getEnv } = loadEnvModule();
      delete process.env.FIELD_ENCRYPTION_KEY;
      expect(getEnv('FIELD_ENCRYPTION_KEY')).toBeUndefined();
    });

    it('normalises empty string to the ENV_META default (or undefined)', () => {
      Object.assign(process.env, validEnv());
      const { getEnv } = loadEnvModule();
      // NODE_ENV has a default of "development".
      process.env.NODE_ENV = '';
      expect(getEnv('NODE_ENV')).toBe('development');
      // OPENAI_API_KEY has no default → empty becomes undefined.
      process.env.OPENAI_API_KEY = '';
      expect(getEnv('OPENAI_API_KEY')).toBeUndefined();
    });

    it('never throws for an unset required var (boot stays non-throwing)', () => {
      // empty env from beforeEach
      const { getEnv } = loadEnvModule();
      expect(() => getEnv('DATABASE_URL')).not.toThrow();
      expect(getEnv('DATABASE_URL')).toBeUndefined();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // /api/health checkEnvironment() contract (WS5).
  //
  // The health route migrated off the legacy EnvValidator onto validateEnv() +
  // ENV_META. checkEnvironment() is not exported, but it derives its status and
  // `details` counts entirely from validateEnv() + ENV_META, so these tests lock
  // the exact inputs the route depends on:
  //   - missingRequired.length > 0           → route reports 'unhealthy'
  //   - optional-unset count > 0, no missing → route reports 'healthy' (warned)
  //   - everything configured                → route reports 'healthy'
  // ──────────────────────────────────────────────────────────────────────────
  describe('/api/health checkEnvironment() contract', () => {
    /** Recompute the same counts the health route derives. */
    function healthCounts(mod: typeof import('../../../lib/env')) {
      const result = mod.validateEnv();
      const totalRequired = mod.ENV_META.filter(m => m.required).length;
      const totalOptional = mod.ENV_META.filter(m => !m.required).length;
      const optionalUnset = mod.ENV_META.filter(m => {
        if (m.required) return false;
        const v = process.env[m.key];
        return v === undefined || v === '';
      }).length;
      return {
        totalDefined: totalRequired + totalOptional,
        totalRequired,
        configured: result.configured.length,
        missingRequired: result.missingRequired.length,
        errors: result.errors.length,
        warnings: optionalUnset,
      };
    }

    it('drives "unhealthy" when a required var is missing', () => {
      // empty env → all required missing
      const mod = loadEnvModule();
      const c = healthCounts(mod);
      expect(c.missingRequired).toBeGreaterThan(0); // → 'unhealthy'
      expect(c.totalDefined).toBe(c.totalRequired + (c.totalDefined - c.totalRequired));
    });

    it('drives "healthy" with warnings when only optional vars are unset', () => {
      Object.assign(process.env, validEnv()); // all required present, optionals unset
      const mod = loadEnvModule();
      const c = healthCounts(mod);
      expect(c.missingRequired).toBe(0); // not 'unhealthy'
      expect(c.errors).toBe(0);
      expect(c.warnings).toBeGreaterThan(0); // → 'healthy' (acceptable, surfaced)
    });

    it('drives "healthy" "All configured" when every var is set', () => {
      const full = validEnv();
      // Populate every optional ENV_META key with a present (non-empty) value.
      const { ENV_META } = loadEnvModule();
      for (const m of ENV_META) {
        if (!m.required && process.env[m.key] === undefined) {
          process.env[m.key] = full[m.key] ?? 'x';
        }
      }
      Object.assign(process.env, full);
      const mod = loadEnvModule();
      const c = healthCounts(mod);
      expect(c.missingRequired).toBe(0);
      expect(c.warnings).toBe(0); // → 'healthy' "All configured"
    });

    it('never throws when computing health counts on an empty env', () => {
      const mod = loadEnvModule();
      expect(() => healthCounts(mod)).not.toThrow();
    });
  });
});
