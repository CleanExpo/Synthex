# Summary 118-03: Autonomous Task Worker

**Phase:** 118 — Headless Task-Runner
**Plan:** 03 of 03
**Linear:** UNI-1181
**Date:** 2026-03-17
**Status:** Complete

## What Was Built

A BullMQ worker (`lib/queue/workers/autonomous-task-worker.ts`) that picks up
`autonomous:execute-task` jobs from the `autonomous-tasks` queue and drives the
`@anthropic-ai/claude-agent-sdk` `query()` function to execute Linear issues
autonomously. The worker is registered in `lib/queue/workers/index.ts` via
`startAllWorkers()` so it boots alongside all other workers.

## Files Created / Modified

| File | Action |
|------|--------|
| `lib/queue/workers/autonomous-task-worker.ts` | Created (284 LOC) |
| `lib/queue/workers/index.ts` | Modified — import + registration + export |
| `.env.example` | Modified — added Phase 118 note to ANTHROPIC_API_KEY comment |

## Tasks Completed

- [x] Task 1: `lib/queue/workers/autonomous-task-worker.ts` created
- [x] Task 2: Worker registered in `lib/queue/workers/index.ts` → `startAllWorkers()`
- [x] Task 3: `instrumentation.ts` inspected (see Gap below)
- [x] Task 4: `ANTHROPIC_API_KEY` already existed in `.env.example` — comment updated to reference Phase 118

## Worker Design Implemented

| Property | Value |
|----------|-------|
| Queue | `autonomous-tasks` |
| Concurrency | 1 (one task at a time) |
| Max turns | 50 |
| Allowed tools | Read, Edit, Bash, Glob, Grep |
| System prompt addendum | Never commit directly to main |
| Progress comments | Every 10 assistant turns |
| On success | Post ✅ comment + mark Linear issue Done |
| On `error_max_turns` | Post ⚠️ comment, do NOT retry |
| On missing CLI | Post ❌ comment, do NOT retry |
| On missing `ANTHROPIC_API_KEY` | Post ❌ comment, do NOT retry |
| On other errors | Post ❌ comment, re-throw (BullMQ retries up to 3×) |

## Type-Check Deviation and Fix

The plan provided code using `logger.warn(message, err)` where `err` is `unknown`.
The project's `logger.warn` signature is `warn(message: string, context?: LogContext)`
where `LogContext = Record<string, unknown>` — it does not accept raw `unknown`.

All `logger.warn` calls were fixed to wrap caught errors: `logger.warn(msg, { error: err })`.
This required one additional fixup commit after the main task commits.

The remaining type errors reported by `npm run type-check` are all pre-existing errors
in `.next_alt/types/` (generated Next.js internal type files) — none are in code written
during this plan.

## Gap: `instrumentation.ts` Does Not Call `startAllWorkers()`

`instrumentation.ts` (root) only runs env validation on startup — it does NOT call
`startAllWorkers()`. This is intentional: the existing note in the file explains that
importing Node.js-heavy modules from `instrumentation.ts` caused build failures and
cold-start hangs in Phase 114-02.

**Impact:** The autonomous worker (and all other workers) do NOT auto-start in Vercel
serverless deployments. Workers are currently started only if a custom server entry
point calls `startAllWorkers()`.

**Recommended next action (not in scope of this plan):**
- For Vercel: Trigger workers via a long-lived cron route using `waitUntil()` on Vercel Edge
- For persistent environments (Railway, Fly.io): Call `startAllWorkers()` from the process entry point
- This is tracked as part of the "persistent worker environment" design noted in the plan

## Commit Hashes

| Commit | Description |
|--------|-------------|
| `b12574f1` | feat(118-03): create autonomous-task-worker |
| `3afd425a` | feat(118-03): register autonomous worker in startAllWorkers |
| `20333e11` | chore(118-03): wire instrumentation and document ANTHROPIC_API_KEY |
| `09cf4898` | fix(118-03): fix logger.warn type errors in autonomous-task-worker |

## Verification

- `npm run type-check` — passes for all new/modified files (pre-existing .next_alt errors unchanged)
- `npx eslint lib/queue/workers/autonomous-task-worker.ts lib/queue/workers/index.ts` — passes (0 errors)

## Phase 118 Status

All three plans complete:
- 118-01: LinearClient singleton, HMAC verifier, AUTONOMOUS_TASKS queue — Done
- 118-02: POST /api/webhooks/linear, Zod validation, queue enqueue — Done
- 118-03: Autonomous task BullMQ worker — Done

## Human Actions Required Before End-to-End Testing

1. **Linear API Key:** Linear → Settings → API → Personal API Keys → set `LINEAR_API_KEY` in Vercel
2. **Webhook Registration:** Linear → Settings → API → Webhooks → create at `https://synthex.social/api/webhooks/linear` → set `LINEAR_WEBHOOK_SECRET` in Vercel
3. **Autonomous label:** Create label `autonomous` in Linear (triggers automation)
4. **Worker boot strategy:** Decide on persistent worker environment (see Gap above)
5. **Claude CLI in worker env:** Ensure `claude` CLI is installed in PATH for the worker process
