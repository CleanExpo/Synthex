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

/**
 * Supabase project ref, which is the ONLY stable identity across the two
 * connection shapes. Comparing hostnames is wrong: the same database is reached
 * as `db.<ref>.supabase.co` (direct) AND `aws-0-<region>.pooler.supabase.com`
 * (pooled), so a hostname check calls one database two, and — because this file
 * throws at config load — would break `postinstall: prisma generate`, every
 * `npm ci`, every CI job and the Vercel build. Both shapes carry the ref:
 * direct puts it in the hostname, pooled puts it in the username
 * (`postgres.<ref>`).
 */
function projectRef(raw: string): string | null {
  try {
    const u = new URL(raw);
    const fromHost = /^db\.([a-z0-9]+)\.supabase\.(co|com)$/i.exec(u.hostname);
    if (fromHost) return fromHost[1].toLowerCase();
    const fromUser = /^postgres\.([a-z0-9]+)$/i.exec(
      decodeURIComponent(u.username)
    );
    if (fromUser) return fromUser[1].toLowerCase();
    return null;
  } catch {
    return null;
  }
}

/** host + database name, ignoring port/user/password. Null when unparseable. */
function identity(raw: string): { host: string; db: string } | null {
  try {
    const u = new URL(raw);
    return {
      host: u.hostname.toLowerCase(),
      // Trailing slash is cosmetic: `/postgres` and `/postgres/` are one db.
      db: u.pathname.replace(/^\//, '').replace(/\/$/, ''),
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
  const refA = projectRef(directUrl);
  const refB = projectRef(databaseUrl);
  const a = identity(directUrl);
  const b = identity(databaseUrl);

  if (refA && refB) {
    // Confident comparison: both URLs name a Supabase project. THROW on
    // mismatch — this cannot false-positive across connection shapes.
    if (refA !== refB) {
      throw new Error(
        `[prisma.config] DIRECT_URL and DATABASE_URL address DIFFERENT Supabase projects — refusing to continue.\n` +
          `  DIRECT_URL   -> project ${refA}   (used by the Prisma CLI: migrate, db execute, studio)\n` +
          `  DATABASE_URL -> project ${refB}   (used by the app at runtime via lib/prisma.ts)\n` +
          `Migrations would be applied to the first while the application reads the second.`
      );
    }
  } else if (a && b && (a.host !== b.host || a.db !== b.db)) {
    // No project ref on one or both (self-hosted Postgres, a proxy, a local
    // container). Host/db may legitimately differ for the same database, so
    // this only WARNS. Throwing here is what would brick `npm ci` — the guard
    // must not be more dangerous than the thing it guards against.
    console.warn(
      `[prisma.config] DIRECT_URL and DATABASE_URL look like different databases.\n` +
        `  DIRECT_URL   -> ${a.host}/${a.db}   (Prisma CLI: migrate, db execute, studio)\n` +
        `  DATABASE_URL -> ${b.host}/${b.db}   (app runtime via lib/prisma.ts)\n` +
        `  If these are genuinely the same database reached two ways, ignore this.\n` +
        `  If not, migrations are being applied where the app will never read them.`
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
