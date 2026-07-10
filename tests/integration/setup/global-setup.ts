/**
 * Jest globalSetup for the integration profile (SYN-MCP-000).
 *
 * Runs ONCE before the integration suite:
 *   1. Defaults DATABASE_URL / REDIS_URL to the Docker sandbox if unset.
 *   2. HARD-FAILS unless both URLs target the sandbox ports (5499 / 6399) —
 *      the guard that guarantees these tests can never touch a real database.
 *   3. Pins DIRECT_URL to the sandbox URL. prisma.config.ts prefers DIRECT_URL
 *      over DATABASE_URL, so an inherited (e.g. prod) DIRECT_URL from the
 *      shell would otherwise silently win inside `prisma db push`.
 *   4. Materialises the schema with `prisma db push` — NOT `migrate deploy`,
 *      because prisma/migrations is sparse/non-authoritative in this repo
 *      (Supabase-first history). schema.prisma is the source of truth here.
 *   5. Seeds deterministic fixtures (tests/integration/setup/seed.ts).
 *
 * Requires the sandbox to be up: `npm run sandbox:up`.
 */

import { execSync } from 'child_process';
import * as path from 'path';
import {
  assertSandboxDatabaseUrl,
  assertSandboxRedisUrl,
  DEFAULT_SANDBOX_DATABASE_URL,
  DEFAULT_SANDBOX_REDIS_URL,
} from './sandbox-guard';
import { seedSandbox } from './seed';

export default async function globalSetup(): Promise<void> {
  // 1. Default to the sandbox when unset (local convenience).
  process.env.DATABASE_URL =
    process.env.DATABASE_URL || DEFAULT_SANDBOX_DATABASE_URL;
  process.env.REDIS_URL = process.env.REDIS_URL || DEFAULT_SANDBOX_REDIS_URL;

  // 2. Guard: never run against a non-sandbox DB/Redis. Throws on violation.
  const databaseUrl = assertSandboxDatabaseUrl(process.env.DATABASE_URL);
  assertSandboxRedisUrl(process.env.REDIS_URL);

  // 3. DIRECT_URL must not leak in from the shell (prisma.config.ts prefers it).
  process.env.DIRECT_URL = databaseUrl;

  // 4. Push the pristine Prisma schema into the ephemeral sandbox DB.
  //
  // SYN-1090: the sandbox-only "patched copy" workaround that transiently
  // stripped `@db.Uuid` from Testimonial*/organizationId is GONE — the schema
  // drift it papered over (organizationId declared uuid vs Organization.id
  // text) is now fixed in prisma/schema.prisma itself, so the pristine schema
  // pushes clean onto a fresh Postgres.
  const repoRoot = path.resolve(__dirname, '..', '..', '..');

  console.log(
    `\n[integration:global-setup] prisma db push -> sandbox (:5499)\n`
  );
  // Note: Prisma 7 `db push` does not regenerate the client (and the old
  // --skip-generate flag was removed) — run `npx prisma generate` separately.
  execSync(
    'npx prisma db push --accept-data-loss --schema prisma/schema.prisma',
    {
      cwd: repoRoot,
      stdio: 'inherit',
      env: { ...process.env },
    }
  );

  // 5. Seed deterministic fixtures (idempotent — safe to re-run).
  await seedSandbox();
  console.log('[integration:global-setup] sandbox schema pushed + seeded\n');
}
