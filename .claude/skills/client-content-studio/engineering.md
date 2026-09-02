---
type: engineering-requirements
spec: ./spec.md
spec_sha256: d722dd568cbddca8164b3b20997a7dc6ef2fd29ce0fc9bf786b506286dc310fd
reviewer: bench
seated:
  [
    boris,
    eng-failure,
    eng-observability,
    eng-test,
    eng-data,
    eng-authz,
    eng-concurrency,
    eng-contract,
    eng-performance,
    eng-release,
  ]
contributed: [eng-release]
reviewed_at: 2026-09-03T04:37:37+10:00
review_round: 2
reviewer_session_id: bench-client-content-studio-2026-09-03-rounds-1-2
diff_reviewer_session_id: codex-c29a44de0-release-gate-20260903
status: PASS
categories:
  data_model: { state: PRESCRIBED, ref: '#data-model', by: eng-data }
  invariants: { state: PRESCRIBED, ref: '#invariants', by: eng-authz }
  failure_modes: { state: PRESCRIBED, ref: '#failure-modes', by: eng-failure }
  interface_contract:
    { state: PRESCRIBED, ref: '#interface-contract', by: eng-contract }
  concurrency: { state: PRESCRIBED, ref: '#concurrency', by: eng-concurrency }
  migration: { state: PRESCRIBED, ref: '#migration', by: eng-data }
  rollback: { state: PRESCRIBED, ref: '#rollback', by: boris }
  observability:
    { state: PRESCRIBED, ref: '#observability', by: eng-observability }
  budget: { state: PRESCRIBED, ref: '#budget', by: eng-performance }
  test_oracle: { state: PRESCRIBED, ref: '#test-oracle', by: eng-test }
disagreements:
  - 'migration, boris vs eng-data — boris filed N/A in round 1 (no schema change in the range); eng-data filed blocking (drafts approved under the old route are unreachable by the new claim). Chair ruled for eng-data in round 2: a data-shape gap needs no DDL to exist. Resolved by a checked-in dry-run-default script (scripts/reset-orphaned-approved-studio-drafts.ts) with the ordering stated; the production count stays [UNCONFIRMED] and is a pre-merge step.'
  - "invariants, boris vs the approver narrowing (eng-authz) — the rule stands (publishing on an organisation's behalf is not the same authority as reading its board); the chair corrected the recorded cost: a user has ONE organizationId, so a second Studio client needs a BusinessOwnership row. spec.md Decisions now says so; the confirming query is a pre-merge step."
  - "budget/concurrency, eng-performance vs eng-concurrency — eng-concurrency asked for maxWait 2000 and timeout 5000; eng-performance warned that shedding at 2 s while the idempotency read stays unindexed is a coin flip. Ruling: maxWait 2000 (shed fast, protect the cron's share of a three-connection pool), timeout 15000 with a 5 s server-side statement_timeout and a 1 s lock_timeout, the shed caller answered with a retryable outcome rather than a 500, and the intent written next to the constant."
---

# Engineering requirements — client-content-studio (golden path g9 / g2 / g3)

Ten seats, two rounds, on `.claude/skills/client-content-studio/spec.md` and the branch
`feat/golden-path-restoreassist` (base `4023849df`). Round 1 ran cold on `c29a44de0` and every
seat blocked; the drain is `91a44b770`. Round 2 ran on that drain; its findings are resolved in
`ae70ec844`. Mutation controls for both drains: `~/session-handoffs/logs/mutate_round6.log`,
`mutate_round7.log`, and `mutate_itest.py` (a whole-column overwrite of the jsonb merge fails the
integration test's sibling-key assertion against a real Postgres). Every category below is
PRESCRIBED: the seats supplied the answers and the code now implements them; nothing here is a
quote of the spec.

Four production observations the seats asked for could not be made from the building session
(its read of the production database was refused by policy). They are `[UNCONFIRMED]` and
recorded as pre-merge steps with their exact queries in the PR body; none changes whether the
code is right, each decides whether a backfill, a cutover or a warning is needed.

## data-model

`by: eng-data` (rounds 1–2).

- **A re-seed overwrote an approved draft's script and approval record** while its scheduled Post
  still published. Resolved in `91a44b770` and hardened in `ae70ec844`: `saveStudioDraft` puts the
  status predicate IN the write — `[VERIFIED]` `lib/marketing-agency/studio/draft-store.ts:78`
  `where: { ...key, status: 'awaiting_approval' }` — then creates, and treats P2002 as "the row
  has left awaiting_approval", returning it untouched. Tests: studio-draft-store (3); mutant C of
  round 7 (predicate removed) fails.
- **`clientSlug` is a denormalised copy of `Organization.slug`.** Decided in spec.md Decisions:
  `organizationId` is the tenancy key; every Studio read and write is scoped by it.
- **The rolled-back attempt record wrote the whole `metadata` column from an application-side
  snapshot.** Resolved: `defaultRecordAttempt` merges ONE key at the database —
  `[VERIFIED]` `lib/marketing-agency/studio/approve-and-schedule.ts:434`
  `SET metadata = COALESCE(metadata, '{}'::jsonb) || ${patch}::jsonb` — on the row still
  `awaiting_approval`; the column is JSONB (`supabase/migrations/20260602055900_create_studio_content_drafts.sql:24`).
  Executed for real by `tests/integration/studio-approve-transaction.integration.test.ts` (sandbox
  Postgres); the merge's negative control is `mutate_itest.py`.
- **A likeness consent had no record of who wrote it.** Resolved in `ae70ec844`: the organisation
  PATCH stamps `consent.recordedBy` / `recordedAt` from the authenticated caller and the server
  clock, stripping any client-supplied value — `[VERIFIED]` `app/api/organizations/[orgId]/route.ts:103`.
  Test: organizations-orgid-patch "stamps who recorded a likeness consent".
- **Deferred with its trigger:** `approved` is a terminal draft state, `publishedAt` is never
  written, and the draft→Post link is a JSON string under a hard cascade. Forced back at the next
  migration that touches `studio_content_drafts` — the g10 ledger baseline (SYN-1002) — which is
  the one cheap moment to add a post-approval state and a real `studio_draft_id` column on `posts`.
- **`[UNCONFIRMED]`** `EXPLAIN ANALYZE` of the org-scoped `metadata->>'studioDraftId'` lookup at
  production volume (query in the PR body).

## invariants

`by: eng-authz` (rounds 1–2), with the chair's correction and eng-concurrency's campaign finding.

- **Approval was gated on membership including the parent-workspace path.** Resolved in
  `91a44b770`: `hasOrganizationAccess(userId, orgId, { includeParentWorkspace })` and
  `hasDirectOrganizationAccess` — `[VERIFIED]` `lib/multi-business/business-scope.ts:370`
  `if (includeParentWorkspace && target.parentOrgId)` — and the Studio POST requires the direct
  check — `[VERIFIED]` `app/api/marketing-agency/studio/[client]/route.ts:185`. The 403 now says
  why (`ae70ec844`). Tests: business-scope (2), studio-route (3); mutant F of round 6 fails three.
  **Chair's correction (round 2), recorded in spec.md Decisions:** "belong" has exactly two forms
  in the schema — `User.organizationId` equals the organisation, or an active `BusinessOwnership`
  row — so a user approves at most one Studio client by membership. `[UNCONFIRMED]` whether the
  founder's user satisfies the direct check for both pilots (query in the PR body); if the pilots
  carry `parent_org_id`, this branch removed the master-admin path that carried them.
  The `posts:approve` capability itself stays deferred until the first organisation with a
  `UserRole` row (`getUserPermissions` returns null with none, which would remove approval).
- **The consent record did not name the avatar it consents to**, so a partial PATCH of
  `avatarId` alone could render a different person under someone else's consent (made reachable
  by the deep merge). Resolved in `ae70ec844`: `consentSchema` carries `avatarId` / `voiceId`, the
  env layer sets them by construction, and the resolver refuses a render whose consent names
  another — `[VERIFIED]` `lib/marketing-agency/studio/clients.ts:188`
  `if (consent.avatarId !== avatarId || consent.voiceId !== voiceId)`. Tests: studio-org-driven-config
  (2); mutant D of round 7 fails both.
- **A rolled-back approval persisted the clearances the approver named** (chair, round 1 —
  contradicting the rollback-purity property). Resolved in `91a44b770`: the attempt record carries
  only `studioScheduleAttempt` (with `clearancesRequested`); `externalPublishClearances` is written
  only when the approval commits. Tests: bridge "records no clearance"; integration case 2.
- **`ScheduleViaPostInput.organizationId` is optional with an ambient fallback.** Deferred: before
  a second Studio-path or background caller of `lib/social/schedule-via-post.ts` lands (nine call
  sites today: eight per-user social routes plus the Studio, which passes it explicitly and pins
  that in `tests/unit/lib/social/schedule-via-post.test.ts`).
- **The env prefix is keyed on a mutable slug.** Deferred: until `STUDIO_ENV_PREFIXES` is deleted
  once the two pilots' `settings.studio` are populated; the consent binding above stops an
  inherited prefix from rendering another person meanwhile.
- **The `Scheduled Posts` campaign has no unique constraint** (eng-concurrency). Deferred: until
  the migration ledger is baselined (g10); for the Studio path a duplicate is cosmetic because the
  idempotency read scopes `campaign: { organizationId }`, not campaign id. `[UNCONFIRMED]` the
  duplicate count (query in the PR body).
- **`[UNCONFIRMED]`** the database role's `BYPASSRLS` and `relforcerowsecurity` on the four tables
  (queries in the PR body); if RLS is not forced, the `where` clauses in this diff are the whole
  of the enforcement, which raises the value of the two fixes above rather than lowering it.

## failure-modes

`by: eng-failure` (rounds 1–2).

- **A non-schedulable channel bypassed the pack's deny-by-default gate**: 27 of the 63 seeded
  CARSI drafts (blog, newsletter, youtube_shorts) approved with `externalPublishingAllowed: true`
  written and no blocker discharged. Resolved in `91a44b770`: the flag flips only on the positive
  fact — `[VERIFIED]` `approve-and-schedule.ts:868`
  `...(eligible > 0 ? { externalPublishingAllowed: true } : {})` — and reason-string matching is
  gone. Test: "a draft whose only channels the Studio cannot schedule … never discharges the
  pack"; mutant A of round 6 fails two tests.
- **Partial success was terminal** (a blocked platform could never be scheduled later). Resolved:
  ALL OR NOTHING — `[VERIFIED]` `approve-and-schedule.ts:846` `if (scheduled.length < eligible)`
  rolls the claim back and reports `rolled_back` / `existing_post_kept`. Test: "ALL OR NOTHING …"
  including the successful retry; mutant B of round 6 fails it. Recorded in spec.md Decisions.
- **The funnel link was silently dropped on every platform whose adapter ignores `linkUrl`.**
  Resolved: the link goes in the text unless the platform renders a card and the post has no
  media — `[VERIFIED]` `approve-and-schedule.ts:698` `const asCard =`; `metadata.linkUrl` is set
  only when a card is rendered. Tests: twitter text / linkedin card / linkedin+media text; mutant
  D of round 6 fails.
- **The new org publish gate had no reachable off-switch for a client organisation** (round 2):
  `calendarMode` was written only for the caller's own organisation. Resolved in `ae70ec844`:
  `POST /api/calendar/live-mode-activate` accepts `organizationId` for an organisation the caller
  belongs to directly — `[VERIFIED]` `app/api/calendar/live-mode-activate/route.ts:75` — and the
  Studio's 409 names the organisation and the remedy — `[VERIFIED]`
  `app/api/marketing-agency/studio/[client]/route.ts:238`. Tests: progressive-live-mode (2),
  studio-route (1); mutant G of round 7 fails two.
- **An approver with no active connection for an ordinary (non-pack) draft** gets Posts the cron
  fails at publish time (chair, cross-domain). Recorded, not changed: `credentialsReady` runs only
  where the pack lists the blocker; the cron's own failure path notifies the user.
- **A burst of approvals can starve the publish cron** on a three-connection pool
  (eng-concurrency). Partly resolved (statement timeout, lock timeout, platform cap, shed at
  `maxWait` with a retryable outcome); a P2024 counter and a route pre-read are recorded with the
  trigger "at the first P2024 on the approval route".

## interface-contract

`by: eng-contract` (rounds 1–2), with eng-release's settings finding.

- **`Organization.website` became a parser input**: a bare domain made every approval fail with
  "can be retried". Resolved in `91a44b770`, one validator in `ae70ec844`:
  `[VERIFIED]` `lib/marketing-agency/studio/clients.ts:109`
  `export const funnelUrlSchema = z.url({ protocol: /^https?$/ })` serves `settings.studio.funnelUrl`
  (write and read) and the website fallback (`clients.ts:302`), so `javascript:` and `ftp:` are
  refused everywhere. Tests: studio-org-driven-config (3), organizations-orgid-patch (1); mutant
  E of round 6 fails two.
- **The reserved-clearance refusal was validated twice with two shapes**, the typed one
  unreachable. Resolved: the route's zod refine is gone; the service's `InvalidClearanceError` is
  the single source of the 400 with `blockers`. Tests: studio-route (2).
- **`settings.studio` was accepted on write and discarded on read; a top-level merge erased the
  consent** (eng-release). Resolved: the organisation PATCH merges `studio` one level deep with
  explicit-null removal and validates the MERGED object — `[VERIFIED]`
  `app/api/organizations/[orgId]/route.ts:74` `function mergeStudioSettings` and `:107`; the
  schema is strict, so a misspelt key is a 400. The merge rules are stated once in that function's
  comment. Tests: organizations-orgid-patch (6); mutant E of round 7 fails four.
- **The board could not tell who may approve** after the authority split (round 2). Resolved:
  the GET carries `canApprove`, computed by the same function the POST gates on —
  `[VERIFIED]` `app/api/marketing-agency/studio/[client]/route.ts:83`. Test: studio-route.
- **Deferred with its trigger:** the dashboard page sends only `draftId`, renders neither
  `funnelUrl`, `warnings`, `canApprove`, `skipped` nor `blockers`, and cannot send `clearances`;
  the approver does not see the exact outgoing body per platform. Forced back at the edit that
  makes the Studio page render the approve button with clearances (g4, ticket w_23150fa80a59).
- **`saveStudioDraft` may return a stored row that is not the input** (a re-seed over an approved
  draft). Recorded in its doc comment; the one external caller discards the result.
- **`platforms` is bounded but not checked against `SUPPORTED_PLATFORMS`** (eng-failure). Recorded:
  an unsupported entry is reported `platform_not_schedulable` at approval and costs no round trip.

## concurrency

`by: eng-concurrency` (rounds 1–2).

- **Two writers on the draft metadata blob**: the attempt record was a whole-column write from a
  snapshot taken before a transaction that may have run for 15 s, and the re-seed's upsert could
  clobber an approval's record. Resolved: the database-side single-key merge (data-model above)
  guarded on `status = 'awaiting_approval'`, and the atomic status guard in `saveStudioDraft`
  (round 2 found the first guard was check-then-act; `ae70ec844` put the predicate in the write —
  `[VERIFIED]` `draft-store.ts:78`). Tests: bridge "merges only its own key"; draft-store; the
  integration test's sibling-key assertion, whose control fails under a whole-column overwrite.
- **The loser of a double approval waited on the winner's row lock for the whole statement
  budget** (round 2, a consequence of the statement timeout). Resolved in `ae70ec844`:
  `SET LOCAL lock_timeout = 1000` — `[VERIFIED]` `approve-and-schedule.ts:523` — and a claim that
  hits it (55P03) answers `not_awaiting_approval`, not a 500. Test: bridge "the loser of a
  concurrent approval …"; mutant A of round 7 fails it.
- **Two concurrent approvals of one draft** are serialised by the claim's row lock under READ
  COMMITTED; `approveStudioDraft` is still the only writer of `StudioContentDraft.status`, so the
  argument holds. It comes back at the first second writer of that column (an un-approve, a bulk
  approve, a cron auto-approver) — recorded under rollback.
- **The `Scheduled Posts` campaign find-or-create has no constraint** — deferred (invariants).
- **`metadata.idempotencyKey` is written and never read.** Recorded; the dedupe is on
  `metadata.studioDraftId`.

## migration

`by: eng-data` (rounds 1–2), chair's ruling recorded in `disagreements`.

- **Drafts approved under the OLD route** (approval flipped a status and stopped) are `approved`
  with no Post and no `studioSchedule`, and the new claim's predicate `status: 'awaiting_approval'`
  can never reach them; `91a44b770`'s re-seed guard made them un-refreshable too. Resolved in
  `ae70ec844` as a checked-in, dry-run-default script rather than PR prose:
  `scripts/reset-orphaned-approved-studio-drafts.ts` — the discriminator is exact
  (`metadata -> 'studioSchedule' IS NULL`, belt-and-braces no live Post), the reset is idempotent,
  and who approved each row is preserved under `metadata.legacyApproval`. Ordering stated in the
  script and in spec.md Decisions: run AFTER the bridge is live, never before. Decision recorded:
  re-open, not retire. `[UNCONFIRMED]` the count (the script's dry run prints it; the query is in
  the PR body).
- **No cutover for the two existing pilots** (eng-release): the fifth env variable is new and no
  route could set a client organisation's `calendarMode`. Resolved in `ae70ec844`:
  `scripts/cutover-studio-pilot.ts` writes a complete `settings.studio` (refusing a partial object)
  and `calendarMode = 'live'` for one organisation resolved by id or slug, from founder-supplied
  values (g8); and the activation route accepts a named organisation (failure-modes). Deferred
  behind the founder's values: until that script has run for `restoreassist` and `carsi`.
- **Two migration ledgers** (`prisma/migrations` sparse, `supabase/migrations` authoritative) with
  no rule for which wins — recorded for the g10 baseline (SYN-1002).

## rollback

`by: boris` (rounds 1–2).

- **The org kill switch did not reach Studio posts**: the cron gated only `source === 'autopilot'`,
  so neither `calendarMode: shadow` (the default) nor `autoPublishPaused` stopped a Studio post.
  Resolved in `91a44b770`: the bridge reads `resolveOrgAutoPublishGate(organizationId, tx)` before
  the loop — `[VERIFIED]` `approve-and-schedule.ts:762` — and the cron gates
  `source === 'studio'` for the publish-safety check only — `[VERIFIED]`
  `app/api/cron/publish-scheduled/route.ts:234` — while the authority manifest keeps the human
  approver as scheduler. Cost named in spec.md Decisions: a pilot publishes nothing until its
  organisation is `live`. Tests: bridge (3), cron (2); mutants C and G of round 6 fail.
- **The kill switch deferred and nothing drained what it deferred** (round 2): pausing read as a
  stop and behaved as a queue, releasing a backlog of dated posts on return to `live`. Resolved
  in `ae70ec844`: a Studio post more than 48 h past its `scheduledAt` is marked `expired` and never
  published — `[VERIFIED]` `app/api/cron/publish-scheduled/route.ts:264-275`
  (`STUDIO_POST_MAX_AGE_MS`). Recorded in spec.md Decisions. Test: cron "expires, never
  publishes …"; mutant F of round 7 fails it.
- **There is no un-approve.** Deferred: before the first client organisation's Studio Post is
  scheduled in production; until then the only stop before the next tick is a soft delete, which
  the cron honours (`deletedAt: null`), and the expiry bound above limits what a late stop can
  release.
- **Reverting the branch** restores the placeholder registry (harmless: no caller invokes the
  content loop unattended) and, more to the point after `91a44b770`, removes the kill switch from
  any `source: 'studio'` row left `scheduled` (eng-release). Deferred: on the first such row in
  production; until one exists a revert has nothing to mis-publish.

## observability

`by: eng-observability` (rounds 1–2), with eng-release's deployment findings.

- **The bridge's only failure channel was console logging**, and the Sentry helper the cron calls
  is a no-op stub (`lib/observability/sentry-server.ts:1-3`). Resolved in `91a44b770` and
  `ae70ec844` with the live path: `trackError` (error-tracker → Axiom in production) on the
  draft-read failure, every loop failure, the shed-at-`maxWait` path, a failed attempt record, and
  the route's 500 catch with the draft named — `[VERIFIED]`
  `app/api/marketing-agency/studio/[client]/route.ts:291`. Tests: bridge (3), studio-route (1).
- **`blocked` was thrown with no log line.** Resolved: `logger.warn('studio approval blocked',
{ organizationId, draftId, reasons })` with the distinct reasons; test asserts it.
- **A recorded link the adapter would drop** — resolved (failure-modes).
- **`defaultRecordAttempt` swallowed a wrong predicate silently** (returns 0, throws nothing).
  Resolved in `ae70ec844`: a matched count of 0 is logged as a warning naming the draft.
- **Deferred with their triggers:** the board asserts `studioSchedule.scheduled` and never
  re-checks the Post's status (forced back when the dashboard Studio page renders Post status per
  platform, g4); a dead-man check on the publish cron (before a second client organisation is
  onboarded — and, per round 2, the query must join `Organization` and count only `live`
  organisations, since the gate now correctly defers shadow-mode posts); post-deploy assertions
  that the deployed SHA serves and the pilots' boards report `configSource !== 'none'` (until the
  cutover script has run for the two pilots).
- **`[UNCONFIRMED]`** `AXIOM_TOKEN` / `AXIOM_DATASET` on Vercel production (names only:
  `vercel env ls production`); without both, `trackError` is a structured log line. The tracker
  also deduplicates by message, so a Studio alert should key on the log lines
  (`operation = 'studio/approve-and-schedule'`, more than 5 in 15 minutes), not on an Axiom event
  count.

## budget

`by: eng-performance` (rounds 1–2), ruling on the maxWait disagreement recorded above.

- **The per-platform idempotency read has no index** (relation filter plus a JSON-path equality
  on `posts`), inside a transaction that pins one of three pooled connections. Deferred: until the
  migration ledger is baselined (g10) so a partial expression index on
  `(metadata->>'studioDraftId', platform)` or a real `studioDraftId` column can land on `posts`;
  and, per round 2, when a single approval's transaction hold exceeds 2000 ms at p99.
  `[UNCONFIRMED]` the `EXPLAIN (ANALYZE, BUFFERS)` at production volume (query in the PR body).
- **The loop was unbounded** (`settings.studio.platforms` had no cap or uniqueness). Resolved in
  `91a44b770`: `.max(MAX_STUDIO_PLATFORMS = 9)` — `[VERIFIED]` `clients.ts:121` — deduplicated
  before the loop — `[VERIFIED]` `approve-and-schedule.ts:626` — and the unsupported-platform
  check short-circuits before any round trip, so database work is bounded by nine in code
  independent of the schema.
- **The 15 s budget was a client-side timer.** Resolved: `SET LOCAL statement_timeout = 5000` as
  the transaction's first statement — `[VERIFIED]` `approve-and-schedule.ts:517` — built from a
  compile-time constant (SET takes no bound parameter); each statement is now interruptible by
  Postgres. Residual stated: the enforced connection-hold ceiling is the 15 s client timer plus
  at most one in-flight 5 s statement.
- **`maxWait` moved from 5000 to 2000 while the hold time was left to grow** (round 2). Ruling
  and resolution in `ae70ec844`: shedding at 2 s is deliberate and the intent is written next to
  the constant; the `pg` pool's `connectionTimeoutMillis` (10 s) is the outer bound and `maxWait`
  fires first; a shed caller gets a retryable `schedule_failed` (`transaction_unavailable`) with
  the draft untouched instead of a 500 — `[VERIFIED]` `approve-and-schedule.ts:893`. Test: bridge
  "a caller shed at maxWait …"; mutant B of round 7 fails it. The rule recorded: `maxWait` must be
  at least the p99 hold or shedding is a coin flip — which is why the index deferral carries the
  2000 ms trigger above.
- The cron's per-item gate read for Studio posts is bounded by `take: 50` per tick. Cleared.

## test-oracle

`by: eng-test` (rounds 1–2), with eng-failure's and eng-release's oracle findings.

- **The default credentials predicate was never executed by any test.** Resolved in `91a44b770`:
  a test strips the injection and drives the real default against a four-row fake connection
  table (active+org, active+NULL org, active+other org, inactive), asserting the exact `where`;
  deleting `isActive` or `organizationId` now fails it. The NULL-org case is pinned as not
  discharging, consistent with the cron (its unscoped fallback applies only to posts with no
  organisation).
- **The two tests that would have caught the round-1 failure modes** exist: the seeded
  blog/newsletter draft, and the partial-block rollback with its successful retry.
- **`defaultRecordAttempt` and `resolveOrgAutoPublishGate`'s client parameter had no oracle**
  (round 2). Resolved in `ae70ec844`: a bridge test with `recordAttempt` omitted asserts the raw
  UPDATE's text (`COALESCE(metadata, '{}'::jsonb) ||`, `organization_id = ?`,
  `status = 'awaiting_approval'`) and its parameter order; a safety-checks test proves the handed
  client is used and the global one is not (mutant H of round 7 fails it).
- **The transaction had never run against a Postgres** (eng-release, eng-concurrency, eng-failure).
  Resolved in `ae70ec844`: `tests/integration/studio-approve-transaction.integration.test.ts`
  runs the approval with no injected runner and no injected attempt record against the sandbox
  (:5499): a commit case (draft `approved`, Post row created through the transaction,
  `studioSchedule` recorded) and a rollback case (draft still `awaiting_approval`, sibling key
  survives, only `studioScheduleAttempt` merged). Observed green twice
  (`~/session-handoffs/logs/itest-studio-approve-transaction.log`); the whole-column-overwrite
  mutant fails case 2 (`…-MUTANT-whole-column-overwrite.log`). Recorded, not changed: the
  integration workflow runs with `continue-on-error: true` (`.github/workflows/integration-tests.yml:24`),
  so this lane cannot yet fail a PR — forced back when that flag is removed for this file.
- **A real-`$transaction` assertion that after ANY throw zero Posts carry the draft id** — the
  rollback case above asserts exactly that for the blocked path; a forced mid-loop failure on a
  real database remains the Docker RLS lane's job.
- Sixteen mutation controls across the two drains, each killing the test it claims, are logged
  in `mutate_round6.log` and `mutate_round7.log`; the round-6 Codex reviewer ran its own on the
  transactional redesign.
