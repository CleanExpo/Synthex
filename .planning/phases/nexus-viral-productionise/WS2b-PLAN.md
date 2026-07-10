---
phase: nexus-viral-productionise
workstream: WS2b
plan: WS2b
type: execute
baseline: origin/main @ f3fd9cf3
model: sonnet
title: Weekly paid canary cron — /api/cron/video-canary
---

<objective>
Add a weekly, spend-capped canary that runs a registry-driven draft video
smoke against a dedicated internal canary org and alerts (Sentry) when the
live model set has drifted — the end-to-end proof behind WS2a's free signal.
Spec §9 WS2(b), §14, §15(2).
</objective>

<context>
@app/api/cron/social-cut-render/route.ts     # canonical cron shape: runtime nodejs, dynamic force-dynamic, maxDuration, verifyCronRequest(request,'ROUTE_NAME') → auth.response on fail, dynamic import of heavy work
@lib/auth/cron-auth.ts                        # verifyCronRequest(request, routeName) — per-route CRON_SECRET_<NAME> then shared CRON_SECRET fallback
@lib/services/ai/video/registry.ts            # VIDEO_MODELS[] with id + costPerSecondUsd — canary picks the current draft model FROM the registry (never hardcoded)
@lib/services/ai/video/generation-service.ts  # submitGenerativeVideo(...) — the submit path canary drives at draft tier
@lib/services/ai/video/quota.ts               # holdQuota/settleQuota — canary org gets its OWN organizationVideoQuota row + hard spend cap
@scripts/video-smoke-test.ts                  # existing smoke pattern to model the canary assertion (rendered + correct model id)
@lib/observability/sentry-server.ts           # captureServerException/Message — the only sanctioned alert sink
@prisma/schema.prisma                          # Organization.settings Json — internal/canary flag lives HERE (no is_internal column, no migration); parentOrgId=null excludes it from client aggregates

[UNCONFIRMED] No existing helper reads Organization.settings for an internal/canary flag — this plan DEFINES the convention: settings JSON key `internalCanary: true`, parentOrgId null.
Constraint: NO prod migration. Canary org row is DATA authored by founder (WS0/human), NOT schema.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Canary runner module (registry-driven, spend-capped, isolated org)</name>
  <files>lib/video/canary/run-video-canary.ts</files>
  <action>
Create runVideoCanary({ dryRun }): resolves the dedicated canary org by Organization.settings JSON `internalCanary === true` (throw a clear 'canary org not provisioned' error if none — WS0 human data step). Enforce a hard USD spend cap constant (e.g. CANARY_MAX_USD) before submit; abort if the org's remaining quota < estimate. Pick the current draft-tier model FROM VIDEO_MODELS (not a literal). In dryRun mode (default for tests) do NOT call fal — accept an injected submit fn / provider double so jest.worktree runs with zero external calls. Assert result: a rendered artifact + returned model id === the registry model id. Return {ok, modelId, rendered, costUsd, error?}. On failure classify via WS2a's classifyFalFailure so a retired model surfaces as model_retired.
  </action>
  <verify>npx jest --config jest.worktree.cjs canary — (a) a test double returning a DELIBERATELY-DEAD model id / 404 → ok:false, error classified model_retired; (b) a healthy double → ok:true, modelId matches registry. No network.</verify>
  <done>runVideoCanary is registry-driven, spend-capped, org-isolated, injection-testable; dead-model double fails as model_retired (§15(2) test half).</done>
</task>

<task type="auto">
  <name>Task 2: Cron route /api/cron/video-canary with Sentry alert on fail</name>
  <files>app/api/cron/video-canary/route.ts</files>
  <action>
Mirror social-cut-render/route.ts: runtime nodejs, dynamic force-dynamic, maxDuration, GET handler calling verifyCronRequest(request,'VIDEO_CANARY') → return auth.response on fail. Dynamically import lib/video/canary/run-video-canary so the media/provider toolchain stays out of the shared bundle. On {ok:false} emit ONE alert via captureServerException (guard isSentryServerEnabled; never @sentry/nextjs). Return JSON {success, ok, modelId, costUsd, error}. Weekly schedule is a vercel.json entry — AUTHOR the cron entry but note the LIVE first run is a human-triggered STOP (draft-first-spend). Do NOT invoke any live generate here in tests.
  </action>
  <verify>npx jest --config jest.worktree.cjs cron/video-canary with mocked run-video-canary + mocked sentry-server + mocked cron-auth: 401 when unauthorised; on ok:false calls sentry sink once and returns success:true ok:false; on ok:true no alert.</verify>
  <done>Route auths via verifyCronRequest, alerts once on drift, never calls fal in tests. vercel.json weekly entry authored.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>GATE: provision canary org + first LIVE canary run (paid, human-acked)</name>
  <files>(none — data + live spend)</files>
  <action>
BLOCKING human gate. Before any live canary: (1) Founder provisions the dedicated internal canary Organization with settings.internalCanary=true, parentOrgId=null, and its own organizationVideoQuota row with the hard cap — this is DATA, applied by the founder, NOT a migration this agent runs. (2) Founder manually triggers the first /api/cron/video-canary live run and confirms the priced draft smoke rendered + correct model id (§15(2) live half). Overnight/agent MUST NOT run this — draft-first-spend is human-acked.
  </action>
  <verify>Human confirms: canary org exists (settings.internalCanary), first live run returned ok:true with the registry model id, spend within cap.</verify>
  <done>Human ack recorded; §15(2) live half satisfied. Not automatable by the agent.</done>
</task>

</tasks>

<verification>
- [ ] npm run type-check && npm run lint
- [ ] npx jest --config jest.worktree.cjs lib/video/canary app/api/cron/video-canary — paste Tests: line
- [ ] Registry-driven (no hardcoded model id) — grep the route/runner for literal model strings = none
- [ ] Alert path is lib/observability/sentry-server only
</verification>

<success_criteria>

- §15(2): dead-model test double fails as model_retired (unit) AND the live run passes (human gate).
- Canary org excluded from client/workspace aggregates (parentOrgId null + settings flag), own quota, hard spend cap.
- §15(7): gauntlet green. NO prod migration. NO unattended live spend.
  </success_criteria>

<output>
Write WS2b-SUMMARY.md. Record the human gate as OPEN (canary provisioning + first live run).
</output>
