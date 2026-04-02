#!/usr/bin/env bash
# Synthex Review Board — PR Triage Script (SYN-591)
# Classifies PR risk tier and outputs a manifest for the Chief Reviewer.
set -euo pipefail

# ── Input ──────────────────────────────────────────────
PR_NUMBER="${PR_NUMBER:-${GITHUB_EVENT_NUMBER:-0}}"
BRANCH="${GITHUB_HEAD_REF:-$(git rev-parse --abbrev-ref HEAD)}"
BASE_REF="${GITHUB_BASE_REF:-main}"

# ── Step 1: Gather diff data ──────────────────────────
CHANGED_FILES=$(git diff --name-only "origin/${BASE_REF}...HEAD" 2>/dev/null || git diff --name-only HEAD~1)
DIFF_STAT=$(git diff --stat "origin/${BASE_REF}...HEAD" 2>/dev/null | tail -1 || echo "0 files changed")

FILES_CHANGED=$(echo "$DIFF_STAT" | grep -oP '\d+(?= files? changed)' || echo "0")
INSERTIONS=$(echo "$DIFF_STAT" | grep -oP '\d+(?= insertions?)' || echo "0")
DELETIONS=$(echo "$DIFF_STAT" | grep -oP '\d+(?= deletions?)' || echo "0")
TOTAL_LINES=$((INSERTIONS + DELETIONS))

# ── Step 2: Detect lockfile-only PRs ──────────────────
LOCKFILE_ONLY=true
while IFS= read -r file; do
  [ -z "$file" ] && continue
  case "$file" in
    package-lock.json|pnpm-lock.yaml|yarn.lock|bun.lockb) ;;
    *) LOCKFILE_ONLY=false; break ;;
  esac
done <<< "$CHANGED_FILES"

# ── Step 3: Detect high-risk and critical paths ───────
HIGH_RISK_PATHS=()
CRITICAL_PATHS=()
HAS_CODE_FILES=false

while IFS= read -r file; do
  [ -z "$file" ] && continue
  case "$file" in
    lib/auth/*|lib/stripe/*|middleware.ts)
      HIGH_RISK_PATHS+=("$file") ;;
    app/api/*)
      HIGH_RISK_PATHS+=("$file") ;;
    prisma/schema.prisma|prisma/migrations/*)
      CRITICAL_PATHS+=("$file") ;;
    .env*|next.config.mjs|vercel.json)
      CRITICAL_PATHS+=("$file") ;;
  esac

  # Check if any actual code files exist (not just docs/config)
  case "$file" in
    *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.sh|*.sql)
      HAS_CODE_FILES=true ;;
  esac
done <<< "$CHANGED_FILES"

# ── Step 4: Check commit messages for escalation ──────
ESCALATION_KEYWORDS=false
COMMITS=$(git log --oneline "origin/${BASE_REF}...HEAD" --format="%s" 2>/dev/null || echo "")
if echo "$COMMITS" | grep -qiE '^(BREAKING|migration|security):'; then
  ESCALATION_KEYWORDS=true
fi

# ── Step 5: Check PR labels (from GitHub event payload) ─
ESCALATION_LABELS=false
if [ -n "${GITHUB_EVENT_PATH:-}" ] && [ -f "$GITHUB_EVENT_PATH" ]; then
  LABELS=$(jq -r '.pull_request.labels[]?.name // empty' "$GITHUB_EVENT_PATH" 2>/dev/null || true)
  if echo "$LABELS" | grep -qiE '^(security|breaking-change|migration)$'; then
    ESCALATION_LABELS=true
  fi
fi

# ── Step 6: Detect new dependencies ───────────────────
NEW_DEPS="[]"
if echo "$CHANGED_FILES" | grep -q "^package\.json$"; then
  NEW_DEPS=$(git diff "origin/${BASE_REF}...HEAD" -- package.json 2>/dev/null \
    | grep -E '^\+\s+"[^"]+":' | grep -v '"version"' \
    | sed 's/.*"\([^"]*\)".*/"\1"/' | jq -sc '.' 2>/dev/null || echo "[]")
fi

# ── Step 7: Classify tier ─────────────────────────────
TIER="standard"

# Lockfile-only => trivial (regardless of size)
if [ "$LOCKFILE_ONLY" = true ]; then
  TIER="trivial"
# No code files (only .md, .txt, config, etc.) => trivial
elif [ "$HAS_CODE_FILES" = false ]; then
  TIER="trivial"
fi

# Critical paths override everything
if [ ${#CRITICAL_PATHS[@]} -gt 0 ]; then
  TIER="critical"
# High-risk paths => high-risk minimum
elif [ ${#HIGH_RISK_PATHS[@]} -gt 0 ]; then
  if [ "$TIER" = "trivial" ] || [ "$TIER" = "standard" ]; then
    TIER="high-risk"
  fi
fi

# Escalation keywords/labels => bump by one
if [ "$ESCALATION_KEYWORDS" = true ] || [ "$ESCALATION_LABELS" = true ]; then
  case "$TIER" in
    trivial)   TIER="standard" ;;
    standard)  TIER="high-risk" ;;
    high-risk) TIER="critical" ;;
  esac
fi

# Large diff => bump by one (unless lockfile-only)
if [ "$LOCKFILE_ONLY" = false ] && [ "$TOTAL_LINES" -gt 500 ]; then
  case "$TIER" in
    trivial)   TIER="standard" ;;
    standard)  TIER="high-risk" ;;
    high-risk) TIER="critical" ;;
  esac
fi

# ── Step 8: Map tier to specialists + timeout ─────────
case "$TIER" in
  trivial)
    SPECIALISTS='["commit-hygiene","dx-review"]'
    TIMEOUT=120
    ;;
  standard)
    SPECIALISTS='["security","architecture","code-quality","test-quality","commit-hygiene","dx-review"]'
    TIMEOUT=300
    ;;
  high-risk)
    SPECIALISTS='["security","architecture","route-compliance","typescript-strictness","performance","breaking-changes","code-quality","test-quality","commit-hygiene","dx-review"]'
    TIMEOUT=480
    ;;
  critical)
    SPECIALISTS='["security","architecture","route-compliance","typescript-strictness","performance","database-review","breaking-changes","react-patterns","dependency-audit","accessibility","test-quality","code-quality","dx-review","commit-hygiene","supabase-patterns","api-testing"]'
    TIMEOUT=600
    # Critical tier: add label + Slack notification
    if [ -n "${GH_TOKEN:-}" ] && [ "$PR_NUMBER" -gt 0 ]; then
      gh pr edit "$PR_NUMBER" --add-label "needs-human-review" 2>/dev/null || true
    fi
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
      curl -s -X POST "$SLACK_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{\"text\":\"Review Board: CRITICAL PR #${PR_NUMBER} requires human review. <https://github.com/${GITHUB_REPOSITORY:-unknown}/pull/${PR_NUMBER}|View PR>\"}" \
        || true
    fi
    ;;
esac

# ── Step 9: Rotate metrics (cap at 500, archive >90 days) ──
METRICS_FILE=".claude/review-board/metrics.jsonl"
ARCHIVE_DIR=".claude/review-board/metrics-archive"
if [ -f "$METRICS_FILE" ] && [ -s "$METRICS_FILE" ]; then
  # Archive entries older than 90 days (best-effort, skip if date command differs)
  NINETY_DAYS_AGO=$(date -u -d "90 days ago" +%Y-%m-%dT%H:%M:%S 2>/dev/null || date -u -v-90d +%Y-%m-%dT%H:%M:%S 2>/dev/null || echo "")
  if [ -n "$NINETY_DAYS_AGO" ]; then
    MONTH=$(date -u +%Y-%m)
    mkdir -p "$ARCHIVE_DIR"
    jq -c "select(.date < \"$NINETY_DAYS_AGO\")" "$METRICS_FILE" >> "$ARCHIVE_DIR/$MONTH.jsonl" 2>/dev/null || true
    jq -c "select(.date >= \"$NINETY_DAYS_AGO\")" "$METRICS_FILE" > "${METRICS_FILE}.tmp" 2>/dev/null || true
    [ -f "${METRICS_FILE}.tmp" ] && mv "${METRICS_FILE}.tmp" "$METRICS_FILE"
  fi
  # Cap at 500 entries
  LINE_COUNT=$(wc -l < "$METRICS_FILE" 2>/dev/null || echo "0")
  if [ "$LINE_COUNT" -gt 500 ]; then
    tail -500 "$METRICS_FILE" > "${METRICS_FILE}.tmp"
    mv "${METRICS_FILE}.tmp" "$METRICS_FILE"
  fi
fi

# ── Step 10: Build high-risk paths JSON ───────────────
HIGH_RISK_JSON="[]"
ALL_RISK_PATHS=("${HIGH_RISK_PATHS[@]}" "${CRITICAL_PATHS[@]}")
if [ ${#ALL_RISK_PATHS[@]} -gt 0 ]; then
  HIGH_RISK_JSON=$(printf '%s\n' "${ALL_RISK_PATHS[@]}" | jq -Rsc 'split("\n") | map(select(. != ""))')
fi

# ── Step 11: Build manifest + write outputs ───────────
cat > manifest.json <<MANIFEST
{
  "pr_number": ${PR_NUMBER},
  "branch": "${BRANCH}",
  "tier": "$TIER",
  "specialists": $SPECIALISTS,
  "timeout_seconds": $TIMEOUT,
  "diff_stats": { "files_changed": $FILES_CHANGED, "insertions": $INSERTIONS, "deletions": $DELETIONS },
  "high_risk_paths": $HIGH_RISK_JSON,
  "new_dependencies": $NEW_DEPS
}
MANIFEST

# Write GitHub Actions outputs
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "tier=$TIER" >> "$GITHUB_OUTPUT"
  echo "timeout=$TIMEOUT" >> "$GITHUB_OUTPUT"
  echo "manifest=$(jq -c . manifest.json)" >> "$GITHUB_OUTPUT"
fi

echo "Triage complete: tier=$TIER, specialists=$(echo "$SPECIALISTS" | jq length), timeout=${TIMEOUT}s"
