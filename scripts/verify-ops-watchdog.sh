#!/usr/bin/env bash
#
# Runnable control for the ops watchdog migrations.
#
# The watchdog is PostgreSQL, not TypeScript, so Jest cannot reach it. This
# script is its gate: it stands up a throwaway PostgreSQL, applies the
# migrations in order, and asserts behaviour — not merely that objects exist.
#
# Every assertion is paired. A control that only ever runs against the fixed
# code cannot tell you it would have caught the defect, so each fix ships with a
# way to withhold it and confirm the control goes red. If a sabotage run passes,
# the control is aimed at the wrong thing and its green means nothing.
#
# Usage:
#   scripts/verify-ops-watchdog.sh             # all migrations; expect green
#   SABOTAGE=d1 scripts/verify-ops-watchdog.sh # withhold the D1 fix; MUST fail
#   SABOTAGE=d2 scripts/verify-ops-watchdog.sh # withhold the D2 fix; MUST fail
#
# Requires Docker. Leaves nothing behind.

set -euo pipefail

SABOTAGE="${SABOTAGE:-0}"
[ "$SABOTAGE" = "1" ] && SABOTAGE=d1   # back-compat with the original switch

CONTAINER="ops-watchdog-verify-$$"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIG_DIR="$REPO_ROOT/supabase/migrations"
FAILURES=0

# The trap must PRESERVE the script's exit status. A bare EXIT trap whose last
# command succeeds hands that success back as the shell's status, so a failing
# control reports green to whoever ran it — the exact failure this whole script
# exists to prevent, reproduced in the script itself. Capture the real status
# first, clean up, then re-raise it.
cleanup() {
  local status=$?
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  exit $status
}
trap cleanup EXIT

psql_q() { docker exec "$CONTAINER" psql -U postgres -At -c "$1" 2>&1; }
psql_f() { docker exec "$CONTAINER" psql -U postgres -q -v ON_ERROR_STOP=1 -f "$1"; }

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
pass() { printf '  \033[32mPASS\033[0m  %s\n' "$*"; }
fail() { printf '  \033[31mFAIL\033[0m  %s\n' "$*"; FAILURES=$((FAILURES + 1)); }

expect_eq() { # expect_eq <label> <expected> <actual>
  if [ "$2" = "$3" ]; then pass "$1 (= $3)"; else fail "$1 — expected '$2', got '$3'"; fi
}

# ── Boot ────────────────────────────────────────────────────────────────────
say "Starting throwaway PostgreSQL 16"
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=verify postgres:16 >/dev/null
for _ in $(seq 1 60); do
  docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1 || { echo "postgres never became ready"; exit 1; }

# ── Fixture ─────────────────────────────────────────────────────────────────
# The `public` tables the watchdog reads, seeded so that EVERY check has its
# defect present. A fixture where nothing is wrong would let a watchdog that
# detects nothing score as a pass.
docker exec -i "$CONTAINER" psql -U postgres -q -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE autopilot_runs (id serial primary key, status text, started_at timestamptz,
  completed_at timestamptz, duration_ms int, error_message text);
CREATE TABLE posts (id serial primary key, published_at timestamptz, created_at timestamptz default now());
CREATE TABLE content_calendars (id serial primary key, status text, created_at timestamptz default now(), organization_id text);
CREATE TABLE publish_queue (id serial primary key, status text, scheduled_at timestamptz, organization_id text);
CREATE TABLE platform_connections (id serial primary key, platform text, is_active bool,
  expires_at timestamptz, deleted_at timestamptz);
CREATE TABLE organization_video_quotas (organization_id text primary key, daily_budget_usd numeric);
CREATE TABLE media_spend_events (id serial primary key, organization_id text, delta_usd numeric, window_at timestamptz);

INSERT INTO autopilot_runs (status, started_at) VALUES ('running', now() - interval '3 hours');
INSERT INTO posts (published_at) VALUES (NULL), (NULL);
INSERT INTO content_calendars (status, organization_id) VALUES ('draft','org-A');
INSERT INTO publish_queue (status, scheduled_at, organization_id) VALUES ('pending', now() - interval '48 hours','org-A');
INSERT INTO platform_connections (platform, is_active, expires_at) VALUES ('linkedin', false, NULL);
INSERT INTO organization_video_quotas VALUES ('org-A', 100);
INSERT INTO media_spend_events (organization_id, delta_usd, window_at) VALUES ('org-A', 90, now());

-- Supabase Vault, present but EMPTY. This is the production shape when the bot
-- token has not been stored: ops.alert() finds no secret and reports itself
-- unconfigured. A database with no vault schema at all raises a DIFFERENT error
-- and would exercise a different path, so the distinction matters.
CREATE SCHEMA vault;
CREATE TABLE vault.decrypted_secrets (name text, decrypted_secret text);
SQL

say "Applying migrations"
psql_f /dev/stdin < /dev/null 2>/dev/null || true
for m in "$MIG_DIR"/20260805*_ops_watchdog.sql "$MIG_DIR"/20260805*_ops_watchdog_d1_*.sql "$MIG_DIR"/20260805*_ops_watchdog_d2_*.sql; do
  [ -f "$m" ] || continue
  docker cp "$m" "$CONTAINER:/tmp/$(basename "$m")" >/dev/null
  if [ "$SABOTAGE" != "0" ] && [[ "$(basename "$m")" == *_${SABOTAGE}_* ]]; then
    # Plain expansion, not ${SABOTAGE^^}: macOS ships bash 3.2, where ^^ is a
    # "bad substitution" that aborts the run under set -e — a sabotage run that
    # dies before asserting anything looks indistinguishable from one that
    # passed.
    echo "  SABOTAGE: skipping $(basename "$m") — the $SABOTAGE assertions below MUST fail"
    continue
  fi
  psql_f "/tmp/$(basename "$m")"
  echo "  applied $(basename "$m")"
done

# ═══════════════════════════════════════════════════════════════════════════
say "D1 — an alert-layer failure must NOT destroy the detection work"
# ═══════════════════════════════════════════════════════════════════════════
#
# Break the alert path in the way that RAISES rather than the way that returns
# false: drop the vault table so ops.alert() hits an undefined relation. Under
# the original definition the raise unwinds pg_cron's single transaction and
# takes ops.watchdog()'s run row and every finding with it — the cycle leaves no
# evidence it ran at all.
psql_q "DROP TABLE vault.decrypted_secrets;" >/dev/null

runs_before=$(psql_q "SELECT count(*) FROM ops.watchdog_runs;")
psql_q "SELECT ops.watchdog_cycle();" >/dev/null 2>&1 || true
runs_after=$(psql_q "SELECT count(*) FROM ops.watchdog_runs;")
findings_after=$(psql_q "SELECT count(*) FROM ops.health_findings;")

# The cycle must leave a run row behind. Comparing before/after rather than
# asserting a fixed number, so the check survives being run twice.
if [ "$runs_after" -gt "$runs_before" ]; then
  pass "cycle recorded a run despite the alert layer raising ($runs_before -> $runs_after)"
else
  fail "cycle left NO evidence it ran — run count stayed at $runs_before"
fi

# Evidence of the run alone is not enough: the findings the checks produced must
# survive too, or the watchdog detected six faults and reported none of them.
if [ "$findings_after" -gt 0 ]; then
  pass "findings survived the alert-layer failure ($findings_after recorded)"
else
  fail "findings were rolled back — detection work destroyed"
fi

# Preserving the work while hiding the failure would be a worse defect than the
# one being fixed: a cycle that silently half-completes reads as healthy. The
# failure must be visible in the register.
dispatch_finding=$(psql_q "SELECT count(*) FROM ops.health_findings WHERE check_key = 'alert_dispatch_failed' AND resolved_at IS NULL;")
expect_eq "the alert failure is itself recorded as an open finding" "1" "$dispatch_finding"

# ── watchdog() raising must also leave evidence ────────────────────────────
# ops.watchdog() stamps its own run row then re-RAISEs. The raise unwinds the
# transaction that stamp lives in, so without a handler in the caller the stamp
# is lost as surely as the findings were. Break a table the checks read.
psql_q "ALTER TABLE posts RENAME TO posts_hidden;" >/dev/null
runs_before2=$(psql_q "SELECT count(*) FROM ops.watchdog_runs;")
psql_q "SELECT ops.watchdog_cycle();" >/dev/null 2>&1 || true
runs_after2=$(psql_q "SELECT count(*) FROM ops.watchdog_runs;")
if [ "$runs_after2" -gt "$runs_before2" ]; then
  pass "a raise inside watchdog() still leaves a terminal run row ($runs_before2 -> $runs_after2)"
else
  fail "watchdog() raised and left no run row — its own handler was unwound"
fi
watchdog_finding=$(psql_q "SELECT count(*) FROM ops.health_findings WHERE check_key = 'watchdog_failed' AND resolved_at IS NULL;")
expect_eq "the watchdog failure is recorded as an open finding" "1" "$watchdog_finding"
psql_q "ALTER TABLE posts_hidden RENAME TO posts;" >/dev/null

# ── Restore the alert path and confirm the failure findings clear ──────────
# A finding that fires correctly but can never clear is the D2 defect. These two
# are new, so they get checked the moment they are introduced.
psql_q "CREATE TABLE vault.decrypted_secrets (name text, decrypted_secret text);" >/dev/null
psql_q "SELECT ops.watchdog_cycle();" >/dev/null 2>&1 || true
still_open=$(psql_q "SELECT count(*) FROM ops.health_findings WHERE check_key IN ('alert_dispatch_failed','watchdog_failed') AND resolved_at IS NULL;")
expect_eq "both failure findings auto-resolve once the fault clears" "0" "$still_open"

# ═══════════════════════════════════════════════════════════════════════════
say "D2 — every check must be able to reach all-clear"
# ═══════════════════════════════════════════════════════════════════════════
#
# Positive half: with the defects present, all six checks fire. Without this the
# negative half below is vacuous — findings that never fired trivially "resolve".
#
# Re-seed the autopilot orphan first. The D1 block above ran several cycles, and
# the reaper consumed the fixture's original orphan; once autopilot_timeout can
# auto-resolve it correctly closes, so by this point there is nothing left to
# detect. Before D2 this assertion passed only BECAUSE the finding could never
# clear — a vacuous pass that the fix exposed. Restoring the precondition is what
# keeps the assertion honest, not a way of softening it.
psql_q "UPDATE autopilot_runs SET status = 'running', started_at = now() - interval '3 hours', completed_at = NULL, duration_ms = NULL WHERE id = 1;" >/dev/null
psql_q "SELECT ops.watchdog();" >/dev/null
fired=$(psql_q "SELECT count(DISTINCT check_key) FROM ops.health_findings WHERE resolved_at IS NULL AND check_key IN ('autopilot_timeout','never_published','approval_stalled','queue_stalled','token_dead','spend_ceiling');")
expect_eq "all six checks fire while their defects are present" "6" "$fired"

# Negative half: repair every underlying condition, then run twice. Twice
# because the reaper needs one pass to clear the orphan it is looking at.
docker exec -i "$CONTAINER" psql -U postgres -q -v ON_ERROR_STOP=1 <<'SQL'
UPDATE autopilot_runs SET status = 'completed', completed_at = now();
UPDATE posts SET published_at = now();
UPDATE content_calendars SET status = 'approved';
UPDATE publish_queue SET status = 'sent';
UPDATE platform_connections SET is_active = true, expires_at = now() + interval '30 days';
UPDATE media_spend_events SET delta_usd = 1;
SQL
psql_q "SELECT ops.watchdog();" >/dev/null
psql_q "SELECT ops.watchdog();" >/dev/null

for k in autopilot_timeout never_published spend_ceiling approval_stalled queue_stalled token_dead; do
  open_n=$(psql_q "SELECT count(*) FROM ops.health_findings WHERE check_key = '$k' AND resolved_at IS NULL;")
  expect_eq "$k clears once its condition is gone" "0" "$open_n"
done

# ── Summary ────────────────────────────────────────────────────────────────
say "Result"
if [ "$FAILURES" -eq 0 ]; then
  printf '  \033[32mAll assertions passed.\033[0m\n\n'
  [ "$SABOTAGE" != "0" ] && {
    printf '  \033[31mBut SABOTAGE=%s was set — the withheld fix MUST make this fail.\033[0m\n' "$SABOTAGE"
    printf '  A green sabotage run means this control cannot detect the defect,\n'
    printf '  so its green on a normal run proves nothing.\n\n'
    exit 1
  }
  exit 0
else
  printf '  \033[31m%s assertion(s) failed.\033[0m\n\n' "$FAILURES"
  [ "$SABOTAGE" != "0" ] && {
    printf '  Expected under SABOTAGE=%s: the control detects the defect it guards.\n\n' "$SABOTAGE"
    exit 0
  }
  exit 1
fi
