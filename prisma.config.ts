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
const cliDatasourceUrl =
  process.env.DIRECT_URL || process.env.DATABASE_URL || '';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: cliDatasourceUrl,
  },
  migrations: {
    seed: 'node prisma/seed.js',
  },
});
