---
phase: nexus-viral-productionise
workstream: WS4b
plan: WS4b
type: execute
baseline: origin/main @ f3fd9cf3
model: opus
model_rationale: SAFETY-CRITICAL - the only sanctioned queued_human_gated->pending transition
title: POST /api/publish-queue/release - human release route + invariants
---

<objective>
The single human-gated path that transitions youtube/tiktok publish_queue rows
from queued_human_gated to pending: Zod + owner/RBAC + org-scope + rate limit +
audit row, batch or per-cut, atomic updateMany. Plus the grep-level invariant
test that NO automated queued_human_gated->pending transition exists elsewhere.
Spec section 9 WS4 (release route), section 12, section 15(6)(8)(9).
</objective>

<context>
@lib/api/define-route.ts              # typed Zod route contract - use for the POST body
@lib/publish/publishQueue.ts          # publish_queue processes status 'pending'|'failed'; release flips queued_human_gated->pending so the existing 15-min queue then dispatches via the WS4a youtube/tiktok cases
@lib/video/social-derivation.ts       # deriveSocialCut enqueues status 'queued_human_gated' (line ~618) - the rows this route releases; PublishQueueItem.status is a String (no enum)
@lib/rate-limit/presets.ts (line 120) # writeDefault = createCategoryLimiter('write-default',60000,30) - the rate limit to apply
@lib/audit/audit-logger.ts            # audit_logs writer for the release audit row (section 15(8))
@lib/video/gates/assert-gate-passed.ts  # (WS3b) release MUST assertGatePassed before transition - a FAIL QA row blocks release (section 15(3))
@lib/auth/ (RBAC)                      # owner/admin RBAC + getEffectiveOrganizationId(userId) org-scoping (check lib/auth first per project rule)

[UNCONFIRMED] confirm the exact RBAC helper + audit-logger signature at build time via lib/auth + lib/audit (two audit-logger candidates: lib/audit/audit-logger.ts and lib/security/audit-logger.ts - pick the one used by existing write routes).
Constraint: NO auto-transition anywhere else. jest.worktree mocked prisma/auth. NO publish executed in tests.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Release route - Zod, RBAC, org-scope, rate limit, audit, atomic transition</name>
  <files>app/api/publish-queue/release/route.ts</files>
  <action>
POST handler via define-route with a Zod body: { itemIds: string[] } supporting batch OR per-cut (single-element array = per-cut). Enforce owner/admin RBAC; resolve effectiveOrgId and scope every query to it (reject cross-org itemIds -> 403). Apply writeDefault rate limit. For each item: assertGatePassed(assetRef,'broadcast') - a FAIL blocks that item. Transition atomically with updateMany({ where:{ id, organizationId, status:'queued_human_gated' }, data:{ status:'pending', scheduledAt: now }}); count===0 means already-claimed/wrong-state -> skip (idempotent, concurrency-safe like postPublishClaim). Write an audit_logs row per released item. Error shape { error, details? }. Return per-item results (released/skipped/blocked).
  </action>
  <verify>npx jest --config jest.worktree.cjs publish-queue/release with mocked prisma/auth: 401 unauth, 403 cross-org, 400 bad body, 200 happy path releases only queued_human_gated rows; gate-FAIL item is blocked not released; audit row written per release.</verify>
  <done>Release route is the sole queued_human_gated->pending path: RBAC + org-scoped + rate-limited + gated + audited + atomic.</done>
</task>

<task type="auto">
  <name>Task 2: Concurrency + RBAC ladder tests (401/403/400/200)</name>
  <files>__tests__/publish/release-route.test.ts</files>
  <action>
Full ladder: unauth ->401; authed cross-org itemId ->403; malformed body ->400; owner in-org ->200. Concurrency: two simultaneous release calls for the same item - exactly one updateMany wins (count 1), the other count 0 -> skipped (reuse the postPublishClaim atomic-claim assertion pattern). Zero cross-org access (section 15(6)). Audit rows present (section 15(8)).
  </action>
  <verify>npx jest --config jest.worktree.cjs publish/release-route - ladder + concurrency green.</verify>
  <done>section 15(6) zero cross-org proven; section 15(8) audit rows proven; concurrent double-release safe.</done>
</task>

<task type="auto">
  <name>Task 3: Grep-level invariant test - no automated queued_human_gated->pending</name>
  <files>__tests__/publish/no-automated-gate-transition.test.ts</files>
  <action>
Static/source-scan test (section 15(9) half 2): scan lib/ and app/ (excluding app/api/publish-queue/release) for any code that sets status 'pending'/'publishing' on a row whose prior state is queued_human_gated, or any updateMany/update writing status:'pending' keyed on status:'queued_human_gated' outside the release route. Assert the ONLY such transition lives in the release route. Complements WS4a's seedPublishQueue-skip test.
  </action>
  <verify>npx jest --config jest.worktree.cjs no-automated-gate-transition - passes on current tree; would FAIL if a future edit adds an automated transition.</verify>
  <done>section 15(9) half 2 proven: no automated queued_human_gated->pending transition exists.</done>
</task>

</tasks>

<verification>
- [ ] npm run type-check && npm run lint
- [ ] npx jest --config jest.worktree.cjs publish-queue/release __tests__/publish - paste Tests: line
- [ ] RBAC ladder 401/403/400/200 all green; audit rows asserted
- [ ] Both section 15(9) tests green (seed-skip in WS4a + grep-scan here)
</verification>

<success_criteria>

- section 15(6): zero cross-org access in release route tests.
- section 15(8): release audit rows present.
- section 15(9): release route is the ONLY queued_human_gated->pending transition (unit + grep-scan).
- section 15(3): gate-FAIL blocks release. Human owns the live YouTube publish proof.
  </success_criteria>

<output>
Write WS4b-SUMMARY.md. Confirm RBAC/audit helper choices resolved from lib/auth + lib/audit.
</output>
