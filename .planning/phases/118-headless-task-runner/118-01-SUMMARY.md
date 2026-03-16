---
phase: 118-headless-task-runner
plan: 01
subsystem: infra
tags: [linear, bullmq, claude-agent-sdk, queue, webhook]

requires: []
provides:
  - LinearClient singleton (lib/linear/client.ts)
  - Linear webhook HMAC verifier (lib/linear/webhook-verifier.ts)
  - AUTONOMOUS_TASKS queue name + AutonomousTaskJobData type
  - @anthropic-ai/claude-agent-sdk and @linear/sdk installed
affects: [118-02, 118-03]

tech-stack:
  added: [@anthropic-ai/claude-agent-sdk, @linear/sdk]
  patterns: [lazy-singleton, fail-closed-verification]

key-files:
  created: [lib/linear/client.ts, lib/linear/webhook-verifier.ts]
  modified: [lib/queue/bull-queue.ts, .env.example, package.json]

key-decisions:
  - "Fail-closed webhook verifier: returns false when secret unset"
  - "Lazy LinearClient singleton: throws on missing API key at first use, not import time"

issues-created: []

duration: ~10min
completed: 2026-03-17
---

# Phase 118 Plan 01: Infrastructure Foundations Summary

**Installed Linear + Claude Agent SDKs and wired the foundational types, clients, and env vars for the headless task-runner.**

## Performance
- **Duration:** ~10 min
- **Started:** 2026-03-17
- **Completed:** 2026-03-17
- **Tasks:** 5/5
- **Files modified:** 5

## Accomplishments
- Installed `@anthropic-ai/claude-agent-sdk` (^0.2.76) and `@linear/sdk` (^77.0.0)
- Created `lib/linear/client.ts` — lazy singleton `LinearClient`, throws on missing API key at first use
- Created `lib/linear/webhook-verifier.ts` — HMAC-SHA256 timing-safe verification, fail-closed (returns false when secret unset)
- Added `AUTONOMOUS_TASKS: 'autonomous-tasks'` to `QUEUE_NAMES` in `bull-queue.ts`
- Added `AutonomousTaskJobData` interface and `'autonomous:execute-task'` to `JobType` and `QueueJobData` unions
- Documented `LINEAR_API_KEY` and `LINEAR_WEBHOOK_SECRET` in `.env.example` under the webhook secrets section

## Task Commits
1. **Task 1: Install packages** - `998f958d` (chore)
2. **Task 2: LinearClient singleton** - `144de9c2` (feat)
3. **Task 3: Webhook verifier** - `1a79dd3f` (feat)
4. **Task 4: bull-queue.ts update** - `50fbeb84` (feat)
5. **Task 5: .env.example update** - `e50fb298` (chore)

## Files Created/Modified
- `lib/linear/client.ts` — lazy singleton LinearClient
- `lib/linear/webhook-verifier.ts` — HMAC-SHA256 timing-safe verification
- `lib/queue/bull-queue.ts` — AUTONOMOUS_TASKS queue + AutonomousTaskJobData type
- `.env.example` — LINEAR_API_KEY and LINEAR_WEBHOOK_SECRET documented
- `package.json` / `package-lock.json` — new deps

## Decisions Made
- Fail-closed webhook verifier: `verifyLinearWebhook()` returns `false` when secret or signature is absent — never silently passes
- Lazy LinearClient singleton: `_client` initialised on first call to `getLinearClient()`, not at module import time — safe for environments without `LINEAR_API_KEY` set

## Deviations from Plan
None. All tasks executed exactly as specified.

## Issues Encountered
- `npm run type-check` reports pre-existing errors in `.next_alt/types/` (Next.js generated route types for onboarding routes and API templates). These errors existed before this plan and are not introduced by any changes made here. Confirmed by checking the type-check output on the commit prior to Task 1.

## Next Phase Readiness
- Infrastructure complete, ready for 118-02 (webhook route)

---
*Phase: 118-headless-task-runner*
*Completed: 2026-03-17*
