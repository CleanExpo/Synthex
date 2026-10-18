/**
 * apply-migrations.js — one-off: applied supabase/migrations/20250113_create_user_tables.sql
 * through the Supabase client.
 *
 * That client has been removed (lib/platform/noop-client retired). Schema now
 * lives in prisma/schema.prisma and is applied with Prisma migrations, so this
 * script exits 1 rather than pretend a migration ran.
 */
console.error(
  'apply-migrations: requires the removed Supabase client (lib/platform/noop-client). ' +
    'Schema changes go through Prisma (prisma/schema.prisma). Nothing was applied.'
);
process.exit(1);
