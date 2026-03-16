---
phase: 118-headless-task-runner
plan: "02"
subsystem: infra
tags: [linear, webhook, bullmq, hmac, zod, autonomous]

requires:
  - phase: 118-01
    provides: verifyLinearWebhook, AUTONOMOUS_TASKS queue, AutonomousTaskJobData type

provides:
  - POST /api/webhooks/linear route with HMAC verification
  - Issue-update → queue bridge (state.type=started + autonomous label filter)
  - Returns 200 in <100ms for all valid payloads

affects: [118-03]

tech-stack:
  added: []
  patterns: "HMAC-first webhook pattern — read body as text before JSON parse; filter on state.type not state.name"

key-files:
  created: [app/api/webhooks/linear/route.ts]
  modified: []

key-decisions:
  - "Filter on state.type='started' not state.name — names vary per Linear team"
  - "Require 'autonomous' label to prevent triggering on all In Progress issues"
  - "Return 200 for all valid payloads regardless of action taken — prevents Linear retries"
  - "Empty LINEAR_WEBHOOK_SECRET → verifyLinearWebhook returns false → 401 (fail-closed)"

patterns-established:
  - "Linear webhook: raw text body → HMAC → JSON parse → Zod → filter → queue"

issues-created: []

duration: 8min
completed: 2026-03-17
---

# Phase 118 Plan 02: Linear Webhook Receiver Summary

**HMAC-verified Linear webhook route that enqueues autonomous tasks when issues with the `autonomous` label move to In Progress state**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-17T19:25:00Z
- **Completed:** 2026-03-17T19:33:25Z
- **Tasks:** 2 auto + 1 checkpoint (human action pending)
- **Files modified:** 1

## Accomplishments

- Created `app/api/webhooks/linear/route.ts` — the Linear webhook HTTP entry point
- HMAC verification using existing `verifyLinearWebhook` from 118-01 (fail-closed: empty secret → 401)
- Zod schemas for `LinearWebhookSchema` and `LinearIssueDataSchema` with strict field validation
- Label filter (`autonomous`) prevents accidental triggering on all human-assigned issues
- State type filter (`state.type === 'started'`) is team-agnostic (works regardless of state name)
- Enqueues `AutonomousTaskJobData` to `AUTONOMOUS_TASKS` BullMQ queue

## Task Commits

1. **Task 1+2: Linear webhook route + security verification** - `e5a2cb5e` (feat)

## Files Created/Modified

- `app/api/webhooks/linear/route.ts` — POST handler with HMAC, Zod validation, label filter, queue enqueue

## Decisions Made

- Filter on `state.type` not `state.name` — Linear state names vary per team, `type` is standardised
- Require `autonomous` label to prevent automation of all "In Progress" issues
- Return 200 for any valid (parseable) payload — Linear doesn't care about action taken, only that we received it
- `process.env.LINEAR_WEBHOOK_SECRET ?? ''` → empty string → `verifyLinearWebhook` returns false → 401 (fail-closed with no config)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Webhook route is deployed (committed to main)
- **BLOCKED on human action:** LINEAR_WEBHOOK_SECRET must be registered in Linear dashboard before the route can receive real events
- 118-03 (BullMQ worker) can be planned and built independently — it processes jobs from the queue regardless of how they got there

---
*Phase: 118-headless-task-runner*
*Completed: 2026-03-17*
