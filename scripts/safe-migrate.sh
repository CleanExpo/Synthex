#!/bin/bash
#
# SYNTHEX Safe Migration Wrapper (SYN-589)
# -----------------------------------------
# A guarded wrapper around Supabase migrations that refuses to touch
# production without first validating the migration on an isolated
# Supabase database branch and receiving an explicit `yes` confirmation.
#
# The six live tables SYN-583 alters (posts, calendar_posts, gbp_reviews,
# seasonal_signals, authority_scores, autopilot_runs) hold 21 users' data
# and 192 live posts. This wrapper exists so that no engineer can run
# `npx supabase db push` straight against production.
#
# Workflow (per SYN-589 done criteria):
#   1. Verify the Supabase CLI is authenticated and linked to production.
#   2. Accept a migration file path as the sole argument.
#   3. Create a Supabase database branch for the migration.
#   4. Apply the migration to the branch only.
#   5. Validate the branch: new columns exist, row counts unchanged,
#      new indexes exist.
#   6. Print a validation summary.
#   7. Prompt "Apply to production? (yes/no)" — requires literal `yes`.
#   8. On `yes`: apply to production with a final confirmation log entry.
#   9. On anything else: report the branch and exit 0 (branch only).
#
# Usage:
#   ./scripts/safe-migrate.sh supabase/migrations/YYYYMMDDHHMMSS_migration.sql
#
# Environment overrides (optional):
#   PROD_DB_URL      Production Postgres connection string, used for the
#                    pre-migration row-count baseline. If unset, the script
#                    derives it from the branch's source and, failing that,
#                    marks the row-count check inconclusive (never silently
#                    passes).
#   BRANCH_DB_URL    Force the branch connection string instead of resolving
#                    it from `supabase branches get`.
#   SKIP_BRANCH      If "1", assume the branch already exists (re-run/debug).
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
PRODUCTION_PROJECT_REF="znyjoyjsvjotlzjppzal"

# The six live production tables SYN-583 alters. Row counts on these must be
# identical before and after the migration (schema-only change, zero data loss).
AFFECTED_TABLES=(
    "posts"
    "calendar_posts"
    "gbp_reviews"
    "seasonal_signals"
    "authority_scores"
    "autopilot_runs"
)

# ---------------------------------------------------------------------------
# Colors + print helpers (matched to scripts/deploy-database.sh conventions)
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_info()    { echo -e "${CYAN}ℹ️  $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error()   { echo -e "${RED}❌ $1${NC}" >&2; }
print_step()    { echo -e "\n${MAGENTA}🔹 $1${NC}"; }

fail() {
    print_error "$1"
    exit 1
}

usage() {
    cat <<EOF
SYNTHEX Safe Migration Wrapper (SYN-589)

Usage:
  $0 <path-to-migration.sql>
  $0 -h | --help

Arguments:
  <path-to-migration.sql>   A .sql file under supabase/migrations/ to validate
                            on a branch before optionally applying to prod.

This wrapper NEVER applies to production without:
  1) a green branch validation, and
  2) an explicit 'yes' at the confirmation prompt.

Examples:
  $0 supabase/migrations/20260401120000_syn583_ml_metadata.sql
EOF
}

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
if [[ $# -eq 0 ]]; then
    usage
    fail "No migration file supplied."
fi

case "${1:-}" in
    -h|--help)
        usage
        exit 0
        ;;
esac

if [[ $# -ne 1 ]]; then
    usage
    fail "Expected exactly one argument (the migration file path), got $#."
fi

MIGRATION_FILE="$1"

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${GREEN}🔐 SYNTHEX Safe Migration Wrapper${NC}"
echo "=================================="
echo "Migration : $MIGRATION_FILE"
echo "Prod ref  : $PRODUCTION_PROJECT_REF"
echo ""

# ---------------------------------------------------------------------------
# Pre-flight: dependencies + file sanity
# ---------------------------------------------------------------------------
print_step "Pre-flight checks"

command -v npx >/dev/null 2>&1 || fail "npx not found on PATH. Install Node.js/npm."

HAVE_PSQL=1
if ! command -v psql >/dev/null 2>&1; then
    HAVE_PSQL=0
    print_warning "psql not found — branch validation queries cannot run automatically."
    print_warning "The production prompt will be BLOCKED until validation is done manually."
fi

# Migration file must exist, be a .sql, and live under supabase/migrations.
[[ -f "$MIGRATION_FILE" ]] || fail "Migration file not found: $MIGRATION_FILE"
[[ "$MIGRATION_FILE" == *.sql ]] || fail "Migration file must be a .sql file: $MIGRATION_FILE"

# Resolve to an absolute path for a robust containment check.
MIGRATION_ABS="$(cd "$(dirname "$MIGRATION_FILE")" && pwd)/$(basename "$MIGRATION_FILE")"
MIGRATIONS_DIR_ABS="$PROJECT_ROOT/supabase/migrations"
case "$MIGRATION_ABS" in
    "$MIGRATIONS_DIR_ABS"/*) : ;;
    *) fail "Migration file must live under supabase/migrations/ (got: $MIGRATION_ABS)" ;;
esac
print_success "Migration file located: $MIGRATION_ABS"

# ---------------------------------------------------------------------------
# Step 1 — Validate Supabase CLI is authenticated and linked to production
# ---------------------------------------------------------------------------
print_step "Step 1/9 — Verify Supabase CLI auth + production link"

STATUS_OUT=""
if ! STATUS_OUT="$(npx --yes supabase status 2>&1)"; then
    print_error "\`npx supabase status\` failed. Are you authenticated and linked?"
    echo "$STATUS_OUT"
    fail "Run 'npx supabase login' and 'npx supabase link --project-ref $PRODUCTION_PROJECT_REF' first."
fi

if echo "$STATUS_OUT" | grep -q "$PRODUCTION_PROJECT_REF"; then
    print_success "Supabase CLI is linked to production project ($PRODUCTION_PROJECT_REF)."
else
    print_error "Supabase CLI is NOT linked to the expected production project."
    print_error "Expected project ref: $PRODUCTION_PROJECT_REF"
    echo "$STATUS_OUT"
    fail "Refusing to continue against an unexpected project."
fi

# ---------------------------------------------------------------------------
# Step 2 — (argument already accepted) derive branch identity
# ---------------------------------------------------------------------------
print_step "Step 2/9 — Derive branch identity from migration"

DATE_TAG="$(date +%Y%m%d)"

# Short, stable content hash of the migration file for a deterministic branch name.
SHORT_HASH=""
if command -v git >/dev/null 2>&1 && git -C "$PROJECT_ROOT" rev-parse >/dev/null 2>&1; then
    SHORT_HASH="$(git -C "$PROJECT_ROOT" hash-object "$MIGRATION_ABS" 2>/dev/null | cut -c1-8 || true)"
fi
if [[ -z "$SHORT_HASH" ]]; then
    if command -v sha256sum >/dev/null 2>&1; then
        SHORT_HASH="$(sha256sum "$MIGRATION_ABS" | cut -c1-8)"
    elif command -v shasum >/dev/null 2>&1; then
        SHORT_HASH="$(shasum -a 256 "$MIGRATION_ABS" | cut -c1-8)"
    else
        fail "No git/sha256sum/shasum available to hash the migration file."
    fi
fi

BRANCH_NAME="migration-${DATE_TAG}-${SHORT_HASH}"
print_success "Branch name: $BRANCH_NAME"

# ---------------------------------------------------------------------------
# Parse the migration for expected columns and indexes (used in Step 5)
# ---------------------------------------------------------------------------
# Columns added:  ADD COLUMN [IF NOT EXISTS] <name> ...
EXPECTED_COLUMNS=()
while IFS= read -r col; do
    [[ -n "$col" ]] && EXPECTED_COLUMNS+=("$col")
done < <(grep -ioE 'ADD[[:space:]]+COLUMN[[:space:]]+(IF[[:space:]]+NOT[[:space:]]+EXISTS[[:space:]]+)?"?[a-zA-Z_][a-zA-Z0-9_]*"?' "$MIGRATION_ABS" \
    | sed -E 's/.*[[:space:]]//' \
    | tr -d '"' \
    | sort -u)

# Indexes created: CREATE [UNIQUE] INDEX [CONCURRENTLY] [IF NOT EXISTS] <name>
EXPECTED_INDEXES=()
while IFS= read -r idx; do
    [[ -n "$idx" ]] && EXPECTED_INDEXES+=("$idx")
done < <(grep -ioE 'CREATE[[:space:]]+(UNIQUE[[:space:]]+)?INDEX[[:space:]]+(CONCURRENTLY[[:space:]]+)?(IF[[:space:]]+NOT[[:space:]]+EXISTS[[:space:]]+)?"?[a-zA-Z_][a-zA-Z0-9_]*"?' "$MIGRATION_ABS" \
    | sed -E 's/.*[[:space:]]//' \
    | tr -d '"' \
    | sort -u)

print_info "Migration declares ${#EXPECTED_COLUMNS[@]} new column(s), ${#EXPECTED_INDEXES[@]} new index(es)."

# ---------------------------------------------------------------------------
# Baseline: capture production row counts BEFORE anything is applied.
# ---------------------------------------------------------------------------
declare -A ROWS_BEFORE
BASELINE_OK=0
resolve_prod_db_url() {
    if [[ -n "${PROD_DB_URL:-}" ]]; then
        echo "$PROD_DB_URL"
        return 0
    fi
    # Fall back to whatever the CLI exposes; kept intentionally conservative.
    if echo "$STATUS_OUT" | grep -qiE 'DB URL'; then
        echo "$STATUS_OUT" | grep -iE 'DB URL' | head -n1 | sed -E 's/.*DB URL[[:space:]]*:?[[:space:]]*//I'
        return 0
    fi
    return 1
}

count_rows() {
    # count_rows <db_url> <table>  -> prints integer or empty on failure
    local db_url="$1" table="$2"
    psql "$db_url" -tAc "SELECT count(*) FROM public.\"$table\";" 2>/dev/null | tr -d '[:space:]'
}

if [[ "$HAVE_PSQL" -eq 1 ]]; then
    if PROD_URL="$(resolve_prod_db_url)"; then
        print_step "Baseline — capturing production row counts (read-only)"
        BASELINE_OK=1
        for t in "${AFFECTED_TABLES[@]}"; do
            c="$(count_rows "$PROD_URL" "$t")"
            if [[ -z "$c" ]]; then
                print_warning "Could not read row count for '$t' from production — baseline inconclusive."
                BASELINE_OK=0
            else
                ROWS_BEFORE["$t"]="$c"
                print_info "before: $t = $c rows"
            fi
        done
    else
        print_warning "No production DB URL available (set PROD_DB_URL) — row-count baseline skipped."
    fi
fi

# ---------------------------------------------------------------------------
# Step 3 — Create a Supabase database branch
# ---------------------------------------------------------------------------
print_step "Step 3/9 — Create Supabase database branch"

if [[ "${SKIP_BRANCH:-0}" == "1" ]]; then
    print_warning "SKIP_BRANCH=1 — assuming branch '$BRANCH_NAME' already exists."
else
    if ! npx --yes supabase branches create "$BRANCH_NAME" 2>&1 | tee /tmp/safe-migrate-branch.$$; then
        fail "Failed to create Supabase branch '$BRANCH_NAME'."
    fi
    print_success "Branch created: $BRANCH_NAME"
fi

# ---------------------------------------------------------------------------
# Resolve the branch connection string
# ---------------------------------------------------------------------------
resolve_branch_db_url() {
    if [[ -n "${BRANCH_DB_URL:-}" ]]; then
        echo "$BRANCH_DB_URL"
        return 0
    fi
    local out
    if out="$(npx --yes supabase branches get "$BRANCH_NAME" -o json 2>/dev/null)"; then
        if command -v node >/dev/null 2>&1; then
            echo "$out" | node -e '
                let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
                  try{const j=JSON.parse(s);
                    const u=j.db_url||j.database_url||j.postgres_url||(j.database&&j.database.url)||"";
                    if(u)process.stdout.write(u);
                  }catch(e){}
                });' && return 0
        fi
    fi
    return 1
}

BRANCH_URL=""
if BRANCH_URL="$(resolve_branch_db_url)" && [[ -n "$BRANCH_URL" ]]; then
    print_success "Resolved branch connection string."
else
    BRANCH_URL=""
    print_warning "Could not auto-resolve the branch connection string."
    print_warning "Set BRANCH_DB_URL to enable automatic branch validation."
fi

# ---------------------------------------------------------------------------
# Step 4 — Apply migration to the branch (branch only)
# ---------------------------------------------------------------------------
print_step "Step 4/9 — Apply migration to the branch"

if [[ -n "$BRANCH_URL" ]]; then
    if ! npx --yes supabase db push --db-url "$BRANCH_URL" 2>&1; then
        fail "Migration failed to apply to the branch. Nothing touched production."
    fi
    print_success "Migration applied to branch '$BRANCH_NAME'."
else
    print_warning "Branch URL unknown — skipping automatic branch push."
    print_warning "Apply manually against the branch, then re-run validation."
fi

# ---------------------------------------------------------------------------
# Step 5 — Validation queries against the branch schema
# ---------------------------------------------------------------------------
print_step "Step 5/9 — Validate branch schema"

VALIDATION_OK=1

if [[ "$HAVE_PSQL" -eq 0 || -z "$BRANCH_URL" ]]; then
    print_warning "Automatic validation unavailable (need psql + resolved branch URL)."
    print_warning "Run the validation queries manually before approving production."
    VALIDATION_OK=0
else
    # (a) Verify all expected new columns exist.
    declare -A COLUMNS_CONFIRMED
    if [[ "${#EXPECTED_COLUMNS[@]}" -gt 0 ]]; then
        print_info "Checking ${#EXPECTED_COLUMNS[@]} expected column(s)..."
        for col in "${EXPECTED_COLUMNS[@]}"; do
            found="$(psql "$BRANCH_URL" -tAc \
                "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND column_name='$col';" \
                2>/dev/null | tr -d '[:space:]')"
            if [[ "${found:-0}" -ge 1 ]]; then
                COLUMNS_CONFIRMED["$col"]=1
                print_success "column present: $col"
            else
                print_error "column MISSING on branch: $col"
                VALIDATION_OK=0
            fi
        done
    else
        print_info "No ADD COLUMN statements detected — skipping column check."
    fi

    # (b) Verify row counts unchanged on all affected tables (no data loss).
    if [[ "$BASELINE_OK" -eq 1 ]]; then
        print_info "Comparing row counts (production baseline vs branch)..."
        for t in "${AFFECTED_TABLES[@]}"; do
            after="$(count_rows "$BRANCH_URL" "$t")"
            before="${ROWS_BEFORE[$t]:-}"
            if [[ -z "$after" ]]; then
                print_error "Could not read branch row count for '$t'."
                VALIDATION_OK=0
            elif [[ "$before" != "$after" ]]; then
                print_error "ROW COUNT CHANGED on '$t': before=$before after=$after (possible data loss)."
                VALIDATION_OK=0
            else
                print_success "row count stable: $t = $after"
            fi
        done
    else
        print_warning "Row-count baseline was inconclusive — cannot certify zero data loss."
        VALIDATION_OK=0
    fi

    # (c) Verify new indexes exist (only if the migration creates any).
    if [[ "${#EXPECTED_INDEXES[@]}" -gt 0 ]]; then
        print_info "Checking ${#EXPECTED_INDEXES[@]} expected index(es)..."
        for idx in "${EXPECTED_INDEXES[@]}"; do
            found="$(psql "$BRANCH_URL" -tAc \
                "SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname='$idx';" \
                2>/dev/null | tr -d '[:space:]')"
            if [[ "${found:-0}" -ge 1 ]]; then
                print_success "index present: $idx"
            else
                print_error "index MISSING on branch: $idx"
                VALIDATION_OK=0
            fi
        done
    else
        print_info "No CREATE INDEX statements detected — skipping index check."
    fi
fi

# ---------------------------------------------------------------------------
# Step 6 — Validation summary
# ---------------------------------------------------------------------------
print_step "Step 6/9 — Validation summary"

echo "  Branch            : $BRANCH_NAME"
echo "  Columns declared  : ${#EXPECTED_COLUMNS[@]} (${EXPECTED_COLUMNS[*]:-none})"
echo "  Indexes declared  : ${#EXPECTED_INDEXES[@]} (${EXPECTED_INDEXES[*]:-none})"
if [[ "$BASELINE_OK" -eq 1 ]]; then
    echo "  Row counts (before -> after on branch):"
    for t in "${AFFECTED_TABLES[@]}"; do
        after="$(count_rows "$BRANCH_URL" "$t" 2>/dev/null)"
        echo "    - $t: ${ROWS_BEFORE[$t]:-?} -> ${after:-?}"
    done
else
    echo "  Row counts        : NOT VERIFIED"
fi
if [[ "$VALIDATION_OK" -eq 1 ]]; then
    print_success "Branch validation PASSED."
else
    print_warning "Branch validation did NOT fully pass (see above)."
fi

# ---------------------------------------------------------------------------
# Step 7 — Prompt for production
# ---------------------------------------------------------------------------
print_step "Step 7/9 — Production confirmation gate"

if [[ "$VALIDATION_OK" -ne 1 ]]; then
    print_error "Refusing to offer production apply: validation is not fully green."
    echo ""
    print_info "Migration applied to branch only. Branch: $BRANCH_NAME"
    exit 0
fi

# Refuse to auto-approve in a non-interactive shell.
if [[ ! -t 0 ]]; then
    print_warning "Non-interactive shell detected — will not prompt for a production apply."
    print_info "Migration applied to branch only. Branch: $BRANCH_NAME"
    exit 0
fi

echo -e "${YELLOW}Validation passed. Apply to production? (yes/no)${NC}"
read -r REPLY

# ---------------------------------------------------------------------------
# Step 8 / Step 9 — Apply to prod on explicit `yes`, else branch-only exit
# ---------------------------------------------------------------------------
if [[ "$REPLY" == "yes" ]]; then
    print_step "Step 8/9 — Applying to PRODUCTION ($PRODUCTION_PROJECT_REF)"
    TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "[$TS] safe-migrate: applying $MIGRATION_FILE to production $PRODUCTION_PROJECT_REF (branch $BRANCH_NAME, hash $SHORT_HASH)"

    if ! npx --yes supabase db push --linked 2>&1; then
        fail "PRODUCTION migration FAILED. Notify Phill via Slack immediately and follow docs/MIGRATION-PROTOCOL.md rollback."
    fi

    TS_DONE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    print_success "Production migration applied."
    echo "[$TS_DONE] safe-migrate: production migration COMPLETE for $MIGRATION_FILE (branch $BRANCH_NAME)"
    exit 0
else
    print_step "Step 9/9 — Branch only"
    print_info "Migration applied to branch only. Branch: $BRANCH_NAME"
    exit 0
fi
