# SQL Drift Archive — 2026-04-27

> **Action:** Supabase + SQL Cleanup Phase 1 housekeeping (per `.claude/scratchpad/supabase-sql-cleanup-audit.md`)
> **Authority:** Phill McGurk, CEO · approved via "use swarm and continue through all your recommendations"
> **Operator:** Synthex orchestrator (autonomous · zero destructive ops · CLAUDE.md "never delete · move to archived" compliance)
> **Date:** 2026-04-27

## What was archived here

30 SQL files that lived as **loose `.sql` files outside the canonical `prisma/migrations/[timestamp_name]/migration.sql` structure**. The Prisma migration system expects every applied migration to live inside a dated directory under `prisma/migrations/`. Loose files at the directory root or alongside the dated subdirectories aren't picked up by the migration history — they were drift.

### Subdirectory `prisma-root/` (28 files · originally `prisma/*.sql`)

Sprint and ticket-tagged migrations from 2026-03-25 through 2026-04-05:

- 8 files dated 2026-03-25 (sprint 1 + onboarding + push-subscriptions + SYN-487 + safe variants)
- 1 file 2026-03-26 (UNI-1642/1643)
- 5 files 2026-03-30 (pipeline cost · calendar mode · publish queue · SYN-531 · first-win-detected)
- 1 file 2026-03-31 (SYN-551)
- 1 file 2026-04-01 (SYN-608 RLS)
- 4 files 2026-04-02 (algorithm KB · algorithm freshness · health score · edge function logs)
- 2 files 2026-04-03 (SYN-631 · SYN-632)
- 4 files 2026-04-04 (knowledge graph · journey events · score history · accuracy events)
- 1 file 2026-04-05 (milestone events)
- 1 undated `fix-p4002.sql`
- 1 undated `sprint1-migration.sql`

### Subdirectory `prisma-migrations-loose/` (2 files · originally `prisma/migrations/*.sql`)

- `add_social_tables.sql`
- `strategic-marketing.sql`

These two were inside `prisma/migrations/` but NOT inside dated migration directories. Same drift pattern.

## What was NOT archived

The 8 properly-structured Prisma migration directories under `prisma/migrations/[timestamp_name]/migration.sql` are canonical and remain in place:

- `20250807225430_add_missing_models/`
- `20250813_add_team_invitations/`
- `20250813_strategic_marketing/`
- `20260204_add_account_model/`
- `20260204_consolidated_schema/`
- `20260315_vault_secrets_management/`
- `20260402_attribution_context/`
- (one more dated dir present)

Plus `prisma/migrations/migration_lock.toml` and `prisma/migrations/ROLLBACK_TEMPLATE.md` (canonical · stay).

## Recovery — how to restore

Per CLAUDE.md "never delete · move to archived/" rule, all 30 files are preserved verbatim in this directory tree. To restore any file:

```bash
# Restore a specific file from prisma-root/
cp .claude/archived/2026-04-27/sql-drift/prisma-root/<filename>.sql prisma/

# Restore a file from prisma-migrations-loose/
cp .claude/archived/2026-04-27/sql-drift/prisma-migrations-loose/<filename>.sql prisma/migrations/
```

## Why this was safe (Phase 1 = zero risk)

These files were **already not part of the migration history** — they were SQL drift sitting outside Prisma's migration tracking. Moving them does NOT affect:
- Production database state (production is governed by the 56 Supabase migration records · separate from these files)
- Prisma migration tracking (Prisma only reads from dated `prisma/migrations/[timestamp_name]/` directories)
- Application runtime (no code reads these `.sql` files at runtime · they were one-shot ticket migrations)

If any of these files represented a migration that was applied to production via `prisma db push` or manual SQL · the production effect is already locked in. Moving the file doesn't reverse the production effect · it just removes drift from the working directory.

## Next steps (Phase 2 audit · CEO action)

Per `.claude/scratchpad/supabase-sql-cleanup-audit.md` Section 6, Phase 2 needs CEO answers on 7 questions about the 254 production tables · drift candidates identified:

1. Are nutrition / recipes / meal-plans tables active product? (7 tables)
2. Is symptom-logging / professional-marketplace / news-aggregator active? (6 tables)
3. Is Reddit content orchestrator active? (6 tables · 6 rows of seed data)
4. Is Cin7 integration active for CCW (vs Shopify)? (29 tables)
5. Is `nexus_*` (Notion-like) schema active? (3 tables)
6. Is `marketplace_*` schema active? (5 tables)
7. Is `ap2_*` (Agentic Payments) active? (6 tables)

Phase 3 destructive cleanup (drop migrations) requires explicit CEO instruction per batch. CLAUDE.md operations/control-plane.md binding.
