# Ralph Command

Run the Ralph Wiggum technique for autonomous task completion.

## Usage

```
/ralph [init|run] [max_iterations]
```

## Arguments

- `init` - Initialize the `plans/` directory with PRD template and progress file
- `run` - Run the autonomous loop (default if no argument)
- `max_iterations` - Maximum loop iterations (default: 50)

## What This Does

The Ralph Wiggum technique (Matt Pocock / Jeffrey Huntley) runs Claude Code in a loop:

1. **Read PRD**: Load `plans/prd.json` for user stories with `passes: false`
2. **Find Task**: Select highest priority unpassed task (respecting dependencies)
3. **Load Context**: Read `plans/progress.txt` for learnings from previous iterations
4. **Work**: Implement the task according to acceptance criteria
5. **Verify**: Run full pipeline (type-check, lint, test, build, e2e)
6. **Update State**:
   - If PASS: Set `passes: true` in PRD, commit changes
   - If FAIL: Increment `attempt_count`, record learnings
7. **Loop**: Continue until all tasks pass or max iterations reached

## Initialization

Before running, initialize the plans directory:

```
/ralph init
```

This creates:
- `plans/prd.json` - Task list template
- `plans/progress.txt` - LLM memory file
- `plans/ralph-prompt.md` - Iteration prompt template

## PRD Format

Edit `plans/prd.json` with your user stories:

```json
{
  "user_stories": [
    {
      "id": "US-001",
      "title": "User can sign up with email",
      "priority": "critical",
      "acceptance_criteria": [
        "Form validates email format",
        "Password meets strength requirements"
      ],
      "passes": false,
      "attempt_count": 0,
      "depends_on": []
    }
  ]
}
```

### Priority Levels

Order of execution: `critical` > `high` > `medium` > `low`

### Dependencies

Tasks wait for dependencies to pass:

```json
{
  "id": "US-002",
  "depends_on": ["US-001"]
}
```

## Verification Pipeline

ALL must pass before marking `passes: true`:

```bash
pnpm turbo run type-check  # TypeScript compilation
pnpm turbo run lint        # ESLint + Ruff
pnpm turbo run test        # Unit tests
pnpm turbo run build       # Production build
pnpm --filter=web test:e2e # Playwright E2E tests
```

## Progress File

The LLM appends learnings after each iteration:

```markdown
---

## Session 5: 2026-01-07T10:30:00Z
**Task**: US-001 - User can sign up
**Status**: IN_PROGRESS

### Work Done
- Created SignUpForm component
- Added zod validation

### Issues Encountered
- useAuth hook missing return type

### Learnings
- Always add explicit return types to hooks

### Next Steps
1. Fix useAuth return type
2. Add unit tests
```

## CLI Alternative

Run from terminal:

```bash
# Unix/Mac/WSL
./scripts/ralph.sh --init
./scripts/ralph.sh 50

# Windows PowerShell
.\scripts\ralph.ps1 -Init
.\scripts\ralph.ps1 -MaxIterations 50
```

## Execution Steps

When you run `/ralph run`:

### Step 1: Check Prerequisites
- Claude CLI installed
- PRD file exists
- Progress file exists (creates if missing)

### Step 2: Find Next Task
Select task where:
- `passes === false`
- All `depends_on` tasks have `passes === true`
- Highest priority wins

### Step 3: Load Context
Read both files:
- `plans/prd.json` - Full task details
- `plans/progress.txt` - Previous learnings

### Step 4: Work on Task
For the selected task:
1. Read acceptance criteria
2. Check progress for relevant learnings
3. Implement feature/fix
4. Write/update tests

### Step 5: Verify
Run full verification pipeline. ALL must pass.

### Step 6: Update State
If passed:
- Update PRD: `passes: true`
- Git commit with conventional format
- Append success to progress.txt

If failed:
- Update PRD: increment `attempt_count`
- Append learnings to progress.txt
- Continue to next iteration

### Step 7: Loop or Exit
Continue until:
- All tasks pass
- Max iterations reached
- Manual stop

## Best Practices

1. **Small tasks** - Keep user stories focused (1-2 hour scope)
2. **Specific criteria** - Vague acceptance = incomplete implementations
3. **Use dependencies** - Order tasks logically
4. **Read progress** - Learn from past iterations
5. **Commit often** - Each success = checkpoint

## Example Session

```
>>> Checking prerequisites...
Claude CLI found
PRD file found
All prerequisites OK

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Iteration 1: US-001
  User can sign up with email
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

>>> Invoking Claude Code...
[Claude implements sign-up form]

>>> Running verification pipeline...
  Type check: PASS
  Lint: PASS
  Tests: PASS
  Build: PASS
  E2E: PASS

Verification passed! Marking US-001 as complete.
[Auto-commit: feat(US-001): User can sign up with email]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Iteration 2: US-002
  ...
```

## Stopping the Loop

The loop stops when:
- All tasks have `passes: true`
- Max iterations reached
- Ctrl+C / manual interruption
- Task blocked by failed dependencies

## Troubleshooting

### "PRD file not found"
Run `/ralph init` first to create the plans directory.

### "No available tasks"
All remaining tasks have unmet dependencies. Check `depends_on` arrays.

### Verification keeps failing
- Check `attempt_count` in PRD
- Read progress.txt for recorded issues
- Consider breaking task into smaller pieces

### Stuck in loop
- Review progress.txt for patterns
- Check if task is too large
- Consider manual intervention
