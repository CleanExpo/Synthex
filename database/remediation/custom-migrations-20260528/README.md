# Custom Migration Reconciliation - 2026-05-28

This remediation closes the legacy `database/migrations/*.sql` backlog reported
by `npm run db:migrate:dry-run`.

The active runtime does not expect those old greenfield schemas to be replayed
verbatim against production. The one active missing surface found in runtime
code was the media library, so the Supabase migration creates the current
`media_assets` and `media_folders` contract directly.

Run order:

1. Apply `supabase/migrations/20260528073000_media_library_runtime_tables.sql`.
   Expected: `media_folders` and `media_assets` exist with indexes, owner
   guards, RLS policies, and the `increment_media_usage` RPC.

2. Apply `database/remediation/custom-migrations-20260528/20260528073500_baseline_retired_custom_migrations.psql`.
   Expected: the 11 retired custom migration filenames are present in
   `public.schema_migrations`.

3. Run `npm run db:migrate:dry-run`.
   Expected: `Database is already up to date!`.

4. Run `npm run shipit:status:live -- --run-rls`.
   Expected: zero blocking gates and RLS coverage/adversarial checks passing.

Steps 1 and 2 are idempotent and safe to re-run.
