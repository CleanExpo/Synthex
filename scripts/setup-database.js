#!/usr/bin/env node

/**
 * Database Setup Script for SYNTHEX — one-off: initialised the Supabase tables
 * from supabase/migrations/001_complete_schema.sql through the Supabase client.
 *
 * That client has been removed (lib/platform/noop-client retired). Schema now
 * lives in prisma/schema.prisma and is applied with Prisma migrations, so this
 * script exits 1 rather than pretend the database was set up.
 */
console.error(
  'setup-database: requires the removed Supabase client (lib/platform/noop-client). ' +
    'Schema changes go through Prisma (prisma/schema.prisma). Nothing was set up.'
);
process.exit(1);
