import { defineConfig } from 'prisma/config';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

// The Prisma CLI must talk to Postgres DIRECTLY, never through the pooler.
// DATABASE_URL is Supabase's pgBouncer endpoint (:6543, transaction mode); the
// migrate engine uses prepared statements and session state, so running it there
// fails with `prepared statement "s0" does not exist`. DIRECT_URL is the session
// connection (:5432) and is what every CLI command needs.
//
// `??` is deliberately NOT used: an empty-string DIRECT_URL is "defined" to `??`
// and would beat a working DATABASE_URL. Fall through on any falsy value.
//
// This is the order .claude/rules/database/supabase-migrations.md has always
// documented; the config had drifted to DATABASE_URL-only, which is what broke
// `prisma migrate deploy` in scripts/build-with-migrations.sh on every
// production build.
const directUrl = process.env.DIRECT_URL || '';
const databaseUrl = process.env.DATABASE_URL || '';

/** host + database name, ignoring port/user/password. Null when unparseable. */
function identity(raw: string): { host: string; db: string } | null {
  try {
    const u = new URL(raw);
    return {
      host: u.hostname.toLowerCase(),
      db: u.pathname.replace(/^\//, ''),
    };
  } catch {
    return null;
  }
}

/** Supabase's transaction pooler. The migrate engine cannot run here. */
function looksPooled(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (
      u.port === '6543' ||
      u.searchParams.get('pgbouncer') === 'true' ||
      /(^|\.)pooler\./.test(u.hostname)
    );
  } catch {
    return false;
  }
}

// FAIL CLOSED when the two URLs name different databases. The CLI would migrate
// one while the running app reads the other, and the app would keep serving
// against an unmigrated schema with no error anywhere — a silent, unrecoverable
// split. Ports and credentials are allowed to differ (that is the whole point:
// :5432 session vs :6543 transaction); only host and database name must agree.
// Unparseable values are NOT treated as a mismatch, because a malformed URL
// fails loudly at connect time on its own and must not break `prisma generate`,
// which needs no database at all.
if (directUrl && databaseUrl) {
  const a = identity(directUrl);
  const b = identity(databaseUrl);
  if (a && b && (a.host !== b.host || a.db !== b.db)) {
    throw new Error(
      `[prisma.config] DIRECT_URL and DATABASE_URL address DIFFERENT databases — refusing to continue.\n` +
        `  DIRECT_URL   -> ${a.host}/${a.db}   (used by the Prisma CLI: migrate, db execute, studio)\n` +
        `  DATABASE_URL -> ${b.host}/${b.db}   (used by the app at runtime via lib/prisma.ts)\n` +
        `Migrations would be applied to the first while the application reads the second.\n` +
        `Point both at the same host and database; they may differ in port and credentials.`
    );
  }
}

// The fallback is deliberate — some environments define only DATABASE_URL, and
// `prisma generate` needs no database — but it must not be SILENT. Falling back
// to a transaction pooler is what broke production: `prisma migrate deploy` in
// scripts/build-with-migrations.sh captures its output into a variable, so the
// command hung and the build died on the platform timeout with no error text at
// all. This line puts a name on that failure before it happens.
if (!directUrl && databaseUrl && looksPooled(databaseUrl)) {
  console.warn(
    `[prisma.config] DIRECT_URL is not set; falling back to DATABASE_URL, which looks like a transaction pooler.\n` +
      `  Prisma's migrate engine needs session state, so migrate/db-execute will FAIL or HANG here\n` +
      `  (typically: 'prepared statement "s0" does not exist', or no output at all until timeout).\n` +
      `  Set DIRECT_URL to the session connection (port 5432). 'prisma generate' is unaffected.`
  );
}

const cliDatasourceUrl = directUrl || databaseUrl || '';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: cliDatasourceUrl,
  },
  migrations: {
    seed: 'node prisma/seed.js',
  },
});
