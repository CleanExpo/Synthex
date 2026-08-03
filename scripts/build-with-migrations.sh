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
#                                  BASELINE-TOLERANT: a P3005/P3009-class failure
#                                  (unbaselined / out-of-band ledger) does NOT
#                                  fail the build — the drift check in step 3 is
#                                  the real gate. See "LEDGER MODEL" below.
#   3. check-schema-drift.mjs    — THE HARD GATE. Fails the build if any column
#                                  the schema declares is missing from the live
#                                  DB. Catches both (a) `migrate deploy` reporting
#                                  success while the DDL silently no-op'd
#                                  (RestoreAssist 2026-05-12: 24 columns missing,
#                                  dashboards 500'd for hours) AND (b) migrate
#                                  deploy being skipped/aborted on an unbaselined
#                                  ledger while the schema is genuinely behind.
#   4. next build                — webpack build.
#   5. validate-schema.ts        — the pre-existing SEO/HTML validation.
#
# GATING: migrate deploy runs only when BOTH:
#   - VERCEL_ENV is NOT preview/development (i.e. production, or a non-Vercel
#     prod runner where VERCEL_ENV is empty), AND
#   - DATABASE_URL is set.
# This mirrors RestoreAssist/scripts/build.sh.
#
# ⚠️ LEDGER MODEL — WHY migrate deploy IS BASELINE-TOLERANT (read this):
#   Synthex historically applies migrations OUT OF BAND (Supabase MCP
#   apply_migration / `prisma db execute`), NOT via Prisma's migrate engine
#   (see .claude/rules/database/supabase-migrations.md). 21 of 24 migration
#   dirs aren't even Prisma-standard names. So the prod `_prisma_migrations`
#   ledger is almost certainly UNBASELINED, and the FIRST `prisma migrate deploy`
#   would fail with P3005 ("database schema is not empty") / P3009 (failed
#   migration in ledger).
#
#   If this script let that failure abort the build (the naive `set -e`
#   behaviour), the very first production deploy after merge would BRICK — the
#   build would die on `migrate deploy` before `next build` ever ran, even
#   though the schema was already correct (applied out of band).
#
#   So we treat migrate deploy as ADVISORY and let the DRIFT CHECK decide:
#     • migrate deploy succeeds  → ledger was fine, new migrations applied. Good.
#     • migrate deploy hits P3005/P3009 (baseline class) → ledger isn't baselined.
#       We log it and CONTINUE to the drift check. If the schema actually matches
#       (out-of-band applied), drift check passes → build proceeds safely. If the
#       schema is genuinely behind, drift check FAILS the build → no broken deploy.
#     • migrate deploy fails for any OTHER reason (bad SQL P3018, connection
#       P1001, etc.) → that's a real error → fail the build immediately.
#
#   This makes the PR safe to merge with NO required one-time ops step: a missing
#   baseline can no longer brick prod, because correctness is enforced by the
#   schema-vs-DB drift check, not by the ledger.
#
#   RECOMMENDED (optional, removes the P3005 log noise + enables true tracked
#   migrations going forward): baseline the ledger ONCE, out of band —
#   `npm run db:migration-history:reconcile` then
#   `prisma migrate resolve --applied <name>` for each already-applied dir.
#   After that, migrate deploy succeeds cleanly and applies only genuinely new
#   migrations. This is a nice-to-have, NOT a merge blocker.
set -e

# DIRECT_URL bypasses pgBouncer for DDL/migrations (Supabase port 5432);
# fall back to DATABASE_URL when a separate session-mode URL is not provided.
export DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}"

# Use the Prisma CLI installed from this repository's lockfile so generation,
# migrations, and @prisma/client stay on the same reviewed version.
PRISMA="npx prisma"

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
      # Baseline-tolerant: capture output + exit code WITHOUT letting set -e abort.
      # An unbaselined / out-of-band ledger (P3005 schema-not-empty, P3009 failed
      # migration in ledger) must NOT brick the build — the drift check below is
      # the real gate. Any OTHER non-zero exit is a genuine error → abort.
      migrate_out="$($PRISMA migrate deploy 2>&1)" && migrate_rc=0 || migrate_rc=$?
      printf '%s\n' "$migrate_out"
      if [ "$migrate_rc" -ne 0 ]; then
        if printf '%s' "$migrate_out" | grep -qE 'P3005|P3009|database schema is not empty'; then
          echo "[build] ⚠ migrate deploy hit a baseline-class error (P3005/P3009)."
          echo "[build]   The _prisma_migrations ledger is unbaselined (Synthex applies"
          echo "[build]   migrations out of band — see .claude/rules/database/supabase-migrations.md)."
          echo "[build]   NOT failing the build on this — the schema-drift check below is the"
          echo "[build]   authoritative gate. To clear this warning, baseline the ledger once:"
          echo "[build]   npm run db:migration-history:reconcile (see script header)."
        else
          echo "[build] ✗ prisma migrate deploy failed with a non-baseline error (rc=$migrate_rc)." >&2
          echo "[build]   This is a real migration/connection failure — aborting the build." >&2
          exit "$migrate_rc"
        fi
      fi
      # THE HARD GATE. Regardless of whether migrate deploy ran, applied, or was
      # tolerated above, the live DB MUST match prisma/schema.prisma or the build
      # fails here — before next build ships a client expecting missing columns.
      node scripts/check-schema-drift.mjs
    fi
    ;;
esac

NODE_OPTIONS=--max-old-space-size=8192 next build --webpack

npx tsx scripts/validate-schema.ts
