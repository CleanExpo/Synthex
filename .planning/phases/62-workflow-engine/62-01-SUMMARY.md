---
phase: 62-workflow-engine
plan: 01
subsystem: ai
tags: workflow, prisma, typescript, orchestrator, minions

requires:
  - phase: 61-ai-session-memory
    provides: AIConversation/AIMessage models — established pattern for AI persistence
provides:
  - WorkflowExecution Prisma model (org-scoped, status tracking, step index)
  - StepExecution Prisma model (confidence score, retry count, approval fields)
  - lib/workflow/types.ts — all TypeScript types for the workflow engine
  - lib/workflow/context-builder.ts — token-budgeted context assembly
  - lib/workflow/step-executor.ts — step type router with timeout
  - lib/workflow/orchestrator.ts — deterministic flow controller
  - lib/workflow/index.ts — public API barrel export
affects: [62-02-api-routes, 62-03-dashboard, 63-parallel-agents, 64-quality-gates]

tech-stack:
  added: []
  patterns:
    - "Minions orchestrator: deterministic TypeScript controls flow, LLM inside bounded step types"
    - "Token budget: MAX_PRIOR_STEPS=3, MAX_OUTPUT_CHARS=2000 per context assembly"
    - "2-retry cap: retryCount >= MAX_RETRIES → surface to human, never loop"
    - "Confidence gating: score >= 0.85 auto-approve, below → await_human"

key-files:
  created:
    - prisma/schema.prisma (WorkflowExecution + StepExecution models)
    - lib/workflow/types.ts
    - lib/workflow/context-builder.ts
    - lib/workflow/step-executor.ts
    - lib/workflow/orchestrator.ts
    - lib/workflow/index.ts
    - tests/unit/lib/workflow/orchestrator.test.ts
  modified:
    - prisma/schema.prisma (Organization.workflowExecutions relation)

key-decisions:
  - "WorkflowTemplate already exists (Phase 27) — reused for step definitions"
  - "Step defs stored in WorkflowTemplate.steps JSON or inputData.steps (ad-hoc)"
  - "evaluateGate() is private — tested via constants and type assertions"
  - "AI + action step stubs return terminal errors — Phase 62-02 implements them"
  - "prisma import uses named export { prisma } per lib/prisma.ts comment"

issues-created: []

duration: ~25min
completed: 2026-03-03
---

# Phase 62 Plan 01: Prisma Schema + Core Workflow Library Summary

**WorkflowExecution + StepExecution Prisma models + Minions-inspired orchestrator (types, context-builder, step-executor, orchestrator) — foundation for Phase 62 workflow engine**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-03
- **Completed:** 2026-03-03
- **Tasks:** 8
- **Files modified:** 7 new + 1 modified

## Accomplishments

- Added `WorkflowExecution` and `StepExecution` to Prisma schema (backward-compatible, 2 new tables pushed to DB successfully)
- Created full `lib/workflow/` library: types → context-builder → step-executor → orchestrator → index
- Orchestrator implements Minions principles: 2-retry cap, confidence gating (>=0.85 auto-approve), mandatory human gates
- Context builder applies token budget (last 3 steps, 2000 chars max) — prevents context drift
- Step executor has timeout (30s), exhaustive type routing, stubs for AI/action steps (62-02)
- Unit tests: 11 tests, all passing — gate thresholds, retry cap, token budget logic
- Type-check passes with 0 errors (fixed one TS error: JsonValue cast via unknown)

## Task Commits

1. **Task 1: Prisma models** - `1c52a459` (feat)
2. **Task 2: types.ts** - `59206b33` (feat)
3. **Task 3: context-builder.ts** - `6c1b7586` (feat)
4. **Task 4: step-executor.ts** - `2398be7e` (feat)
5. **Task 5: orchestrator.ts** - `cff14038` (feat)
6. **Task 6: index.ts** - `86b1725c` (feat)
7. **Task 7: type-check fix** - `613f00de` (fix — cast template.steps through unknown)
8. **Task 8: tests** - `dbceae13` (test)

## Files Created/Modified

- `prisma/schema.prisma` — WorkflowExecution + StepExecution models, Organization relation, pushed to DB
- `lib/workflow/types.ts` — StepType, WorkflowStepDefinition, StepContext, StepResult, GateOutcome
- `lib/workflow/context-builder.ts` — buildStepContext() with token budget
- `lib/workflow/step-executor.ts` — executeStep() router with 30s timeout
- `lib/workflow/orchestrator.ts` — advanceWorkflow(), approveCurrentStep(), cancelExecution()
- `lib/workflow/index.ts` — barrel export
- `tests/unit/lib/workflow/orchestrator.test.ts` — 11 gate logic unit tests

## Decisions Made

- `WorkflowTemplate` already existed from Phase 27 (content approval workflows) — reused for step definitions in `workflowId` reference. Not duplicated.
- Step definitions resolved from `WorkflowTemplate.steps` (linked template) or `inputData.steps` (ad-hoc workflow).
- `evaluateGate()` private function — tested via exported constants and type-level assertions.
- AI + action step handlers are stubs in this plan — Phase 62-02 adds real implementations.
- Used named import `{ prisma }` from `@/lib/prisma` per the comment in lib/prisma.ts (the correct pattern).
- Test files placed in `tests/unit/lib/workflow/` matching existing project convention (not `__tests__/`).

## Deviations from Plan

- Test file path adjusted from `__tests__/lib/workflow/orchestrator.test.ts` to `tests/unit/lib/workflow/orchestrator.test.ts` to match project jest.config.cjs testMatch pattern.
- `orchestrator.ts` import uses `StepResultSuccess` directly instead of inline `Extract<>` helper — cleaner and already exported from types.ts.
- Fix commit added (613f00de) for the JsonValue cast issue in `resolveStepDefinition` — template.steps cast through `unknown` first before `WorkflowStepDefinition[]`.

## Issues Encountered

- TS error in orchestrator: `template.steps as WorkflowStepDefinition[]` fails because Prisma types steps as `JsonValue`. Fixed with `as unknown as WorkflowStepDefinition[]` (standard pattern for typed Prisma JSON fields).

## Next Phase Readiness

- Prisma schema foundation complete — `npx prisma generate` produced typed client with WorkflowExecution + StepExecution
- DB push succeeded: tables created in Supabase PostgreSQL
- `lib/workflow/` library compiled with 0 TypeScript errors
- Phase 62-02 can import from `lib/workflow` and build API routes + step type implementations on top
- BullMQ worker (62-02) calls `advanceWorkflow(executionId)` to drive execution

---
*Phase: 62-workflow-engine*
*Completed: 2026-03-03*
