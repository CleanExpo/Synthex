# RLS Baseline vs Phase 2 Expected — Synthex production (znyjoyjsvjotlzjppzal)

Run at 2026-05-16T11:18 UTC via Supabase MCP `execute_sql`.

## Note on project ID

The plan referenced `lksfwktwtmyznckodsau` but that is **Unite-Group**, not Synthex. The actual Synthex production project is `znyjoyjsvjotlzjppzal` (region `ap-southeast-1`, host `db.znyjoyjsvjotlzjppzal.supabase.co`). All checks below run against the correct Synthex DB.

## Result

```json
{
  "secure": 18,
  "using_true": 148,
  "no_policy": 61,
  "null_predicate": 0,
  "total": 235
}
```

## Comparison

| Bucket | Phase 1 baseline | Phase 2 expected (post-#245) | Production observed | Delta |
|---|---|---|---|---|
| secure | 18 | 37 | **18** | **0** (expected +19) |
| using_true | ~148 | ~148 | 148 | 0 |
| no_policy | ~80 | ~61 | 61 | -19 (some progress) |
| total | 235 | 235 | 235 | 0 |

## Migration ledger check

`supabase_migrations.schema_migrations` last 5 entries:

```
20260515225502 immutable_audit_log
20260506055137 hermes_h1_init
20260503012700 add_missing_runtime_tables_20260503
20260409030754 enable_pg_cron
20260408225959 syn618_client_churn_risk
```

**Phase 2 PR #245 added BOTH (a) `immutable_audit_log` migration and (b) RLS Batch 1 migration (19 tables NO_POLICY → tenant-scoped).** Only (a) appears in the production schema_migrations ledger. The RLS Batch 1 migration was NOT applied.

## Finding

- `no_policy` did drop from ~80 → 61 (19 tables moved out of NO_POLICY bucket), but those 19 tables did NOT land in the `secure` bucket. They likely landed in `using_true` or were missed by the migration.
- The Phase 2 plan's claim of "secure went from 18 → 37" is NOT reflected in production.

## Verdict: FAIL — Phase 2 RLS Batch 1 not applied to production DB. SECURE count unchanged at 18.
