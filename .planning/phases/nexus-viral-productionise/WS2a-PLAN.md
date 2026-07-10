---
phase: nexus-viral-productionise
workstream: WS2a
plan: WS2a
type: execute
baseline: origin/main @ f3fd9cf3
model: sonnet
title: Submit-path liveness surfacing + quota TOCTOU tighten
---

<objective>
Turn silent, paid fal model-drift failures into an actionable `model_retired?`
signal at the webhook path, and close the `holdQuota` TOCTOU race with a
conditional update — so a retired model is diagnosable and two concurrent holds
cannot overrun a cap. Spec §9 WS2(a) + §11.
</objective>

<context>
@lib/services/ai/video/fal-adapter.ts        # parseFalWebhook → FalWebhookResult{ok,videoUrl,errorMessage,isPolicyRejection}; POLICY_PATTERNS regex; getFalStatus throws on !ok
@app/api/video/webhook/fal/route.ts           # ERROR branch (~line 122): sets status 'failed', errorMessage = result.errorMessage; releaseQuota. This is where model_retired classification lands.
@lib/services/ai/video/quota.ts               # holdQuota (~line 28): optimistic read-then-write in $transaction upsert+update. Documented TOCTOU. Fields on organizationVideoQuota: spentUsd, spentTodayUsd, spentTodayMcpUsd, monthlyBudgetUsd, dailyBudgetUsd, dayStart, periodStart.
@lib/services/ai/video/types.ts               # InitiatedBy, QuotaExceededError
@lib/observability/sentry-server.ts           # captureServerException / captureServerMessage / isSentryServerEnabled — the ONLY sanctioned server alert sink (direct @sentry/nextjs is banned per lib/logger.ts + SYN-703 revert)
@lib/observability/error-tracker.ts           # trackError(err, {severity, category}) ships CRITICAL/HIGH to captureServerException
@__tests__/video-engine/generation-service.test.ts   # existing mocked-prisma test pattern for this area

Established: jest.worktree.cjs mocked prisma/providers, no external calls.
Constraint: NO prod migration — quota columns already exist; change is logic-only.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Classify 404-class provider failures as model_retired in parseFalWebhook</name>
  <files>lib/services/ai/video/fal-adapter.ts</files>
  <action>
Add a `RETIRED_PATTERNS` regex (e.g. /404|not found|no such model|model.*(retired|unavailable|deprecated)|unknown model/i) alongside POLICY_PATTERNS. Extend FalWebhookResult with `isModelRetired: boolean`. In parseFalWebhook set `isModelRetired: RETIRED_PATTERNS.test(errorMessage)` on the ERROR branch (mirrors isPolicyRejection). Also export a small `classifyFalFailure(errorMessage): 'policy'|'model_retired'|'unknown'` helper reused by the route. Do NOT change getFalStatus/submitToFal network behaviour.
  </action>
  <verify>npx jest --config jest.worktree.cjs fal-adapter — new cases: 404 body → isModelRetired true; policy body → isPolicyRejection true, isModelRetired false; OK body → both false.</verify>
  <done>parseFalWebhook returns isModelRetired; classifyFalFailure exported; unit cases green.</done>
</task>

<task type="auto">
  <name>Task 2: Surface model_retired at the webhook ERROR branch with a Sentry alert</name>
  <files>app/api/video/webhook/fal/route.ts</files>
  <action>
In the ERROR branch (currently building errorMessage for the failed transition), when `result.isModelRetired`, prefix the persisted errorMessage with an actionable `model_retired? <model>:` string (include row.model) and emit ONE alert via `captureServerMessage`/`captureServerException` from lib/observability/sentry-server (guard with isSentryServerEnabled — never import @sentry/nextjs directly). Keep the existing atomic status-guarded updateMany and releaseQuota exactly as-is; only the errorMessage text + the alert are added. Idempotency (transitioned.count===0 → 200) unchanged.
  </action>
  <verify>npx jest --config jest.worktree.cjs webhook/fal (or __tests__/api/video) with mocked prisma + mocked sentry-server: a retired-model ERROR body persists errorMessage starting 'model_retired?' and calls the sentry sink once; a policy ERROR body does NOT.</verify>
  <done>Retired-model webhook produces model_retired? errorMessage + one alert; quota still released; idempotent path preserved.</done>
</task>

<task type="auto">
  <name>Task 3: Tighten holdQuota TOCTOU to a conditional updateMany</name>
  <files>lib/services/ai/video/quota.ts</files>
  <action>
Replace the read-then-unconditional-update in holdQuota's $transaction with a conditional guard so two concurrent holds cannot both pass a cap. Keep the lazy day/month reset semantics. Approach: after computing effective spent values, perform the increment via `updateMany({ where: { organizationId, ...cap-guard on current spent+estimate<=cap }, data })` and if `count===0` re-read and throw the appropriate QuotaExceededError (monthly/daily/mcp-daily). Preserve MCP_DAILY_FRACTION and the stale-period set-vs-increment logic. Do NOT change settleQuota/releaseQuota. Do NOT add SELECT FOR UPDATE (documented as the future upgrade path only).
  </action>
  <verify>npx jest --config jest.worktree.cjs quota — existing cases still green; add a concurrency-simulating case where a second guarded updateMany returns count 0 → throws QuotaExceededError and does NOT increment.</verify>
  <done>holdQuota uses a cap-guarded conditional update; overrun test proves the race is closed; reset semantics preserved.</done>
</task>

</tasks>

<verification>
- [ ] npm run type-check
- [ ] npm run lint
- [ ] npx jest --config jest.worktree.cjs lib/services/ai/video app/api/video/webhook — paste the Tests: line
- [ ] No @sentry/nextjs import added; alert goes through lib/observability/sentry-server
</verification>

<success_criteria>

- §15(2) precondition: a dead model id now yields a diagnosable model_retired? signal at submit/webhook (canary in WS2b consumes it).
- §11: holdQuota TOCTOU closed with a conditional update, proven by a concurrency unit test.
- §15(7): full gauntlet green on the branch.
  </success_criteria>

<output>
Write .planning/phases/nexus-viral-productionise/WS2a-SUMMARY.md (built? Tests: line? risks). NO merge, NO live fal call.
</output>
