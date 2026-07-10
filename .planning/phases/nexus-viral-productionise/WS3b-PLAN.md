---
phase: nexus-viral-productionise
workstream: WS3b
plan: WS3b
type: execute
baseline: origin/main @ f3fd9cf3
model: opus
title: Deterministic enforcer - assertGatePassed + derive wiring
---

<objective>
Build the code half of the gate pair: assertGatePassed(assetRef) reads the QA
row and deterministically blocks when it is FAIL/absent, wired into the derive
path, with golden-transcript unit tests. An agent's "8/8" is inert until this
enforcer reads it. Spec section 9 WS3, section 8(3), section 15(3).
</objective>

<context>
@lib/video/gates/index.ts             # (from WS3a) producers + QA row shape (metadata.gate, metadata.assetRef)
@prisma/schema.prisma (line 3557)     # MarketingAgencyQaReport.status 'passed'|'blocked'; blockedReasons Json
@lib/video/social-derivation.ts       # deriveSocialCut (line 623) - lands cut in video_assets 'pending' + enqueues publish_queue 'queued_human_gated' (line 618-625). Derive path must call assertGatePassed BEFORE enqueue.
@lib/services/ai/studio-tools/index.ts  # derive_cuts tool (line 153) sets publishState 'queued_human_gated' - enforcer guards the derive tool too
@lib/observability/sentry-server.ts   # captureServerException - FAIL is terminal + one alert

Constraint: jest.worktree mocked prisma. NO migration. FAIL terminal (no auto-retry loop).
</context>

<tasks>

<task type="auto">
  <name>Task 1: assertGatePassed(assetRef, gate) deterministic enforcer</name>
  <files>lib/video/gates/assert-gate-passed.ts</files>
  <action>
Read the latest MarketingAgencyQaReport for the assetRef+gate (metadata JSON match, newest by createdAt). Return/throw deterministically: PASS only when a row exists AND status==='passed'; a 'blocked' row OR NO row -> throw GateFailedError with blockedReasons. Fail-closed: absence of a QA row is a FAIL, never a pass. On FAIL emit ONE alert via captureServerException (guard isSentryServerEnabled; never @sentry/nextjs). No re-judge loop here - FAIL is terminal for the caller.
  </action>
  <verify>npx jest --config jest.worktree.cjs assert-gate-passed with mocked prisma: passed row -> resolves; blocked row -> throws GateFailedError; NO row -> throws (fail-closed). Sentry sink called once on FAIL.</verify>
  <done>assertGatePassed is deterministic, fail-closed, terminal, alerts on FAIL.</done>
</task>

<task type="auto">
  <name>Task 2: Wire assertGatePassed into the derive path</name>
  <files>lib/video/social-derivation.ts, lib/services/ai/studio-tools/index.ts</files>
  <action>
In deriveSocialCut (before the publish_queue 'queued_human_gated' enqueue, ~line 618) call assertGatePassed(assetRef,'broadcast'); a GateFailedError aborts the derive WITHOUT enqueuing - the cut is not created. Same guard for the derive_cuts studio tool. Do NOT change the queued_human_gated status value or add any auto-transition. Behaviour identical when the gate passes.
  </action>
  <verify>npx jest --config jest.worktree.cjs social-derivation derive: gate-blocked asset -> deriveSocialCut aborts, NO publish_queue row created; gate-passed asset -> existing behaviour unchanged.</verify>
  <done>Derive/derive_cuts refuse to enqueue when the QA row is FAIL/absent; pass path unchanged.</done>
</task>

<task type="auto">
  <name>Task 3: Golden-transcript acceptance test - FAIL blocks</name>
  <files>__tests__/video-gates/golden-transcript.test.ts</files>
  <action>
Golden fixtures: a known-PASS and a known-FAIL transcript. Assert (a) a FAIL QA row -> assertGatePassed throws AND the derive path creates no publish_queue row (section 15(3)); (b) a PASS row -> resolves. Mocked prisma with pre-seeded QA rows - no LLM call (producer output is WS3a; this test proves the enforcer gates on the row).
  </action>
  <verify>npx jest --config jest.worktree.cjs video-gates/golden-transcript - both cases green.</verify>
  <done>section 15(3) proven: assertGatePassed blocks release/derive when the QA row is FAIL.</done>
</task>

</tasks>

<verification>
- [ ] npm run type-check && npm run lint
- [ ] npx jest --config jest.worktree.cjs lib/video/gates __tests__/video-gates lib/video/social-derivation - paste Tests: line
- [ ] Fail-closed on missing row proven
</verification>

<success_criteria>

- section 8(3): enforcement is deterministic code reading QA rows; agent verdict inert until read.
- section 15(3): FAIL QA row blocks release/derive - proven by golden-transcript test.
- FAIL terminal + one Sentry alert; no auto queued_human_gated transition introduced.
  </success_criteria>

<output>
Write WS3b-SUMMARY.md.
</output>
