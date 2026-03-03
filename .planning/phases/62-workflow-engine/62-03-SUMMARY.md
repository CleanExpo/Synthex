---
phase: 62-workflow-engine
plan: 03
subsystem: ui
tags: [react, nextjs, workflow, dashboard, swr, glassmorphic]

requires:
  - phase: 62-01
    provides: Prisma schema (WorkflowExecution, StepExecution, WorkflowTemplate models)
  - phase: 62-02
    provides: API routes (executions CRUD, templates CRUD, approve/cancel)
provides:
  - Dashboard page at /dashboard/workflows
  - ExecutionList, ExecutionDetail, StepTimeline, ConfidenceBadge, ApprovalActions components
  - NewWorkflowDialog for starting workflows
  - Sidebar + command palette navigation entries
affects: [63-agent-reliability, 64-monitoring]

tech-stack:
  added: []
  patterns: [SWR polling with pause on terminal status, glassmorphic card layout, two-phase reject UI]

key-files:
  created:
    - app/dashboard/workflows/page.tsx
    - app/dashboard/workflows/loading.tsx
    - app/dashboard/workflows/error.tsx
    - components/workflows/WorkflowsPageClient.tsx
    - components/workflows/ExecutionList.tsx
    - components/workflows/ExecutionDetail.tsx
    - components/workflows/StepTimeline.tsx
    - components/workflows/ApprovalActions.tsx
    - components/workflows/ConfidenceBadge.tsx
    - components/workflows/NewWorkflowDialog.tsx
    - lib/workflow/hooks/use-workflow-executions.ts
  modified:
    - app/dashboard/layout.tsx
    - components/command-palette/commands.ts

key-decisions:
  - "Used SWR for polling with dynamic refresh interval based on execution status (not fixed interval)"
  - "Sidebar: added new AI AGENTS group with Workflows entry using existing GitPullRequest icon alias"
  - "WorkflowExecution/StepExecution types defined locally in hooks file (not imported from @prisma/client) to avoid breaking server/client boundary"
  - "Two-phase reject UI: click Reject -> textarea reason -> confirm. Avoids accidental rejections"
  - "?action=new and ?filter=waiting_approval query params handled client-side for command palette integration"

duration: ~20min
completed: 2026-03-03
---

# Phase 62 Plan 03: Dashboard Page + Approval UI + Execution Progress Summary

**Workflow dashboard at /dashboard/workflows with SWR polling, step timeline, confidence badges, and human approval actions**

## Performance

- **Duration:** ~20 minutes
- **Started:** 2026-03-03
- **Completed:** 2026-03-03
- **Tasks:** 10/10
- **Files created:** 11
- **Files modified:** 2

## Accomplishments

- Built complete `/dashboard/workflows` page with server component wrapper + client hydration
- SWR polling hooks with smart refresh interval (5s when running, paused when terminal)
- Vertical step timeline with step type icons, status colours, confidence badges, error display
- Human approval flow: Approve (single click) + Reject (two-phase with reason textarea)
- ExecutionDetail side panel with metadata, pending approvals, cancel confirmation
- ExecutionList with progress bars, relative timestamps, status badges
- Two-step NewWorkflowDialog: template selection → title + JSON input data
- Loading skeleton (3 pulsing cards), error boundary, empty state with CTA
- New "AI AGENTS" sidebar group with Workflows entry
- 3 command palette entries (Open, New, Pending Approvals)
- TypeScript type-check passes (0 errors)

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | da7dc013 | SWR workflow execution hooks with smart polling |
| 2 | bb3fd498 | ConfidenceBadge and StepTimeline components |
| 3 | 03d437b1 | ApprovalActions component |
| 4 | ac9a2035 | ExecutionDetail panel |
| 5 | 1a0ec04b | ExecutionList component |
| 6 | 7f24eb25 | NewWorkflowDialog |
| 7 | 6b6fe65a | Page files (page, loading, error, WorkflowsPageClient) |
| 8 | 80ec3eb2 | Sidebar navigation entry |
| 9 | f4f2ebc4 | Command palette entries |
| 10 | (type-check) | 0 errors — no fix commit needed |

## Files Created/Modified

**Created:**
- `lib/workflow/hooks/use-workflow-executions.ts` — SWR hooks + type exports
- `components/workflows/ConfidenceBadge.tsx` — Score chip (green/amber/red)
- `components/workflows/StepTimeline.tsx` — Vertical timeline with icons
- `components/workflows/ApprovalActions.tsx` — Approve/reject with two-phase reject
- `components/workflows/ExecutionDetail.tsx` — Detail panel with cancel
- `components/workflows/ExecutionList.tsx` — Card list with progress bars
- `components/workflows/NewWorkflowDialog.tsx` — Two-step creation dialog
- `components/workflows/WorkflowsPageClient.tsx` — Client orchestrator component
- `app/dashboard/workflows/page.tsx` — Server component wrapper
- `app/dashboard/workflows/loading.tsx` — Pulsing skeleton
- `app/dashboard/workflows/error.tsx` — DashboardError boundary

**Modified:**
- `app/dashboard/layout.tsx` — Added `ai-agents` sidebar group
- `components/command-palette/commands.ts` — 3 workflow entries added

## Decisions Made

1. **Types in hooks file**: `WorkflowExecution` and `StepExecution` typed locally (not `@prisma/client`) to keep them as plain serialisable interfaces safe for client components and API responses.

2. **AI AGENTS sidebar group**: Created a new group rather than adding to `content-ai` or `team-admin`, separating autonomous agent features from content creation and administration.

3. **SWR refresh interval function**: Used the `refreshInterval(latestData)` callback form to dynamically pause polling when all executions are terminal — more efficient than a fixed interval.

4. **Two-phase reject**: Clicking Reject reveals a textarea for the reason before the API call. Prevents accidental rejection without confirmation.

5. **?action=new param**: Command palette `New Workflow` navigates to `?action=new` which the client component detects via `useSearchParams` to auto-open the dialog.

## Deviations from Plan

- **`components/icons` `GitBranch`**: The plan noted that `GitBranch` maps to `CodeBracketSquareIcon` (line 221 of icons/index.ts). Since `app/dashboard/layout.tsx` already uses `GitBranch as GitPullRequest`, the sidebar entry uses `GitPullRequest` consistently — no new import needed.
- **Sidebar placement**: Added as a new `ai-agents` group rather than inserting into `team-admin`, to better separate AI automation from administrative functions. Better for progressive disclosure.

## Issues Encountered

None. TypeScript type-check passed clean on first run.

## Next Phase Readiness

Phase 62 complete. All 3 plans done.

Ready for **Phase 63: Parallel Agent Execution** — N workflow executions simultaneously via BullMQ concurrency control, partial success model.

---
*Phase: 62-workflow-engine*
*Completed: 2026-03-03*
