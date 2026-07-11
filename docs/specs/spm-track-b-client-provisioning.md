# SPM Spec — Track B: Command-Centre → Client Provisioning Tenancy Model

`/spm` output · 2026-07-11 · repo `CleanExpo/Synthex` @ main `aee3b3df` · **read-only run; no build performed**
Status: **COMPLETE** — 6/6 bench contracts folded (§7 receipt), judge challenge answered (§8), adversarial verify pass amendments folded (§8b), recommendation **APPROVE BUILD** (§19)

---

## 1. Task

Produce the focused, build-ready spec for **Track B** of the Synthex consumption-boundary program: the tenancy model and API surface by which the Unite-Group CRM ("Mission Control" = the in-repo `app/api/command-centre` surface) provisions **client** tenants in Synthex — one isolated child Organization per UG-CRM client under the brand parent — plus provenance, offboarding, and the publish/spend edge.

## 2. Project context

- **Owner decisions LOCKED** (2026-07-11 session, via AskUserQuestion): (a) "Mission Control" is the in-repo `app/api/command-centre` surface, not an external app; (b) 1 UG-CRM client = 1 isolated Synthex Organization under the brand as parent — 3-tier chain Unite-Group → Brand → Client via `Organization.parentOrgId` (SYN-847, `prisma/schema.prisma:523`).
- **Track A is merged** (`aee3b3df`, PR #701): fail-closed invite mode (`lib/auth/invite-mode.ts`) + invite evidence (`lib/auth/invite-gate.ts`); five signup/org-provisioning doors gated. Track B must compose with — never weaken — that gate.
- **Prod migrations are founder-gated** (manual SQL apply; CI does not auto-apply). Anything requiring schema change must be sequenced as an explicit founder packet.
- Prior full-program /spm: judge 38/100 REDUCE SCOPE; Track B was upgraded to "build after a focused /spm". This is that spec.

## 3. Problem

There is no way to provision a client tenant from the command-centre. Concretely:

1. **No create path for child orgs.** `parentOrgId` (SYN-847) has GET-only surfaces (`/api/organisations/children`, `/api/workspaces/[parentSlug]`); nothing creates a child.
2. **Multiple live "which-org" resolutions.** Three divergent resolutions run in production today: `withAuth.clientId` = `User.organizationId` (`lib/auth/with-auth.ts:119`); `getEffectiveOrganizationId` = `activeOrganizationId || organizationId` (`lib/multi-business/business-scope.ts:49-63`); `getEffectiveQueryFilter` = `{userId}` for regular users vs `{organizationId}` for owners (`business-scope.ts:100-161`). (The bench deflated the original "3 client models" framing: the Supabase `clients` table (#471) is an id-only bootstrap placeholder — migration `20260405000005` — not a live third model.)
3. **No provenance.** Nothing records that an org was provisioned by the CRM, for which external client record (`externalRef` appears nowhere in the repo).
4. **No real offboarding.** The only `status==='suspended'` gate (`lib/multi-tenant/tenant-resolver.ts:86`) runs via middleware that is disabled (`middleware.ts.disabled`); `withAuth` and `resolveOrgFromBearer` (`app/api/mcp/auth.ts`) never read `Organization.status`. Suspension today enforces nothing on live request paths (first-source verified this run).
5. **Unbounded spend edge.** `OrgBudgetPolicy.enforcementMode` defaults to `log_only` and the enforcer no-ops with no policy row and unset env ceilings (`lib/ai/budget-enforcer.ts:35,226-236`) — a provisioned client org is not cost-bounded by default.

## 4. Desired outcome

A brand admin (and later, the CRM acting programmatically) can provision a client tenant under their brand in one idempotent call; the client-owner can accept an invitation and pass the Track-A gate without weakening it; the brand can offboard the client and the client is cut off on **every org-scoped plane** (withAuth, MCP keys, and the `getEffectiveOrganizationId` publish/generation surface — with the two v1 residuals named in S6': live JWT sessions and org-agnostic image generation); every provisioning action is auditable; client spend is bounded **on the enforcer-covered surface** (S7' states coverage honestly). All of it CI-provable within the repo's sandbox lanes.

## 5. Scope

### In scope (v1 — code-only, no prod migration)

- **S1'** Parent-aware client provisioning as a **thin extension of the existing, tested `POST /api/organizations`** create core (extracted shared `provisionClientOrg()` in `lib/tenancy/`), invoked from a new command-centre route that owns _policy_ (provenance, invitation, audit), not create _mechanics_. [folds judge `fold-into-existing-org-post`, architect shared-core suggestion]
- **S2'** Idempotency anchored on the only code-only race-safe constraint available: a **deterministic child slug** derived from **immutable inputs only** — `c-${base36(sha256(parentOrgId + ':' + externalRef)).slice(0,12)}` (org **id**, never the mutable brand slug) — arbitrated by the existing `Organization.slug @unique` index (catch P2002 → replay path). The replay path **status-checks** the found child: `active`/`suspended` → returned with its status flagged; `deleted` → 409 conflict surfaced (tombstoned orgs retain their slug under the full unique index — documented, resolved for real by the founder packet). `settings.provisioning` JSON is best-effort display metadata, **not** load-bearing. [folds architect `json-path-idempotency-not-race-safe`, ops `no-idempotency-guard-on-client-create`, judge `idempotency-needs-constraint`; amended per adversary flip: mutable-parent-slug derivation + tombstone replay hole removed. The DB column+unique index remains the founder-gated durable fix, §17]
- **S3'** AuthZ: **brand-admin JWT only**. The parent org is **derived from the authenticated principal's own org** (`withAuth` clientId = `User.organizationId`) — **never from a request-body field, never from `activeOrganizationId`** — and validated `parent.parentOrgId === null` (depth-2 cap; a child-org caller is rejected 403). This copies the proven children-route scoping (`app/api/organisations/children/route.ts:31-36`: parent = session org, no request parameter selects it). The MCP `provisioning` scope / machine-caller path is **CUT from v1** (no caller exists); additionally, the existing mint route gains a **scope-tier allow-list**: child orgs (`parentOrgId !== null`) can only be granted read/draft scopes, and `provisioning`/wildcard scopes are not mintable at all in v1. [folds security `derive-parent-from-authenticated-principal` + `tier-gate-provisioning-mcp-scope`, judge `defer-mcp-provisioning-scope`, PM `contract-before-build`, architect `depth-3-nesting-via-effective-org`]
- **S4'** Track-A composition — **org-locked evidence**: provisioning creates a `TeamInvitation` (the revocable evidence path — never `InviteCode`) with `organizationId = childOrg` **required non-null**, for the client-owner email. `lib/auth/invite-gate.ts` is tightened via a **parameterized check applied ONLY at the 2 self-provisioning call sites** (`organizations/route.ts:91`, `onboarding/review/route.ts:104`): an **org-locked** invitation satisfies the signup gate and grants access to _join that org_ via invite-accept, but does **not** count as evidence for self-provisioning a _different_ org. The 3 OAuth login-gate consumers (`signInFlow.ts:409`, `callback/[platform]:993`, `oauth/github/callback:235`) are **untouched** — a global edit would regress Track-A login for legitimately team-invited users (adversary-verified consumer fan-out). This closes the invite-minting-oracle vector: a CRM-supplied email cannot parlay its provisioning invite into an arbitrary open-market org. **Email delivery ships in v1 behind an explicit env gate** (`SYNTHEX_PROVISIONING_INVITE_EMAILS=true` to send; silent row otherwise), reusing `sendBrandedTeamInviteEmail`. Offboard flips the invitation status out of the evidence set. [folds security `org-lock-the-invite-evidence`; reconciles PM `client-owner-notification-gap` × ops `team-invitation-email-send-ambiguous`; folds QA `track-a-evidence-not-fully-revocable`]
- **S5'** Membership written to match what live resolution paths actually read: client-owner gets `User.organizationId` (home pointer) + `TeamMember(owner)` + `ensureDefaultRoles`, mirroring the `invite/accept` dance — no new "canonical helper used only by new routes". The word **"reconcile" is dropped from v1 scope**: this is additive child provisioning; convergence of the three live resolutions is a separately-specced effort (§17). [folds architect `s5-dual-write-adds-fourth-divergence`, judge `drop-reconcile-claim-or-migrate-existing`]
- **S6'** Real offboarding enforcement at named chokepoints: `POST .../offboard` sets `status='suspended'` AND (a) revokes every `mcp_api_keys` row for the child (reusing the idempotent soft-revoke from `app/api/admin/mcp-keys/route.ts:163-177`), (b) adds an org-status gate inside `resolveOrgFromBearer`, (c) adds a status check in `withAuth` resolution, (d) neutralises the home pointers (`User.organizationId`/`activeOrganizationId`) of **every member of the child org** (owner and collaborators), (e) flips the provisioning `TeamInvitation` status, **(f) adds a suspended-org refusal inside `getEffectiveOrganizationId` itself** — the single resolver behind the ~144-route publish/generation surface (`social/post`, `video/generate`, command-centre, …), whose callers already handle a null org ("No organisation found"). **Documented residual risks (v1, honest):** already-issued JWT sessions are not revoked (session-revocation infrastructure = §17 follow-up), and org-agnostic generation (`media/generate/image` runs `clientId=null`) is user-scoped, not org-scoped, so it is untouched by org suspension — named, not claimed closed. Reversible; no hard delete. [folds judge `offboard-must-enforce-or-not-claim`, QA `suspension-not-enforced-at-mcp-auth-chokepoint`, security `make-suspend-actually-cut-the-data-plane`, architect offboard suggestion; amended per adversary flip: coverage extended to the getEffectiveOrganizationId plane + all-member pointers, residuals stated]
- **S7'** Spend edge: provisioning writes an `OrgBudgetPolicy` row for the child with `enforcementMode='enforce'` and explicit ceilings (values owner-configurable; conservative defaults) — never relying on the log-only default. **Honest coverage statement (adversary-verified):** the budget enforcer is consumed only by `ai/generate-content` + `ai/calendar-jobs` (+ calendar worker); image generation runs `clientId=null` (unenforceable per-org today) and video/voice ride a separate quota (`QuotaExceededError`). v1 bounds what the enforcer covers; extending enforcement across the full generation surface is a named §17 follow-up, not a v1 claim. [folds ops `budget-enforcement-defaults-to-log-only-fail-open`; amended per adversary partial-flip]
- **S8'** Audit trail: `provisioning.created` / `provisioning.replay_detected` / `provisioning.offboarded` AuditEvent members via the existing `lib/audit/audit-logger.ts`, org identifiers carried in `details` JSON (no migration). [folds ops `auditlog-missing-org-column`]
- **S9'** Duplicate-client guard (advisory): provision checks `BusinessOwnership` and warns on a name/slug collision with an existing owned business in the response (non-blocking; the CRM/admin decides). [folds PM `cross-model-duplicate-risk` proportionately — the Supabase `clients` table is a placeholder and is not checked]
- **S10'** Contract-first fixture: the request/response contract is checked in as a fixture + contract test, standing in for the CRM until the real caller exists (in-repo precedent: `hermes-handoff`). [folds PM `contract-before-build`]

### Out of scope (v1)

- The MCP `provisioning` scope / machine-caller path (build when a CRM caller exists — §17).
- Migrating existing routes onto one membership resolution ("reconciliation proper" — own spec).
- Hard delete / purge; `externalRef` column + `@@unique([parentOrgId, externalRef])` (founder packet, §17).
- Root/brand bootstrap via API (manual runbook artifact instead — §11).
- Any prod migration, RLS change, or Supabase `clients`-table work.

## 6. Existing capability (do not rebuild)

| Capability                                                            | Where                                                                                     | Reuse                             |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------- |
| Full org creation (org + roles + user-link + settings + Track-A gate) | `app/api/organizations/route.ts:48-196`                                                   | Extract/extend as the create core |
| Parent→child brand-admin authorization                                | `lib/multi-business/business-scope.ts:180-260` (`hasOrganizationAccess`)                  | S3' authz                         |
| Children listing scoped to caller org                                 | `app/api/organisations/children/route.ts`                                                 | Model for the list view           |
| Membership-establishment dance                                        | `app/api/invite/accept/route.ts:148-192`                                                  | Mirror in S5'                     |
| Idempotent MCP key soft-revoke                                        | `app/api/admin/mcp-keys/route.ts:163-177`                                                 | S6'(a)                            |
| Branded team-invite email                                             | `lib/email/team-invite-email.ts`, `app/api/teams/invite/route.ts`                         | S4' (env-gated)                   |
| Budget enforcer + OrgBudgetPolicy                                     | `lib/ai/budget-enforcer.ts`, schema `OrgBudgetPolicy`                                     | S7' (write enforce-mode row)      |
| Audit logger (SYN-440)                                                | `lib/audit/audit-logger.ts`                                                               | S8' (new event members)           |
| Idempotency-key precedent                                             | `@@unique([organizationId, externalId])` `schema.prisma:3655,3696`                        | Founder packet shape (§17)        |
| Docker sandbox lane (prod structurally unreachable)                   | `sandbox-guard.ts` (`:5499`/`:6399` hard-fail), `npm run sandbox:up` / `test:integration` | §13                               |

## 7. Specialist board — receipt

`leveling_version: 1.0` · `board_version: 1.0` · Tier **T3** (axis F2 I2 N1 X2 S2, sum 9; S=2 and I=2 each auto-promote). Seats convened as parallel read-only leaf agents (models requested via Agent `model` param — requested tier is intent; serving model not observable from output). `ux-reviewer` skipped (internal/API surface, per cost-narrowing order); `domain-specialist` skipped (no non-engineering domain). No project board override. HARD_STOP checked before dispatch: absent.

| Seat                  | Model req. | Verdict                       | Conf. | must_fix (slugs)                                                                                                                                                                                     |
| --------------------- | ---------- | ----------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| product-manager       | Sonnet     | needs-work                    | 0.78  | client-owner-notification-gap · cross-model-duplicate-risk · contract-before-build                                                                                                                   |
| architect             | Opus       | needs-work                    | 0.72  | provenance-clobbered-by-existing-patch · json-path-idempotency-not-race-safe · depth-3-nesting-via-effective-org · s5-dual-write-adds-fourth-divergence                                              |
| qa-verification-lead  | Opus       | needs-work                    | 0.82  | idempotency-has-no-db-backing-concurrent-replay-unprovable · suspension-not-enforced-at-mcp-auth-chokepoint · track-a-evidence-not-fully-revocable-on-offboard                                       |
| devils-advocate-judge | Opus       | needs-work (score **34/100**) | 0.80  | defer-mcp-provisioning-scope · offboard-must-enforce-or-not-claim · drop-reconcile-claim-or-migrate-existing · fold-into-existing-org-post · idempotency-needs-constraint                            |
| ops-cost-realist      | Sonnet     | needs-work                    | 0.75  | no-idempotency-guard-on-client-create · budget-enforcement-defaults-to-log-only-fail-open · auditlog-missing-org-column-for-provisioning-trail · team-invitation-email-send-ambiguous-for-day-1      |
| security-reviewer     | Opus       | needs-work                    | 0.83  | derive-parent-from-authenticated-principal · tier-gate-provisioning-mcp-scope · org-lock-the-invite-evidence · make-suspend-actually-cut-the-data-plane · provenance-out-of-client-writable-settings |

**Divergence (6/6 contracts):** verdict*split = **0.0** (unanimous needs-work; no pass, no fail). fix_overlap = **0.00 lexical / ≈0.15 canonical** (seats slug independently; canonical topics: IDEMPOTENCY-CONSTRAINT in 4 seats, SUSPEND-ENFORCEMENT in 3, PROVENANCE-TAMPER 2, PARENT-DERIVATION 2, MEMBERSHIP-DIVERGENCE 2, SPECULATIVE-MCP 2, INVITE-DELIVERY 2 [opposed, reconciled S4'], EVIDENCE 2, singletons: DUP-CHECK, CONTRACT-FIRST, CREATE-CORE, BUDGET, AUDIT). **Ramp decision:** split = 0 with non-pass verdicts → \_unanimous criticism* rule: fold ALL must_fix, synthesize, **no round 2**. **Hard floor:** not triggered (security verdict is needs-work, not fail). One seat-evidence correction by the author: PM cited `tenant-resolver.ts:86` as live suspension enforcement; verified dead on live paths (resolver imported by zero `app/` routes; root middleware disabled) — which independently confirms the security/judge/QA suspend findings.

## 8. Judge challenge

Judge score **34/100** as-sketched. Every judge must*fix is folded into §5 (see bracketed folds) and §15 makes them mandatory. The judge's strongest challenge — *"is this premature given no CRM caller exists?"\_ — is answered by REDUCING v1 to the brand-admin-JWT path + contract fixture (S3'/S10'): the human flow has a user today (Phill/brand admins onboarding UG-CRM clients); the machine flow is deferred until a caller exists. ### 8b. Adversarial verify pass (T3-mandatory; non-author model, opus-adversary style)

Verdict **synthesis-needs-amendment @0.8** — all amendments folded before finalisation:

- Claim "slug idempotency race-safe + rename hole closed" **partially flipped**: derivation embedded the mutable brand slug; soft-deleted orgs retain slugs → replay could return a dead org. → S2'/§11 amended (immutable `parentOrgId` derivation; status-checked replay; tombstone 409). Criterion 17 added.
- Claim "parent = session org, reject-if-child" **survived** (invite/accept 409-guards home-pointer relocation).
- Claim "org-locked evidence preserves Track A" **survived, caveated**: `hasInviteEvidence` has 5 consumers (3 OAuth login gates + 2 self-provision sites); tightening must be parameterized at the 2 sites only. → S4' amended; criterion 18 added.
- Claim "offboard cuts the client off completely" **flipped**: chokepoints missed the ~144-route `getEffectiveOrganizationId` publish/generation plane, collaborators' home pointers, live sessions, and org-agnostic image gen. → S6' amended (chokepoint (f), all-member pointers, residuals named); §4/§12 reworded; criterion 5 amended.
- Claim "OrgBudgetPolicy(enforce) bounds client spend" **partially flipped**: enforcer covers generate-content + calendar only. → S7'/§4 reworded to honest coverage; enforcement expansion is a §17 follow-up.

Downgrades honoured: "completely cut off" and "cannot spend unboundedly" are no longer claimed; both are stated as scoped guarantees + named residuals.

## 9. Proposed solution (v1)

1. `lib/tenancy/provision-client-org.ts` — `provisionClientOrg({ parentOrgId, externalRef, clientName, ownerEmail, plan:'free' })`:
   deterministic slug `${parentSlug}-c-${slugHash(externalRef)}`; single `$transaction`: create child org (`parentOrgId`, limits, settings incl. best-effort `settings.provisioning`), `ensureDefaultRoles`, create `TeamInvitation` (org-bound, role 'owner'), write `OrgBudgetPolicy(enforce)`, audit `provisioning.created`. On P2002 (slug): load existing child, audit `provisioning.replay_detected`, return it (idempotent replay).
2. `app/api/command-centre/clients/route.ts` — POST (provision; brand-admin JWT; parent = authenticated session org via `withAuth` clientId, rejected if that org is itself a child; NO parent parameter accepted), GET (children list, copying `/api/organisations/children` scoping verbatim).
3. `app/api/command-centre/clients/[id]/offboard/route.ts` — POST: verify child belongs to caller's brand; suspend + revoke keys + flip invitation + clear home pointers + audit (S6' chokepoints a–e).
4. Chokepoint edits: `app/api/mcp/auth.ts` (org-status gate), `lib/auth/with-auth.ts` (suspended-org resolution refusal).
5. Contract fixture + tests (§13/§14).

## 10. UX

Brand-admin flow (command-centre UI is a later slice; v1 is API-first per Mission-Control decision): provision → response carries child org summary + invitation state (+ duplicate-name advisory); replay returns the same child with `replayed: true`; offboard returns the enforced-state summary. Client-owner flow: branded invite email (when env-gated on) → signup passes Track-A gate via the invitation → lands in the client org. Empty/error states: unknown parent (403 — never 404-leak sibling existence), depth violation (422), suspended child access (403 `TENANT_SUSPENDED` shape from the existing middleware contract).

## 11. Technical notes

- Deterministic slug: `c-` + 12-char base36 of sha-256(`parentOrgId:externalRef`) — **immutable inputs only** (org id, never the renameable brand slug), collision-negligible at portfolio scale. Org PATCH additionally rejects slug changes for orgs carrying `settings.provisioning` (one-line guard) so a provisioned child's own slug cannot drift from its derivation. Tombstone limit: soft-deleted orgs retain their slug under the full unique index — replay against a deleted child 409s (S2'); the founder-packet unique constraint retires this properly.
- `settings.provisioning` is display-only AND write-protected: the org PATCH (`app/api/organizations/[orgId]/route.ts:281-285`, which today full-replaces `settings` with arbitrary keys) treats `provisioning` as a **reserved key** — stripped from client writes and re-applied server-side (deep-merge). Nothing tenancy-governing depends on `settings`: idempotency = slug index; offboard lookups = `id`/`parentOrgId` columns (not PATCHable). [folds security `provenance-out-of-client-writable-settings`, architect `provenance-clobbered-by-existing-patch`]
- Brand-org bootstrap: manual runbook artifact `docs/runbooks/brand-org-bootstrap.md` (who creates brand parents; externalRef namespace convention = CRM record id, stable, never email).
- No new env vars required except the invite-email gate; no schema change; no RLS reliance (see §12).

## 12. Security (finalised against the security seat's contract, needs-work @0.83 — no hard-floor fail)

- **Cross-brand provisioning closed**: parent derives from the authenticated principal's session org only (children-route pattern); no request parameter selects the parent; child-org callers rejected. `getEffectiveOrganizationId` is **forbidden** for provisioning authz (returns `activeOrganizationId` without re-verifying `BusinessOwnership.isActive` — stale-ownership gap at `business-scope.ts:49-55`).
- **Invite-minting oracle closed**: provisioning invitations are org-locked (non-null `organizationId`) and excluded from generic self-provisioning evidence — Track A's fail-closed gate is preserved, not parlayed.
- **Suspend cuts BOTH planes**: human sessions (`withAuth` status gate) and machine keys (`resolveOrgFromBearer` status gate + total idempotent key revocation + no minting for suspended orgs).
- **Provenance tamper-proofing**: `settings.provisioning` reserved/server-owned; nothing tenancy-governing lives in client-writable state.
- **MCP scope tiering at mint**: child orgs restricted to read/draft scopes; `provisioning`/wildcard not mintable in v1; provisioning-scoped keys (future) require expiry + per-use audit.
- Tenant isolation is enforced in the app query layer — **never assumed from RLS** (adversarial baseline: 18/234 tables secure); a cross-tenant adversarial test is mandatory (§13).

## 13. Verification plan (sandbox-policy: named isolation, prod untouched)

Claim classes per proof-discipline:

- **PROVEN (unit, mocked prisma; house patterns `tests/unit/auth/invite-gate-routes.test.ts`, `tests/helpers/mock-request.ts`):** route auth (401/403/422), explicit-parent validation + depth-2 cap, sequential idempotency (P2002 → replay path), offboard writes all five chokepoint effects, budget policy row written with `enforce`, audit events emitted, contract fixture shape.
- **INTEGRATION (Docker sandbox only: `npm run sandbox:up` → `jest.integration.cjs` → `sandbox:down`; `sandbox-guard.ts` hard-fails unless `DATABASE_URL` contains `:5499/` — prod structurally unreachable):** concurrent provision race `Promise.all([provision(ref), provision(ref)])` on a shared pool asserting exactly one child (green only because the slug unique index arbitrates); end-to-end suspension cut-off; TeamInvitation evidence round-trip (create satisfies `hasInviteEvidence` → offboard flips it false); cross-tenant adversarial read (child key cannot read sibling/parent data).
- **ASSUMED (cannot verify without founder action — stated, not hidden):** DB-level `(parentOrgId, externalRef)` uniqueness (until the founder packet lands, idempotency rests on the slug index + the no-slug-rename guard); prod RLS posture.

## 14. Loop & stress testing

Sandbox lane: (a) 50-child fan-out under one brand — depth cap holds, no sibling leakage in list; (b) replay burst (20× same externalRef) — exactly one child, 19 `replay_detected` audits; (c) transitive-suspension scan — children of a suspended parent are treated as cut off; (d) offboard/re-provision cycle — evidence revoked then re-issued cleanly.

## 15. Acceptance criteria (mandatory for 100/100)

Every bench must_fix maps to a criterion; security-seat criteria appended on landing.

1. Idempotency is DB-arbitrated (slug unique index; P2002 replay path) with the slug-rename guard; concurrent-race integration test green in sandbox. [architect/qa/judge/ops]
2. `settings.provisioning` is not load-bearing for idempotency; org PATCH cannot corrupt provisioning identity. [architect]
3. Parent is explicitly resolved + `parentOrgId === null` validated; no path derives the parent from `activeOrganizationId`. [architect]
4. No MCP `provisioning` scope in v1; contract fixture + contract test stand in for the CRM caller. [judge/pm]
5. Offboard enforces at all SIX chokepoints (keys revoked idempotently, MCP auth status-gated, withAuth status-gated, ALL member home pointers cleared, invitation flipped, `getEffectiveOrganizationId` refuses suspended orgs) — integration tests assert each plane separately, including a non-owner collaborator attempting `social/post` against a suspended org; the two v1 residuals (live sessions, org-agnostic image gen) are asserted as DOCUMENTED, not silently passed. [judge/qa/security; adversary-amended]
6. Provisioning evidence is TeamInvitation-only (never InviteCode); the offboard test asserts the provisioning invitation no longer contributes to evidence (scoped query assertion — global `hasInviteEvidence` false only when no other recent invite exists for that email, which the test controls). [qa; adversary-amended]
7. Invite email ships env-gated (off by default; send path exercised in sandbox against a mail stub). [pm/ops reconciliation]
8. Child orgs get `OrgBudgetPolicy(enforcementMode='enforce')` with explicit ceilings at provision time — test asserts no log-only default survives. [ops]
9. `provisioning.created` / `replay_detected` / `offboarded` audit events queryable via AuditLog. [ops]
10. Membership shape mirrors `invite/accept` (home pointer + TeamMember + roles); no new-routes-only canonical helper; "reconcile" removed from claims. [architect/judge]
11. Duplicate-business advisory returned on BusinessOwnership name collision. [pm]
12. Parent org derives from the authenticated principal's session org only; no request parameter can select it; child-org and foreign-brand callers proven rejected by test (provision AND list). [security]
13. Provisioning `TeamInvitation` is org-locked (non-null organizationId) and does NOT satisfy self-provisioning evidence for any other org — proven by a test that a provisioned email cannot create an unrelated org through `onboarding/review` or `organizations` POST. [security]
14. MCP key mint enforces the scope-tier allow-list (child orgs read/draft only; no provisioning/wildcard scopes mintable) — regression test on the mint route. [security]
15. `settings.provisioning` is a reserved, non-client-writable key on the org PATCH; test proves a client admin PATCH cannot alter or erase it. [security/architect]
16. `getEffectiveOrganizationId` is not used for provisioning/offboard **authz** decisions (it gains the suspended-org refusal but never selects a provisioning parent). [security/architect]
17. Child slug derives from `parentOrgId` (immutable) + `externalRef` only; replay against a soft-deleted child returns 409; test proves a brand-slug rename does NOT change idempotency. [adversary]
18. The invite-gate tightening is parameterized at the 2 self-provisioning call sites only; regression tests prove all 3 OAuth login gates behave exactly as on main for org-locked invitations. [adversary/security]
19. Full gate green: tsc + jest unit + sandbox integration lane; zero regressions.

## 16. Goal command

```
/goal Build Track B v1 (client provisioning) per docs/specs/spm-track-b-client-provisioning.md: implement Slices 1–3 of §17 (provisionClientOrg core + command-centre clients POST/GET + offboard route + chokepoint gates + contract fixture + unit tests + sandbox integration suite), TDD throughout, in a worktree branch off current main; completion = every §15 criterion (1–19) satisfied with tests green (tsc + jest unit + Docker-sandbox integration lane at :5499 — never prod), PR opened with the §15 checklist mapped to test evidence; prod merge and the §17.4 founder packet remain owner-gated.
```

## 17. Implementation sequence

1. **Slice 1 (build now):** `provisionClientOrg` core + POST/GET clients routes + contract fixture + unit tests.
2. **Slice 2:** offboard route + the two chokepoint gates (MCP auth, withAuth) + unit tests.
3. **Slice 3:** sandbox integration suite (race, cut-off, evidence round-trip, cross-tenant).
4. **Founder packet (gated, sequenced, not blocking v1):** `external_ref` column + `@@unique([parentOrgId, external_ref])` (precedent shape `schema.prisma:3655`); AuditLog org column+index; hard-delete/purge policy; org-budget default policy flip.
5. **Deferred pending caller:** MCP `provisioning` scope + machine path (own mini-spec when the CRM integration starts; must carry the mint-time tier allow-list, expiry, and per-use audit from §12).
6. **Deferred (own spec):** true membership-resolution convergence across `withAuth` / `getEffectiveOrganizationId` / `getEffectiveQueryFilter`.
7. **Deferred (adversary-surfaced platform gaps, not Track-B-caused):** session-revocation infrastructure (suspend cannot kill live JWTs today); budget-enforcer expansion to image/video/voice generation (image gen runs `clientId=null`, video rides a separate quota).

## 18. Session-handoff seed

Track B /spm complete → spec at `docs/specs/spm-track-b-client-provisioning.md` (durable — the prior program spec was lost to conversation scrollback; this one is a file). Bench receipt §7 (T3, 6/6 unanimous needs-work, no round 2, no hard floor); adversary pass §8b (amendments folded). Build = Slices 1–3 of §17 via the §16 /goal; founder packet §17.4 queued; platform-gap follow-ups §17.7. Memory: `synthex-consumption-boundary`.

## 19. Final recommendation

**APPROVE BUILD — v1 as re-scoped (Slices 1–3), with §15 criteria 1–19 as the mandatory 100/100 completion contract for the build.** Honest basis: the bench was unanimously critical of the original sketch (judge scored it 34/100) and every must_fix from all six seats plus every adversary amendment is folded into the scope and criteria above — nothing was retired without evidence. No security hard-floor was triggered (security seat: needs-work @0.83, all findings folded). What this spec deliberately does NOT claim: complete session cut-off on suspend, unbounded-spend prevention across all generation surfaces, or tenant-model "reconciliation" — those are named residuals and sequenced follow-ups (§17.4–17.7), three of them founder-gated. The v1 that remains is small, evidence-anchored, reuses five existing proven mechanisms (§6), and is CI-provable end-to-end in the Docker sandbox lane without touching prod.
