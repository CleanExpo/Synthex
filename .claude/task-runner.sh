#!/bin/bash
# SYNTHEX Autonomous Task Runner
# Usage: bash .claude/task-runner.sh
# Reads autonomous-labelled Synthex-team issues from Linear (via API), runs Claude
# Code headlessly, commits, and moves the issue In Progress → Done.
# Stops gracefully on rate limit and resumes after cooldown.

set -euo pipefail

# ── CONFIG ────────────────────────────────────────────────────────────────────
LINEAR_API_KEY="${LINEAR_API_KEY:-}"
TEAM_KEY="SYN"         # Synthex Linear team — detect by team + label, not project (SYN-1028)
COOLDOWN_SECONDS=3600  # 1 hour wait on rate limit
MAX_ISSUES=10          # Safety cap per run
LOG_FILE=".claude/task-runner.log"

# Autonomous-execution labels. An issue carrying any of these (in an eligible
# state) is claimed regardless of which Linear project it belongs to.
AUTONOMOUS_LABELS='["pi-dev:autonomous","mesh:auto","autonomous"]'
# States the runner will actively claim. Excludes "In Review" (awaits a human).
ELIGIBLE_STATES='["Backlog","Todo","In Progress"]'

# Resolved at startup from the team's workflow states.
IN_PROGRESS_STATE_ID=""
DONE_STATE_ID=""

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

# ── RESOLVE TEAM WORKFLOW STATE IDS ────────────────────────────────────────────
# "In Progress" and "Done" state ids are needed to transition issues. Resolved
# once from the team's states (the team has two "started" states — pick the one
# named exactly "In Progress").
resolve_states() {
  local resp
  resp=$(curl -s -X POST https://api.linear.app/graphql \
    -H "Authorization: ${LINEAR_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"{ teams(filter: { key: { eq: \\\"${TEAM_KEY}\\\" } }) { nodes { states { nodes { id name } } } } }\"}")
  IN_PROGRESS_STATE_ID=$(echo "$resp" | jq -r '.data.teams.nodes[0].states.nodes[] | select(.name == "In Progress") | .id' | head -1)
  DONE_STATE_ID=$(echo "$resp" | jq -r '.data.teams.nodes[0].states.nodes[] | select(.name == "Done") | .id' | head -1)
  if [ -z "$IN_PROGRESS_STATE_ID" ] || [ -z "$DONE_STATE_ID" ]; then
    echo "ERROR: could not resolve In Progress / Done state ids for team ${TEAM_KEY}."
    exit 1
  fi
}

# ── FETCH NEXT AUTONOMOUS ISSUE FROM LINEAR ────────────────────────────────────
# Synthex-team issues that carry an autonomous label and sit in an eligible
# state, regardless of Linear project. The `issues` query only paginates by
# created/updated time, so we fetch a batch and pick the highest-priority issue
# client-side (Linear priority: 1=Urgent … 4=Low, 0=None → treated as lowest).
fetch_next_issue() {
  local query
  query=$(jq -nc --argjson labels "$AUTONOMOUS_LABELS" --argjson states "$ELIGIBLE_STATES" --arg team "$TEAM_KEY" '
    { query: "query($team:String!,$labels:[String!],$states:[String!]){ issues(filter: { team: { key: { eq: $team } }, labels: { name: { in: $labels } }, state: { name: { in: $states } } }, orderBy: updatedAt, first: 50) { nodes { id identifier title description url priority } } }",
      variables: { team: $team, labels: $labels, states: $states } }')
  curl -s -X POST https://api.linear.app/graphql \
    -H "Authorization: ${LINEAR_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "$query" \
  | jq -c '[.data.issues.nodes[] | . + {psort: (if (.priority // 0) == 0 then 99 else .priority end)}] | sort_by(.psort) | .[0] // empty'
}

# ── TRANSITION HELPERS ──────────────────────────────────────────────────────────
set_issue_state() {
  local issue_id="$1"
  local state_id="$2"
  curl -s -X POST https://api.linear.app/graphql \
    -H "Authorization: ${LINEAR_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"mutation { issueUpdate(id: \\\"${issue_id}\\\", input: { stateId: \\\"${state_id}\\\" }) { success } }\"}" \
    > /dev/null
}

claim_issue() {
  set_issue_state "$1" "$IN_PROGRESS_STATE_ID"
  echo "$(date): Claimed issue $1 → In Progress" >> "$LOG_FILE"
}

update_issue_done() {
  local issue_id="$1"
  local comment="$2"

  # Add evidence comment, then move the issue to Done.
  curl -s -X POST https://api.linear.app/graphql \
    -H "Authorization: ${LINEAR_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"mutation { commentCreate(input: { issueId: \\\"${issue_id}\\\", body: \\\"${comment}\\\" }) { success } }\"}" \
    > /dev/null

  set_issue_state "$issue_id" "$DONE_STATE_ID"
  echo "$(date): Updated issue ${issue_id} as Done" >> "$LOG_FILE"
}

resolve_states

# ── MAIN LOOP ───────────────────────────────────────────────────────────────────
count=0
while [ $count -lt $MAX_ISSUES ]; do
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Fetching next autonomous issue from Linear..."

  response=$(fetch_next_issue)

  issue_id=$(echo "$response" | jq -r '.id // empty')
  issue_identifier=$(echo "$response" | jq -r '.identifier // empty')
  issue_title=$(echo "$response" | jq -r '.title // empty')
  issue_description=$(echo "$response" | jq -r '.description // empty')

  if [ -z "$issue_id" ]; then
    echo "✅ No more autonomous issues. Task runner complete."
    echo "$(date): Task runner completed — no more autonomous issues" >> "$LOG_FILE"
    break
  fi

  echo "Working on: ${issue_identifier} — ${issue_title}"
  echo "$(date): Starting ${issue_identifier}" >> "$LOG_FILE"

  # Claim the issue so concurrent runners / the operator see it In Progress.
  claim_issue "$issue_id"

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
