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
      NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJ' + 'x'.repeat(40),
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
      // All 7 server-required + 2 client-required = 9 missing.
      expect(result.missingRequired).toEqual(
        expect.arrayContaining([
          'DATABASE_URL',
          'JWT_SECRET',
          'NEXT_PUBLIC_SUPABASE_URL',
          'NEXT_PUBLIC_SUPABASE_ANON_KEY',
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
      const supaUrl = ENV_META.find(m => m.key === 'NEXT_PUBLIC_SUPABASE_URL');
      const jwt = ENV_META.find(m => m.key === 'JWT_SECRET');

      expect(supaUrl?.scope).toBe('client');
      expect(supaUrl?.securityLevel).toBe('PUBLIC');
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
      // SUPABASE_SERVICE_ROLE_KEY has no default → empty becomes undefined.
      process.env.SUPABASE_SERVICE_ROLE_KEY = '';
      expect(getEnv('SUPABASE_SERVICE_ROLE_KEY')).toBeUndefined();
    });

    it('never throws for an unset required var (boot stays non-throwing)', () => {
      // empty env from beforeEach
      const { getEnv } = loadEnvModule();
      expect(() => getEnv('DATABASE_URL')).not.toThrow();
      expect(getEnv('DATABASE_URL')).toBeUndefined();
    });
  });
});
