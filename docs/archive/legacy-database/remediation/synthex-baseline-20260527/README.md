# Synthex DB Baseline Remediation SQL

These `.psql` files are manual production PostgreSQL SQL scripts. They are
intentionally kept outside `supabase/` and `database/migrations/` so they cannot
be auto-applied by normal deploy or Supabase Preview tooling.

Run order:

1. `20260527090500_preflight_missing_table_baseline.psql`
2. Create/confirm a fresh production backup.
3. `20260527091000_apply_missing_supabase_tables.psql`
4. `20260527093000_verify_post_baseline.psql`
5. `20260527092000_baseline_migration_ledgers.psql`
6. `20260527093000_verify_post_baseline.psql`

Do not run `prisma migrate deploy` until the verification script reports zero
missing remediation tables and the repo audit no longer reports a missing
Prisma migration ledger.
