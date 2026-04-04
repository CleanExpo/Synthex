# Team Planning Agent - Builder/Validator Pattern

## Overview

The Team Planning Agent implements a strict **Builder/Validator** execution pattern for the Synthex framework. This pattern ensures every implementation task is immediately followed by a verification step, creating a robust quality assurance loop.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  ORCHESTRA AGENT                        │
│              (Coordination & Dispatch)                  │
└──────────────────┬──────────────────────────────────────┘
                   │
         ┌─────────┴──────────┐
         │  PLAN GENERATOR    │
         │  (This Module)     │
         └─────────┬──────────┘
                   │
     ┌─────────────┼─────────────┐
     ▼             ▼             ▼
┌─────────┐  ┌─────────┐  ┌─────────────┐
│ BUILDER │──│VALIDATOR│  │   SPECS/    │
│  AGENT  │  │  AGENT  │  │  PLAN.MD    │
└─────────┘  └─────────┘  └─────────────┘
     │             │             │
     └─────────────┴─────────────┘
                   │
            ┌──────┴──────┐
            ▼             ▼
    ┌─────────────┐ ┌─────────────┐
    │ IMPLEMENT   │ │   VERIFY    │
    │   (Code)    │ │  (Checks)   │
    └─────────────┘ └─────────────┘
```

## Files

| File | Purpose |
|------|---------|
| `plan-generator.ts` | Core module that generates execution plans using AI |
| `builder-agent.md` | Builder Agent definition and responsibilities |
| `validator-agent.md` | Validator Agent definition and responsibilities |
| `README.md` | This documentation file |

## Usage

### Generate a Plan

```bash
# Using npm script
npm run plan:team -- "Implement user authentication system"

# Using tsx directly
npx tsx agents/planner/plan-generator.ts "Your task description"

# With options
npx tsx agents/planner/plan-generator.ts "Create dashboard" --verbose --no-archive
```

### Options

| Option | Description |
|--------|-------------|
| `--model <model>` | AI model to use (default: claude-3-5-sonnet-20241022) |
| `--no-archive` | Don't archive existing plan.md |
| `--verbose` | Show plan preview in console |

## Output: specs/plan.md

The generated plan follows this strict format:

```markdown
# Execution Plan: [Task Title]

## Metadata
- Generated: 2025-08-11T10:30:00.000Z
- Task: [Full description]
- Estimated Duration: 2-3 hours
- Complexity: MEDIUM

## Phase 1: Setup & Foundation
- [ ] **Task 1 (Builder)**: Create auth configuration file at `config/auth.ts`
- [ ] **Task 2 (Validator)**: Verify config exists and TypeScript compiles

## Phase 2: Core Implementation
- [ ] **Task 3 (Builder)**: Implement login API endpoint at `app/api/auth/login/route.ts`
- [ ] **Task 4 (Validator)**: Run API contract check and test endpoint

## Phase 3: Integration & Testing
- [ ] **Task 5 (Builder)**: Connect frontend login form to API
- [ ] **Task 6 (Validator)**: Verify UI wiring and run E2E tests

## Phase 4: Documentation & Final Validation
- [ ] **Task 7 (Builder)**: Update README with auth instructions
- [ ] **Task 8 (Validator)**: Verify documentation completeness

## Validation Checklist
- [ ] All files created/modified exist
- [ ] Syntax checks pass
- [ ] Type checking passes
- [ ] Tests run successfully
- [ ] No breaking changes introduced
```

## Builder/Validator Pattern

### Builder Agent Responsibilities
- Write code following existing patterns
- Update configurations
- Create files with proper structure
- **MUST** hand off to Validator immediately after completion

### Validator Agent Responsibilities
- Verify files exist at specified paths
- Run type checking: `npm run type-check`
- Run linting: `npm run lint`
- Execute contract checks via `npm run ci:verify`
- **MUST** block progression on validation failure

### Execution Rules

1. **Atomic Tasks**: Each task is independently verifiable
2. **Strict Sequence**: Builder → Validator, no exceptions
3. **Failure Handling**: Failed validation returns to Builder
4. **Concurrency**: Maximum 2 agents working simultaneously
5. **Documentation**: Update plan.md checkboxes as tasks complete

## Integration with Existing Tools

The planning agent leverages existing Synthex infrastructure:

- **CI Verification**: Uses `agents/tools/ci-verify.js`
- **Contract Checking**: API parity via `compare-contracts.js`
- **UI Wiring**: Component validation via `scan-ui-wiring.js`
- **Resource Management**: Respects `controlled-autonomous-build.ts` limits
- **Agent Orchestration**: Coordinates through Orchestra Agent

## Example Workflow

```bash
# 1. Generate plan for new feature
npm run plan:team -- "Implement real-time notifications"

# 2. Review generated plan
code specs/plan.md

# 3. Execute Task 1 (Builder): Create WebSocket handler
#    - Write code
#    - Save files
#    - Mark checkbox: [x]

# 4. Execute Task 2 (Validator): Verify implementation
#    - Run: npm run type-check
#    - Run: npm run ci:verify
#    - Mark checkbox: [x]

# 5. Continue with Task 3 (Builder)...
```

## Environment Variables

The planner requires:
- `ANTHROPIC_API_KEY` - For AI plan generation

## Architecture Context

This implementation follows the pattern defined in the original `plan_w_team()` function:

```typescript
// Original bash pattern converted to TypeScript
function plan_w_team() {
    // 1. ARCHITECTURE - Define Builder/Validator personas
    // 2. TEMPLATE - Force strict XML/Markdown output
    // 3. EXECUTION - Generate specs/plan.md
}
```

## Benefits

1. **Quality Assurance**: Every change is verified
2. **Traceability**: Complete audit trail in plan.md
3. **Atomicity**: Small, manageable task units
4. **Rollback Safety**: Validation catches issues early
5. **Parallelization**: Clear task boundaries enable concurrent work
6. **Documentation**: Self-documenting execution process

## Troubleshooting

### Plan generation fails
- Check `ANTHROPIC_API_KEY` is set
- Verify network connectivity
- Try with `--verbose` flag for details

### TypeScript errors
- Run `npm run type-check` separately
- Check for missing dependencies

### Validation failures
- Review `agents/tools/ci-verify.js` output
- Check `agents/reports/` for detailed error reports

## References

- Original Pattern: Phill McGurk's `plan_w_team()` function
- Framework: Synthex Agent Orchestra (CLAUDE.md)
- CI Tools: `agents/tools/ci-verify.js`
- Resource Management: `controlled-autonomous-build.ts`
