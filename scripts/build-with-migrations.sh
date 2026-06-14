#!/usr/bin/env sh
# Synthex production build pipeline — applies pending Prisma migrations on deploy.
#
# WHY THIS EXISTS (P0):
#   Before this script, `build:vercel` ran ONLY `prisma generate && next build`
#   plus an SEO HTML check. It NEVER ran `prisma migrate deploy`. Any schema
#   change therefore shipped a Prisma client expecting columns the live DB
#   lacked → runtime 500s + schema drift. The 2026-06-12 hardening migration
#   (platform_connections uniqueness indexes) could ship with no DB change.
#
# WHAT THIS DOES (in order):
#   1. prisma generate          — always; only needs the schema, no DB/env.
#   2. prisma migrate deploy     — ONLY on real production builds with a DB URL.
#                                  Skipped on Vercel preview/development (no prod
#                                  DB there → would P1012) and skipped when
#                                  DATABASE_URL is unset (local `next build`).
#   3. check-schema-drift.mjs    — fail-fast guard against the failure mode where
#                                  `migrate deploy` reports success but the DDL
#                                  silently no-op'd. (RestoreAssist hit exactly
#                                  this on 2026-05-12: 24 columns missing across
#                                  7 tables, dashboards 500'd for hours.)
#   4. next build                — webpack build.
#   5. validate-schema.ts        — the pre-existing SEO/HTML validation.
#
# GATING: migrate deploy runs only when BOTH:
#   - VERCEL_ENV is NOT preview/development (i.e. production, or a non-Vercel
#     prod runner where VERCEL_ENV is empty), AND
#   - DATABASE_URL is set.
# This mirrors RestoreAssist/scripts/build.sh.
#
# ⚠️ LEDGER PREREQUISITE — READ BEFORE FIRST PRODUCTION DEPLOY:
#   Synthex historically applied migrations OUT OF BAND (Supabase MCP
#   apply_migration / `prisma db execute`), NOT via Prisma's migrate engine
#   (see .claude/rules/database/supabase-migrations.md). The `_prisma_migrations`
#   ledger in prod may therefore be incomplete. If it is, the FIRST
#   `prisma migrate deploy` can fail with P3005 ("database schema is not empty")
#   or attempt to replay already-applied migrations.
#   Before relying on this in prod, confirm the ledger is baselined
#   (`prisma migrate resolve --applied <name>` for each already-applied
#   migration, OR `npm run db:migration-history:reconcile`). The drift check in
#   step 3 is the real-world safety net regardless of ledger state.
set -e

# DIRECT_URL bypasses pgBouncer for DDL/migrations (Supabase port 5432);
# fall back to DATABASE_URL when a separate session-mode URL is not provided.
export DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}"

# Pinned Prisma version matches the previous build:vercel invocation.
PRISMA="npx prisma@7.5.0"

$PRISMA generate

case "$VERCEL_ENV" in
  preview | development)
    echo "[build] VERCEL_ENV=$VERCEL_ENV — skipping prisma migrate deploy (no prod DB in this env)"
    ;;
  *)
    if [ -z "$DATABASE_URL" ]; then
      echo "[build] DATABASE_URL unset — skipping prisma migrate deploy (local 'next build' without env)"
    else
      echo "[build] Applying pending Prisma migrations (prisma migrate deploy)…"
      $PRISMA migrate deploy
      # Fail-fast drift guard: catches the case where migrate deploy reports
      # success but the DDL silently no-op'd. Aborts before next build.
      node scripts/check-schema-drift.mjs
    fi
    ;;
esac

NODE_OPTIONS=--max-old-space-size=8192 next build --webpack

npx tsx scripts/validate-schema.ts
