---
name: database-prisma
description: >-
  Synthex database operations enforcer. NEVER use prisma db push for schema
  changes — use migrate diff + db execute. NEVER add non-nullable columns
  without defaults. NEVER write Prisma queries without organizationId scope.
  ALWAYS use backward-compatible migrations and validate with prisma validate
  first. Activate on ANY request to change schema, write a query, create a
  migration, add a model, or modify database operations.
effort: high
metadata:
  author: synthex
  version: '2.0'
  engine: synthex-ai-agency
  type: capability-uplift-code
  triggers:
    - database
    - prisma
    - schema
    - migration
    - query optimisation
    - schema
    - migration
    - prisma
    - query
    - database
    - model
    - db change
  requires:
    - database/migrations.skill.md
context: fork
---

# Database Operations Agent

## Purpose

Manages all database operations for SYNTHEX including Prisma schema validation,
migration safety, query optimisation, and data integrity enforcement on the
Supabase/PostgreSQL backend.

## When to Use

Activate this skill when:

- Modifying the Prisma schema (`prisma/schema.prisma`)
- Creating or reviewing database migrations
- Optimising database queries (N+1, missing indexes)
- Debugging database connection or query issues
- Validating foreign key constraints or cascade behaviour

## When NOT to Use This Skill

- When creating API endpoints (use api-testing for testing, code for building)
- When building frontend components (use design or ui-ux)
- When writing raw SQL migrations outside Prisma (use migrations.skill.md directly)
- When configuring Supabase auth or storage (use supabase.skill.md)
- Instead use: `api-testing` for endpoint work, `migrations.skill.md` for raw SQL

## Tech Stack

- **ORM**: Prisma 5.x
- **Database**: PostgreSQL (Supabase)
- **Hosting**: Supabase managed instance
- **Local Dev**: Supabase CLI

## Instructions

1. **Assess change scope** — Determine if schema change, migration, or query work
2. **Back up current state** — Tag with `git tag -a "backup-db-YYYY-MM-DD"`
3. **Validate schema changes** — Check relationships, indexes, and type consistency
4. **Generate migration** — Run `npx prisma migrate dev --name <name>`
5. **Review migration SQL** — Inspect generated SQL for destructive operations
6. **Test locally first** — Run migration against local Supabase instance
7. **Check for breaking changes** — Verify no dropped columns without data backup
8. **Optimise queries** — Identify N+1 patterns, suggest proper include/select
9. **Validate data integrity** — Check foreign keys, cascades, enum sync
10. **Generate Prisma client** — Run `npx prisma generate` after schema changes

## Input Specification

| Parameter      | Type   | Required | Description                                                                |
| -------------- | ------ | -------- | -------------------------------------------------------------------------- |
| operation      | string | yes      | `schema-validate`, `migration-create`, `query-optimise`, `integrity-check` |
| target         | string | no       | File path or model name                                                    |
| migration_name | string | no       | Name for new migration                                                     |

## Output Specification

| Field         | Type              | Description                  |
| ------------- | ----------------- | ---------------------------- |
| operation     | string            | Operation performed          |
| status        | pass/fail/warning | Result status                |
| changes       | array             | List of schema/query changes |
| warnings      | array             | Potential issues detected    |
| migration_sql | string            | Generated SQL (if migration) |

## Error Handling

| Error                          | Action                                  |
| ------------------------------ | --------------------------------------- |
| Migration conflict             | Resolve manually, never auto-merge      |
| Destructive operation detected | Block and require explicit confirmation |
| Schema validation failure      | Report exact field/model with issue     |
| Connection failure             | Check Supabase status, verify env vars  |
| Data type mismatch             | Report expected vs actual types         |
| Rollback failure               | Preserve state, escalate immediately    |

## Safety Rules

- NEVER drop columns without data backup
- ALWAYS test migrations locally first
- REQUIRE explicit confirmation for destructive operations
- MAINTAIN migration history integrity
- NEVER auto-apply migrations to production

## Models Overview

```prisma
# Core Models
- User, Account, Session
- Team, TeamMember
- ScheduledPost, ScheduledReport

# Analytics Models
- AnalyticsEvent, EngagementMetric
- SentimentAnalysis, ContentPerformance

# Competitor Models
- TrackedCompetitor, CompetitorSnapshot
- CompetitorPost, CompetitorAlert
```

## Key Files

- `prisma/schema.prisma` — Database schema
- `prisma/migrations/` — Migration history
- `lib/prisma.ts` — Prisma client instance
- `lib/db/` — Database utilities

## Commands

```bash
supabase start                       # Start local Supabase
npx prisma generate                  # Generate Prisma client
supabase db push                     # Apply migrations
supabase db reset                    # Reset database (destructive)
npx prisma migrate dev --name <name> # Create migration
```

## Integration Points

- Works with **api-testing** for data validation
- Coordinates with **code-review** for query patterns
- Supports **client-retention** with metrics storage
- References **migrations.skill.md** for raw SQL patterns

---

## Capability Uplift — Override Defaults

**NEVER** use `npx prisma db push` for schema changes in any environment —
it bypasses migration history and will silently break production. Never add
a non-nullable column without a default value (breaks existing rows). Never
drop or rename a column without explicit human approval (data loss risk).

**INSTEAD** every schema change follows:

```bash
# 1. Validate first
npx prisma validate

# 2. Generate SQL diff
npx prisma migrate diff \
  --from-schema-datasource \
  --to-schema-datamodel prisma/schema.prisma \
  --script > migration.sql

# 3. Review the SQL manually

# 4. Execute
npx prisma db execute --file migration.sql --schema prisma/schema.prisma
```

Every new column is either nullable or has a `@default(...)`.
Every query on a multi-tenant model includes `where: { organizationId }`.

**REFERENCE** `.claude/skills/synthex-standards/references/code-standards.md`
