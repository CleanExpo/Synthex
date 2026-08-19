/**
 * Sandbox connection guards (SYN-MCP-000).
 *
 * The integration profile must ONLY ever talk to the CI sandbox Postgres/Redis
 * (GitHub Actions service containers on ports 5499 / 6399). A connection
 * string that lacks those ports is, by definition, NOT the sandbox and must
 * be rejected before a single query runs. This is the hard line that keeps
 * integration tests from ever meaning "verify against prod".
 *
 * Pure functions — unit-tested in tests/unit/sandbox-guard.test.ts.
 */

export const SANDBOX_PG_PORT_MARKER = ':5499/';
export const SANDBOX_REDIS_PORT_MARKER = ':6399';

export const DEFAULT_SANDBOX_DATABASE_URL =
  'postgres://postgres:test@localhost:5499/synthex_test';
export const DEFAULT_SANDBOX_REDIS_URL = 'redis://localhost:6399';

/**
 * HARD-FAILS unless the URL targets the sandbox Postgres (port 5499).
 * Returns the validated URL for convenience.
 */
export function assertSandboxDatabaseUrl(url: string | undefined): string {
  if (!url || !url.includes(SANDBOX_PG_PORT_MARKER)) {
    throw new Error(
      `[sandbox-guard] REFUSING TO RUN: DATABASE_URL must point at the CI ` +
        `verification sandbox (host port 5499, e.g. ${DEFAULT_SANDBOX_DATABASE_URL}). ` +
        `Got: ${url ? redact(url) : '(unset)'}. ` +
        `Integration tests run in GitHub Actions service containers. ` +
        `Integration tests never run against a non-sandbox database.`
    );
  }
  return url;
}

/**
 * HARD-FAILS unless the URL targets the sandbox Redis (port 6399).
 * Returns the validated URL for convenience.
 */
export function assertSandboxRedisUrl(url: string | undefined): string {
  if (!url || !url.includes(SANDBOX_REDIS_PORT_MARKER)) {
    throw new Error(
      `[sandbox-guard] REFUSING TO RUN: REDIS_URL must point at the CI ` +
        `verification sandbox (host port 6399, e.g. ${DEFAULT_SANDBOX_REDIS_URL}). ` +
        `Got: ${url ? redact(url) : '(unset)'}. ` +
        `Integration tests run in GitHub Actions service containers. ` +
        `Integration tests never run against a non-sandbox Redis.`
    );
  }
  return url;
}

/** Strip credentials from a connection string before echoing it in errors. */
export function redact(url: string): string {
  return url.replace(/\/\/([^@/]+)@/, '//***@');
}
