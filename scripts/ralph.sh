#!/bin/bash
# ============================================================================
# Ralph Wiggum Technique - Autonomous Task Completion Loop
# ============================================================================
# Usage:
#   ./scripts/ralph.sh --init          # Initialise .planning/phases/ structure
#   ./scripts/ralph.sh [max_iterations] # Run the loop (default: 50)
#
# Based on: Matt Pocock / Jeffrey Huntley technique
# Adapted for Synthex (npm, .planning/phases/ structure)
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configuration - paths relative to project root
PLANS_DIR="./.planning/phases"
PRD_FILE="$PLANS_DIR/prd.json"
PROGRESS_FILE="$PLANS_DIR/progress.txt"
PROMPT_FILE="$PLANS_DIR/ralph-prompt.md"

# ============================================================================
# Helper Functions
# ============================================================================

print_header() {
    echo -e "\n${CYAN}============================================${NC}"
    echo -e "${CYAN}  Ralph Wiggum Technique${NC}"
    echo -e "${CYAN}  Autonomous Task Completion Loop${NC}"
    echo -e "${CYAN}============================================${NC}\n"
}

print_phase() {
    echo -e "\n${MAGENTA}>>> $1${NC}"
}

print_success() {
    echo -e "${GREEN}$1${NC}"
}

print_warning() {
    echo -e "${YELLOW}$1${NC}"
}

print_error() {
    echo -e "${RED}$1${NC}"
}

print_info() {
    echo -e "${BLUE}$1${NC}"
}

# ============================================================================
# Initialisation Function
# ============================================================================

initialize_ralph() {
    print_header
    print_phase "Initialising Ralph Wiggum for Synthex..."

    # Create .planning/phases directory
    if [ ! -d "$PLANS_DIR" ]; then
        mkdir -p "$PLANS_DIR"
        print_success "Created $PLANS_DIR directory"
    else
        print_info "Directory $PLANS_DIR already exists"
    fi

    # Create PRD template
    if [ ! -f "$PRD_FILE" ]; then
        cat > "$PRD_FILE" << 'PRDEOF'
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "project": "Synthex",
  "version": "1.0.0",
  "created_at": "2026-01-07T00:00:00Z",
  "last_updated": "2026-01-07T00:00:00Z",

  "user_stories": [
    {
      "id": "US-001",
      "epic": "Setup",
      "title": "Example: Initial feature setup",
      "description": "As a developer, I want the feature implemented so I can deliver value",
      "priority": "critical",
      "acceptance_criteria": [
        "npm run dev starts without errors",
        "All tests pass",
        "No TypeScript errors"
      ],
      "verification": {
        "type_check": true,
        "lint": true,
        "unit_tests": true,
        "e2e_tests": false,
        "build": true
      },
      "passes": false,
      "last_attempt": null,
      "attempt_count": 0,
      "notes": "",
      "depends_on": []
    }
  ],

  "metadata": {
    "total_stories": 1,
    "passing_stories": 0,
    "current_focus": null,
    "max_attempts_per_task": 3
  }
}
PRDEOF
        print_success "Created $PRD_FILE template"
    else
        print_info "File $PRD_FILE already exists"
    fi

    # Create progress file
    if [ ! -f "$PROGRESS_FILE" ]; then
        cat > "$PROGRESS_FILE" << PROGRESSEOF
# Ralph Wiggum Progress Log
# Project: $(basename "$(pwd)")
# Created: $(date -Iseconds 2>/dev/null || date +%Y-%m-%dT%H:%M:%S)

This file tracks learnings across iterations. Each session appends here.
The LLM reads this at the start of each iteration for context.

---

PROGRESSEOF
        print_success "Created $PROGRESS_FILE"
    else
        print_info "File $PROGRESS_FILE already exists"
    fi

    # Create prompt template
    if [ ! -f "$PROMPT_FILE" ]; then
        cat > "$PROMPT_FILE" << 'PROMPTEOF'
# Ralph Wiggum Iteration {{ITERATION}}

## Current Task: {{TASK_ID}}

You are working on user story **{{TASK_ID}}** as part of the Ralph Wiggum autonomous development loop for Synthex.

## Your Context Files

1. **PRD (Task List)**: `.planning/phases/prd.json`
   - Contains all user stories with acceptance criteria
   - Check the `passes` flag - only work on tasks where `passes: false`

2. **Progress Log**: `.planning/phases/progress.txt`
   - Contains learnings from previous iterations
   - Read this for context about what has been tried

## Your Mission

1. **Read the PRD** - Find task {{TASK_ID}} and understand:
   - Acceptance criteria (what success looks like)
   - Dependencies (what must be done first)
   - Previous attempts (check attempt_count)

2. **Check Progress Log** - Look for:
   - Relevant learnings from past iterations
   - Issues encountered on similar tasks
   - Patterns that worked

3. **Implement the Task**
   - Write code to satisfy ALL acceptance criteria
   - Follow project conventions (check CLAUDE.md)
   - Add or update tests as needed
   - Handle edge cases

4. **Verify Before Claiming Complete**
   Run these commands and ensure ALL pass:
   ```bash
   npm run type-check  # TypeScript must compile
   npm run lint        # No lint errors
   npm test            # All tests pass
   npm run build       # Build succeeds
   ```

5. **Update Progress Log**
   Append a session entry to `.planning/phases/progress.txt`:
   ```markdown
   ---

   ## Session {{ITERATION}}: [timestamp]
   **Task**: {{TASK_ID}} - [title]
   **Status**: [COMPLETED | IN_PROGRESS | BLOCKED]

   ### Work Done
   - [List changes made]

   ### Issues Encountered
   - [Any problems found]

   ### Learnings
   - [Knowledge for future iterations]

   ### Next Steps
   1. [If incomplete, what to do next]
   ```

## Critical Rules

1. **Never claim success without verification** - Run the actual commands
2. **One task at a time** - Focus only on {{TASK_ID}}
3. **Be honest about failures** - Record them in progress.txt
4. **Small, incremental changes** - Easier to verify and debug
5. **Commit on success** - Use conventional commit format

## Output Format

After completing work, report:

```
## Iteration {{ITERATION}} Complete

### Task: {{TASK_ID}}
### Status: [PASS | FAIL]

### Verification Results
- Type Check: [PASS/FAIL]
- Lint: [PASS/FAIL]
- Tests: [PASS/FAIL]
- Build: [PASS/FAIL]
- E2E: [PASS/FAIL/SKIPPED]

### Changes Made
- [Files modified]

### If FAIL - What Needs Fixing
- [Root cause]
- [Suggested fix for next iteration]
```
PROMPTEOF
        print_success "Created $PROMPT_FILE"
    else
        print_info "File $PROMPT_FILE already exists"
    fi

    echo ""
    print_success "Ralph Wiggum initialised successfully!"
    echo ""
    print_info "Next steps:"
    echo "  1. Edit .planning/phases/prd.json with your user stories"
    echo "  2. Run: ./scripts/ralph.sh 50"
    echo ""
}

# ============================================================================
# Prerequisite Checks
# ============================================================================

check_prerequisites() {
    print_phase "Checking prerequisites..."

    local missing=0

    # Check Claude CLI
    if ! command -v claude &> /dev/null; then
        print_error "Claude CLI not found"
        print_info "Install with: npm install -g @anthropic-ai/claude-code"
        missing=1
    else
        print_success "Claude CLI found"
    fi

    # Check jq for JSON parsing
    if ! command -v jq &> /dev/null; then
        print_error "jq not found (required for JSON parsing)"
        print_info "Install with: winget install jqlang.jq (Windows) or brew install jq (Mac)"
        missing=1
    else
        print_success "jq found"
    fi

    # Check PRD file
    if [ ! -f "$PRD_FILE" ]; then
        print_error "PRD file not found at $PRD_FILE"
        print_info "Run: ./scripts/ralph.sh --init"
        missing=1
    else
        print_success "PRD file found"
    fi

    # Check progress file
    if [ ! -f "$PROGRESS_FILE" ]; then
        print_warning "Progress file not found, creating..."
        echo "# Ralph Wiggum Progress Log" > "$PROGRESS_FILE"
        echo "" >> "$PROGRESS_FILE"
    fi

    if [ $missing -eq 1 ]; then
        print_error "Prerequisites not met. Exiting."
        exit 1
    fi

    print_success "All prerequisites OK"
}

# ============================================================================
# Task Management Functions
# ============================================================================

get_next_task() {
    # Find highest priority unpassed task (respecting dependencies)
    # Priority order: critical > high > medium > low

    jq -r '
        # Define priority order
        def priority_value:
            if . == "critical" then 0
            elif . == "high" then 1
            elif . == "medium" then 2
            elif . == "low" then 3
            else 4
            end;

        # Get IDs of passing tasks
        .user_stories
        | map(select(.passes == true) | .id) as $passing

        # Filter to unpassed tasks where all dependencies are met
        | .user_stories
        | map(select(
            .passes == false and
            ((.depends_on // []) | all(. as $dep | $passing | contains([$dep])))
        ))

        # Sort by priority
        | sort_by(.priority | priority_value)

        # Return first task ID or empty
        | first | .id // empty
    ' "$PRD_FILE"
}

check_all_passed() {
    local failing
    failing=$(jq '[.user_stories[] | select(.passes == false)] | length' "$PRD_FILE")
    [ "$failing" -eq 0 ]
}

get_task_title() {
    local task_id="$1"
    jq -r --arg id "$task_id" '.user_stories[] | select(.id == $id) | .title' "$PRD_FILE"
}

# ============================================================================
# Verification Pipeline
# ============================================================================

run_verification() {
    print_phase "Running verification pipeline..."

    local failed=0

    # Type check
    print_info "  Running type check..."
    if npm run type-check 2>/dev/null; then
        print_success "  Type check: PASS"
    else
        print_error "  Type check: FAIL"
        failed=1
    fi

    # Lint
    print_info "  Running lint..."
    if npm run lint 2>/dev/null; then
        print_success "  Lint: PASS"
    else
        print_error "  Lint: FAIL"
        failed=1
    fi

    # Unit tests
    print_info "  Running tests..."
    if npm test 2>/dev/null; then
        print_success "  Tests: PASS"
    else
        print_error "  Tests: FAIL"
        failed=1
    fi

    # Build (skipped by default to save time — enable by setting RALPH_RUN_BUILD=1)
    if [ "${RALPH_RUN_BUILD:-0}" = "1" ]; then
        print_info "  Running build..."
        if npm run build 2>/dev/null; then
            print_success "  Build: PASS"
        else
            print_error "  Build: FAIL"
            failed=1
        fi
    else
        print_warning "  Build: SKIPPED (set RALPH_RUN_BUILD=1 to enable)"
    fi

    # E2E tests (only if previous checks passed and RALPH_RUN_E2E=1)
    if [ $failed -eq 0 ] && [ "${RALPH_RUN_E2E:-0}" = "1" ]; then
        print_info "  Running E2E tests..."
        if npm run e2e 2>/dev/null; then
            print_success "  E2E: PASS"
        else
            print_error "  E2E: FAIL"
            failed=1
        fi
    else
        print_warning "  E2E: SKIPPED (set RALPH_RUN_E2E=1 to enable)"
    fi

    return $failed
}

# ============================================================================
# Iteration Execution
# ============================================================================

run_iteration() {
    local iteration="$1"
    local task_id="$2"
    local task_title
    task_title=$(get_task_title "$task_id")

    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  Iteration $iteration: $task_id${NC}"
    echo -e "${CYAN}  $task_title${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    # Build the prompt
    local prompt
    prompt=$(cat "$PROMPT_FILE")
    prompt="${prompt//\{\{ITERATION\}\}/$iteration}"
    prompt="${prompt//\{\{TASK_ID\}\}/$task_id}"

    # Run Claude Code with context
    print_phase "Invoking Claude Code..."

    # Create a temporary prompt file for this iteration
    local temp_prompt
    temp_prompt=$(mktemp /tmp/ralph-prompt-XXXXXX.md)
    echo "$prompt" > "$temp_prompt"

    # Run Claude with PRD and progress as context
    claude --print "$(cat "$temp_prompt")" \
        --add-file "$PRD_FILE" \
        --add-file "$PROGRESS_FILE" || true

    rm -f "$temp_prompt"

    # Run verification
    if run_verification; then
        print_success "Verification passed! Marking $task_id as complete."

        # Update PRD - mark task as passing
        local timestamp
        timestamp=$(date -Iseconds 2>/dev/null || date +%Y-%m-%dT%H:%M:%S)

        jq --arg id "$task_id" --arg ts "$timestamp" '
            .user_stories |= map(
                if .id == $id
                then .passes = true | .last_attempt = $ts
                else .
                end
            ) |
            .metadata.passing_stories = ([.user_stories[] | select(.passes == true)] | length) |
            .last_updated = $ts
        ' "$PRD_FILE" > "$PRD_FILE.tmp" && mv "$PRD_FILE.tmp" "$PRD_FILE"

        # Commit the changes (stage individual files, never git add -A)
        git add "$PRD_FILE" "$PROGRESS_FILE"
        git diff --cached --name-only | xargs -r git add
        git commit -m "feat($task_id): $task_title

Ralph Wiggum: Iteration $iteration complete

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>" || true

        return 0
    else
        print_warning "Verification failed. Recording attempt."

        # Update attempt count
        local timestamp
        timestamp=$(date -Iseconds 2>/dev/null || date +%Y-%m-%dT%H:%M:%S)

        jq --arg id "$task_id" --arg ts "$timestamp" '
            .user_stories |= map(
                if .id == $id
                then .attempt_count += 1 | .last_attempt = $ts
                else .
                end
            )
        ' "$PRD_FILE" > "$PRD_FILE.tmp" && mv "$PRD_FILE.tmp" "$PRD_FILE"

        return 1
    fi
}

# ============================================================================
# Summary Report
# ============================================================================

show_summary() {
    local start_time="$1"
    local iterations="$2"

    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local minutes=$((duration / 60))
    local seconds=$((duration % 60))

    local passing
    local total
    passing=$(jq '.metadata.passing_stories' "$PRD_FILE")
    total=$(jq '.metadata.total_stories // (.user_stories | length)' "$PRD_FILE")

    echo ""
    echo -e "${CYAN}============================================${NC}"
    echo -e "${CYAN}  Summary${NC}"
    echo -e "${CYAN}============================================${NC}"
    echo -e "  Iterations: $iterations"
    echo -e "  Progress: ${GREEN}$passing${NC}/$total tasks complete"
    echo -e "  Duration: ${minutes}m ${seconds}s"
    echo ""
}

# ============================================================================
# Main Entry Point
# ============================================================================

main() {
    # Handle --init flag
    if [ "$1" = "--init" ] || [ "$1" = "-i" ]; then
        initialize_ralph
        exit 0
    fi

    # Handle --help flag
    if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
        echo "Ralph Wiggum Technique - Autonomous Task Completion (Synthex)"
        echo ""
        echo "Usage:"
        echo "  ./scripts/ralph.sh --init          Initialise .planning/phases/ directory"
        echo "  ./scripts/ralph.sh [max_iterations] Run the loop (default: 50)"
        echo "  ./scripts/ralph.sh --help           Show this help"
        echo ""
        echo "Environment variables:"
        echo "  RALPH_RUN_BUILD=1   Enable build step in verification"
        echo "  RALPH_RUN_E2E=1     Enable E2E tests in verification"
        echo ""
        exit 0
    fi

    local max_iterations="${1:-50}"
    local start_time
    start_time=$(date +%s)

    print_header
    check_prerequisites

    local iteration=0

    while [ $iteration -lt "$max_iterations" ]; do
        iteration=$((iteration + 1))

        # Check if all tasks are complete
        if check_all_passed; then
            echo ""
            print_success "All tasks complete! Project finished in $iteration iterations."
            show_summary "$start_time" "$iteration"
            exit 0
        fi

        # Get next task
        local task_id
        task_id=$(get_next_task)

        if [ -z "$task_id" ]; then
            print_warning "No available tasks (may be blocked by dependencies)."
            break
        fi

        # Run iteration
        run_iteration "$iteration" "$task_id"

        # Small delay between iterations
        sleep 2
    done

    echo ""
    print_warning "Reached max iterations ($max_iterations). Some tasks may remain."
    show_summary "$start_time" "$iteration"
}

main "$@"
