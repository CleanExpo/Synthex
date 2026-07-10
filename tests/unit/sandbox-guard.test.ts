/**
 * Unit tests for the SYN-MCP-000 sandbox connection guards.
 *
 * These run in the normal unit profile (no containers needed) and pin the
 * behaviour that keeps the integration profile from ever touching a real
 * database or Redis: only URLs on the sandbox ports (5499 / 6399) pass.
 */

import {
  assertSandboxDatabaseUrl,
  assertSandboxRedisUrl,
  DEFAULT_SANDBOX_DATABASE_URL,
  DEFAULT_SANDBOX_REDIS_URL,
  redact,
} from '../integration/setup/sandbox-guard';

describe('sandbox-guard', () => {
  describe('assertSandboxDatabaseUrl', () => {
    it('accepts the default sandbox URL', () => {
      expect(assertSandboxDatabaseUrl(DEFAULT_SANDBOX_DATABASE_URL)).toBe(
        DEFAULT_SANDBOX_DATABASE_URL
      );
    });

    it('accepts any host as long as the port is 5499', () => {
      const url = 'postgresql://postgres:test@127.0.0.1:5499/synthex_test';
      expect(assertSandboxDatabaseUrl(url)).toBe(url);
    });

    it('rejects an unset URL', () => {
      expect(() => assertSandboxDatabaseUrl(undefined)).toThrow(
        /REFUSING TO RUN/
      );
      expect(() => assertSandboxDatabaseUrl('')).toThrow(/REFUSING TO RUN/);
    });

    it('rejects a default-port (5432) URL', () => {
      expect(() =>
        assertSandboxDatabaseUrl('postgres://u:p@localhost:5432/synthex_test')
      ).toThrow(/5499/);
    });

    it('rejects prod-shaped URLs (Supabase pooler ports)', () => {
      expect(() =>
        assertSandboxDatabaseUrl(
          'postgres://user:secret@db.example.supabase.co:6543/postgres?pgbouncer=true'
        )
      ).toThrow(/REFUSING TO RUN/);
    });

    it('rejects a URL where 5499 is not the port segment', () => {
      // Port is 5432; "5499" only appears in the database name.
      expect(() =>
        assertSandboxDatabaseUrl('postgres://u:p@localhost:5432/db5499')
      ).toThrow(/REFUSING TO RUN/);
    });

    it('does not leak credentials in the error message', () => {
      let message = '';
      try {
        assertSandboxDatabaseUrl('postgres://user:hunter2@prod-host:5432/app');
      } catch (err) {
        message = (err as Error).message;
      }
      expect(message).not.toContain('hunter2');
      expect(message).toContain('***@');
    });
  });

  describe('assertSandboxRedisUrl', () => {
    it('accepts the default sandbox URL', () => {
      expect(assertSandboxRedisUrl(DEFAULT_SANDBOX_REDIS_URL)).toBe(
        DEFAULT_SANDBOX_REDIS_URL
      );
    });

    it('rejects an unset URL', () => {
      expect(() => assertSandboxRedisUrl(undefined)).toThrow(/REFUSING TO RUN/);
    });

    it('rejects the default redis port (6379)', () => {
      expect(() => assertSandboxRedisUrl('redis://localhost:6379')).toThrow(
        /6399/
      );
    });

    it('rejects prod-shaped Upstash URLs', () => {
      expect(() =>
        assertSandboxRedisUrl(
          'rediss://default:token@usw1-example.upstash.io:6380'
        )
      ).toThrow(/REFUSING TO RUN/);
    });
  });

  describe('redact', () => {
    it('masks the credential block of a connection string', () => {
      expect(redact('postgres://user:secret@host:5432/db')).toBe(
        'postgres://***@host:5432/db'
      );
    });

    it('passes through URLs without credentials', () => {
      expect(redact('redis://localhost:6399')).toBe('redis://localhost:6399');
    });
  });
});
