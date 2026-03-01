#!/bin/bash
# SYNTHEX Autonomous Task Runner
# Usage: bash .claude/task-runner.sh
# Reads Backlog issues from Linear (via API), runs Claude Code headlessly, commits, updates Linear.
# Stops gracefully on rate limit and resumes after cooldown.

set -euo pipefail

# ── CONFIG ────────────────────────────────────────────────────────────────────
LINEAR_API_KEY="${LINEAR_API_KEY:-}"
PROJECT_NAME="Synthex"
COOLDOWN_SECONDS=3600  # 1 hour wait on rate limit
MAX_ISSUES=10          # Safety cap per run
LOG_FILE=".claude/task-runner.log"

# ── VALIDATION ─────────────────────────────────────────────────────────────────
if [ -z "$LINEAR_API_KEY" ]; then
  echo "ERROR: LINEAR_API_KEY environment variable not set."
  echo "Get your key from: https://linear.app/settings/api"
  echo "Run: export LINEAR_API_KEY=your_key_here"
  exit 1
fi

if ! command -v claude &> /dev/null; then
  echo "ERROR: claude CLI not found. Install Claude Code first."
  exit 1
fi

if ! command -v jq &> /dev/null; then
  echo "ERROR: jq is required. Install with: brew install jq (Mac) or apt install jq (Linux)"
  exit 1
fi

mkdir -p .claude/scratchpad
echo "$(date): Task runner started" >> "$LOG_FILE"

# ── FETCH NEXT BACKLOG ISSUE FROM LINEAR ───────────────────────────────────────
fetch_next_issue() {
  curl -s -X POST https://api.linear.app/graphql \
    -H "Authorization: ${LINEAR_API_KEY}" \
    -H "Content-Type: application/json" \
    -d '{
      "query": "{ issues(filter: { state: { name: { eq: \"Backlog\" } }, project: { name: { eq: \"Synthex\" } } }, orderBy: priority, first: 1) { nodes { id identifier title description url } } }"
    }'
}

# ── UPDATE LINEAR ISSUE ─────────────────────────────────────────────────────────
update_issue_done() {
  local issue_id="$1"
  local comment="$2"

  # Add comment
  curl -s -X POST https://api.linear.app/graphql \
    -H "Authorization: ${LINEAR_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"mutation { commentCreate(input: { issueId: \\\"${issue_id}\\\", body: \\\"${comment}\\\" }) { success } }\"}" \
    > /dev/null

  echo "$(date): Updated issue ${issue_id} as Done" >> "$LOG_FILE"
}

# ── MAIN LOOP ───────────────────────────────────────────────────────────────────
count=0
while [ $count -lt $MAX_ISSUES ]; do
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Fetching next Backlog issue from Linear..."

  response=$(fetch_next_issue)

  issue_id=$(echo "$response" | jq -r '.data.issues.nodes[0].id // empty')
  issue_identifier=$(echo "$response" | jq -r '.data.issues.nodes[0].identifier // empty')
  issue_title=$(echo "$response" | jq -r '.data.issues.nodes[0].title // empty')
  issue_description=$(echo "$response" | jq -r '.data.issues.nodes[0].description // empty')

  if [ -z "$issue_id" ]; then
    echo "✅ No more Backlog issues. Task runner complete."
    echo "$(date): Task runner completed — no more Backlog issues" >> "$LOG_FILE"
    break
  fi

  echo "Working on: ${issue_identifier} — ${issue_title}"
  echo "$(date): Starting ${issue_identifier}" >> "$LOG_FILE"

  # Write context to scratchpad for Claude
  cat > .claude/scratchpad/current-session.md << EOF
# Current Task: ${issue_identifier}
## Title: ${issue_title}
## Started: $(date)

## Issue Description:
${issue_description}

## Instructions:
- Fix exactly what the issue describes, nothing more
- Commit with: git commit -m "${issue_identifier}: [short description]"
- Do NOT run git push
- Do NOT add new features
- Write "TASK COMPLETE: ${issue_identifier}" as the last line when done
EOF

  # Run Claude Code headlessly
  prompt="You are working on SYNTHEX. Read .claude/scratchpad/current-session.md for your current task. Complete the task described, make the minimal required code changes, and commit with the issue identifier ${issue_identifier} in the commit message. Do not push. Do not add features. Fix exactly what is described. When complete, output: TASK COMPLETE: ${issue_identifier}"

  echo "Running Claude Code headlessly for ${issue_identifier}..."

  if claude -p "$prompt" --max-turns 20 2>&1 | tee -a "$LOG_FILE"; then
    echo "$(date): ${issue_identifier} completed successfully" >> "$LOG_FILE"
    update_issue_done "$issue_id" "Completed by autonomous task runner on $(date). See git log for file changes."
  else
    exit_code=$?
    if [ $exit_code -eq 124 ] || echo "$exit_code" | grep -q "rate"; then
      echo "⏸ Rate limit hit. Waiting ${COOLDOWN_SECONDS} seconds before resuming..."
      echo "$(date): Rate limit hit, cooling down for ${COOLDOWN_SECONDS}s" >> "$LOG_FILE"
      sleep $COOLDOWN_SECONDS
      continue
    else
      echo "❌ Error on ${issue_identifier}. Check log: ${LOG_FILE}"
      echo "$(date): Error on ${issue_identifier} — exit code ${exit_code}" >> "$LOG_FILE"
      break
    fi
  fi

  count=$((count + 1))
done

echo ""
echo "Task runner finished. Issues processed: ${count}"
echo "Check Linear for status updates."
