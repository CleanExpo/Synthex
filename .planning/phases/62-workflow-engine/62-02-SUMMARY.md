---
phase: 62-workflow-engine
plan: 02
subsystem: workflow
tags: [bullmq, api-routes, step-types, zod, prisma, openrouter]

requires:
  - phase: 62-workflow-engine-01
    provides: WorkflowExecution+StepExecution schema, lib/workflow/ core library

provides:
  - 6 workflow API routes (executions CRUD, approve, cancel, templates CRUD)
  - 7 step type handlers (ai-generate, ai-analyse, ai-enrich, human-approval, action-publish, action-schedule, action-notify)
  - BullMQ workflow-step worker + enqueueWorkflowStep helper
  - Contract tests for execution + template routes

affects: [62-03-dashboard-ui, phase-63, phase-64]

tech-stack:
  added: []
  patterns:
    - getOrgId helper pattern for org-scoped queries (query user then use organizationId)
    - step-type dispatch by type + config.subType/actionType
    - BullMQ job re-enqueue pattern with retryCount cap
    - Plain mock request objects in contract tests (avoid NextRequest/global.Request polyfill clash)

key-files:
  created:
    - lib/workflow/step-types/ai-generate.ts
    - lib/workflow/step-types/ai-analyse.ts
    - lib/workflow/step-types/ai-enrich.ts
    - lib/workflow/step-types/human-approval.ts
    - lib/workflow/step-types/action-publish.ts
    - lib/workflow/step-types/action-schedule.ts
    - lib/workflow/step-types/action-notify.ts
    - lib/queue/workers/workflow-step.worker.ts
    - app/api/workflows/executions/route.ts
    - app/api/workflows/executions/[id]/route.ts
    - app/api/workflows/executions/[id]/approve/route.ts
    - app/api/workflows/executions/[id]/cancel/route.ts
    - app/api/workflows/templates/route.ts
    - tests/contract/workflows-executions.contract.test.ts
    - tests/contract/workflows-templates.contract.test.ts
  modified:
    - prisma/schema.prisma
    - lib/workflow/step-executor.ts
    - lib/queue/bull-queue.ts
    - lib/queue/workers/index.ts

key-decisions:
  - "Used existing WorkflowTemplate model (added autoApproveThreshold/isActive/createdBy fields) rather than creating new model"
  - "AI step dispatch uses config.subType to route ai-generate/ai-analyse/ai-enrich"
  - "action-publish records intent only — actual platform publish uses existing scheduler"
  - "getOrgId() helper queries user.organizationId for org-scoping (consistent with team/route.ts pattern)"
  - "Tests placed in tests/contract/ not __tests__/api/ — jest config only picks up tests/ and src/ patterns"
  - "triggeredBy field (required, no default in schema) populated from security.context.userId in POST /executions"
  - "app/api/workflows/templates/ required git add -f due to global .gitignore rule for templates/"

issues-created: []

duration: ~45 minutes
completed: 2026-03-03
---

# Phase 62 Plan 02: API Routes + Step Types + BullMQ Integration Summary

**6 workflow API routes + 7 step type handlers + BullMQ worker wired for async execution**

## Performance

- **Duration:** ~45 minutes
- **Started:** 2026-03-03
- **Completed:** 2026-03-03
- **Tasks:** 9
- **Files modified:** 16

## Accomplishments
- Built 6 org-scoped, Zod-validated API routes for workflow execution lifecycle (create, list, detail, approve, cancel) and template management
- Implemented all 7 step type handlers: 3 AI types calling OpenRouter, human-approval pause, and 3 action types (publish/schedule/notify)
- Wired BullMQ workflow-step worker with 2-retry cap and re-enqueue logic
- Updated step-executor.ts to route to real implementations (replaces 62-01 stubs)
- Added `autoApproveThreshold`, `isActive`, `createdBy` to WorkflowTemplate schema and pushed to DB
- Contract tests covering auth guards, org-scoping, and request validation (10/10 passing)

## Task Commits

1. `77d4c753` — feat(62-02): add autoApproveThreshold + isActive + createdBy to WorkflowTemplate
2. `00fc24be` — feat(62-02): implement 7 step type handlers
3. `8bdce45f` — feat(62-02): wire step-executor to real step-type implementations
4. `6884b142` — feat(62-02): add WorkflowStepJob type + enqueueWorkflowStep helper to bull-queue
5. `343eab02` — feat(62-02): create workflow-step.worker.ts for async step execution
6. `878a13a0` — feat(62-02): add 6 workflow API routes (executions CRUD + templates CRUD)
7. `1395403c` — test(62-02): add contract tests for workflow execution + template API routes
8. `2769b98b` — fix(62-02): resolve TypeScript type errors from type-check
9. `e5c3f186` — fix(62-02): fix failing workflow tests

## Files Created/Modified

**Created (15 files):**
- `lib/workflow/step-types/ai-generate.ts` — Calls OpenRouter claude-3-haiku with prompt template interpolation
- `lib/workflow/step-types/ai-analyse.ts` — Calls OpenRouter, returns JSON analysis with score 0-10
- `lib/workflow/step-types/ai-enrich.ts` — Calls OpenRouter, enriches content with hashtags + CTA
- `lib/workflow/step-types/human-approval.ts` — Always returns requiresApproval=true (pauses workflow)
- `lib/workflow/step-types/action-publish.ts` — Records publish intent, returns queued_for_publish status
- `lib/workflow/step-types/action-schedule.ts` — Creates Post record in DB with scheduledAt timestamp
- `lib/workflow/step-types/action-notify.ts` — Logs notification intent (delivery via notification system)
- `lib/queue/workers/workflow-step.worker.ts` — BullMQ worker with 2-retry re-enqueue pattern
- `app/api/workflows/executions/route.ts` — GET list (cursor pagination) + POST create+enqueue
- `app/api/workflows/executions/[id]/route.ts` — GET single with stepExecutions
- `app/api/workflows/executions/[id]/approve/route.ts` — POST approve waiting_approval step
- `app/api/workflows/executions/[id]/cancel/route.ts` — POST cancel non-terminal execution
- `app/api/workflows/templates/route.ts` — GET list (isActive filter) + POST create
- `tests/contract/workflows-executions.contract.test.ts` — 6 tests: auth guards + org-scoping + CRUD
- `tests/contract/workflows-templates.contract.test.ts` — 4 tests: auth guards + validation

**Modified (4 files):**
- `prisma/schema.prisma` — Added autoApproveThreshold, isActive, createdBy, isActive index to WorkflowTemplate
- `lib/workflow/step-executor.ts` — Replaced stubs with imports + dispatch to real step-type handlers
- `lib/queue/bull-queue.ts` — Added WORKFLOW_STEPS queue name, WorkflowStepJobData, enqueueWorkflowStep
- `lib/queue/workers/index.ts` — Registered workflow-step worker in startAllWorkers()

## Decisions Made
- Tests placed in `tests/contract/` not `__tests__/api/` — jest.config.cjs testMatch only covers tests/ and src/ patterns; __tests__/ at root is not configured
- `triggeredBy` field on WorkflowExecution is required (non-optional) — populated from security.context.userId
- `app/api/workflows/templates/` required `git add -f` due to `templates/` entry in .gitignore (intended for top-level external packages, not nested API routes)
- Contract tests use plain mock request objects following approvals-roles.contract.test.ts pattern to avoid global.Request polyfill conflict with Next.js NextRequest

## Deviations from Plan
- Test file paths: plan specified `__tests__/api/workflows/executions.test.ts` and `__tests__/api/workflows/templates.test.ts` but placed in `tests/contract/workflows-executions.contract.test.ts` and `tests/contract/workflows-templates.contract.test.ts` — jest.config.cjs doesn't scan root-level `__tests__/` directories
- Task 8 commit created (not "only if there are errors") — triggeredBy field was required

## Issues Encountered
- `global.Request` polyfill in jest.setup.js conflicts with Next.js NextRequest when directly instantiating `new NextRequest()` — resolved by using plain mock request objects (consistent with existing contract test pattern)
- `app/api/workflows/templates/route.ts` caught by `.gitignore` `templates/` rule — resolved with `git add -f`
- `WorkflowExecution.triggeredBy` is a required field with no default — type-check caught this; fixed by providing security.context.userId

## Next Phase Readiness
- API layer complete — workflow executions can be started, advanced, approved, cancelled via HTTP
- Step execution is async via BullMQ
- Ready for 62-03: Dashboard UI — workflow management interface
