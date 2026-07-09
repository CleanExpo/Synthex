# SPM Spec — CARSI LinkedIn Go-Live: OAuth + Publishing Unblock (H5 Campaign)

**Date:** 2026-07-09 · **Author:** /spm session · **Status:** Spec (no build authorised by this document)
**Repo:** CleanExpo/Synthex (`main` @ `f6488b1ca`, clean) · **Campaign pack:** `docs/marketing-agency/campaigns/carsi-h5-launch-2026-07-08/`

---

## 1. Task

Unblock publishing of the 12 LinkedIn posts in the CARSI H5 launch campaign (35-post pack, 32
scheduler payloads: 12 LinkedIn + 10 Facebook + 10 Instagram) so they publish **as the CARSI
company page** (`linkedin.com/company/carsiaus`) on their schedule. Meta (FB/IG) is out of scope
here — separately blocked on Meta-console owner tasks.

## 2. Project context

- [VERIFIED] Campaign pack merged on Synthex `main` (PRs #634/#635/#636). `scheduler-payloads.json`
  has 12 LinkedIn entries (11 `scheduled` + LI-12 now `ready` — video hold cleared), 5 carry
  Cloudinary `mediaUrls`.
- [VERIFIED] Both content-side gates in `publishing-handoff.md` have passed:
  course URL returns 200 with real title (checked 2026-07-09 13:25 AEST); LI-12 video URL wired (#635/#636).
- [VERIFIED] Channel status: CARSI LinkedIn = `blocked: oauth_connection_missing` (a stale inactive
  connection exists; reconnect replaces it — not a blocker).
- [VERIFIED] The Synthex LinkedIn developer app credentials exist in the platform-credentials store
  (`oauthAppCredentials=True` per audit) — no app setup needed.
- [VERIFIED] First scheduled slot `2026-07-09T09:00+10:00` is already past; the scheduler rejects
  past `scheduledAt` (`app/api/scheduler/posts/route.ts:65-70`).

## 3. Problem

Three publishing gates (per `docs/marketing-agency/carsi-linkedin-go-live.md`, all claims
re-verified against source this session) plus two code defects:

| #   | Blocker                                        | Evidence                                                                                                                                                                                                                 | Nature                   |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| G1  | No active CARSI LinkedIn connection            | audit `oauth_connection_missing`; publish route requires connection (`app/api/social/post/route.ts:289`)                                                                                                                 | Founder action           |
| G2  | Org publishing scope not granted               | connect flow only requests `w_organization_social` when `LINKEDIN_ORGANIZATION_SOCIAL_ENABLED=true` (`app/api/auth/oauth/[platform]/route.ts:145-150`) AND the LinkedIn app is approved for the Community Management API | Config + external review |
| G3  | Connection would post to the **personal feed** | callback stores `profileId = data.sub` (non-numeric OpenID member id, `app/api/auth/callback/[platform]/route.ts:522,890`); author URN goes org only if `/^\d+$/` passes (`lib/social/linkedin-service.ts:601-611`)      | **Code gap**             |
| D1  | Images silently dropped on LinkedIn            | `LinkedInService.createPost` handles only `linkUrl` (ARTICLE); `content.mediaUrls` is never read (`lib/social/linkedin-service.ts:591-660`) — affects the 5 image posts                                                  | **Code defect**          |
| D2  | No loader from pack → scheduler                | payload uses `suggestedScheduleAt` + top-level `mediaUrls`; API wants `scheduledAt` + `metadata.images` (`createPostSchema`, route.ts:62-88); past dates rejected; schedule needs re-anchoring                           | **Missing tool**         |

## 4. Desired outcome

All 12 LinkedIn posts queued in the Synthex scheduler with correct future dates and media; the
cron (`/api/cron/publish-scheduled`) publishes each **as the CARSI organisation** with its image;
every publish returns `success: true` + a `url` visible on `linkedin.com/company/carsiaus`;
receipts recorded back into the campaign pack.

## 5. Scope

**In scope (engineering):**

1. **E1 — Org-id capture (fixes G3).** Extend the LinkedIn OAuth callback: when the granted scope
   includes `w_organization_social`, fetch the member's ADMINISTRATOR/APPROVED organisations via
   LinkedIn `organizationAcls` and store the **numeric organisation id** as `profileId` with
   `accountType: 'company'`. If zero or multiple orgs, keep member id + surface a clear
   "select/enter organisation" remediation (see E2). Never guess the id.
2. **E2 — Deterministic override (backstop for E1).** Small authenticated org-owner-scoped
   endpoint/script to set an existing connection's `profileId` (numeric org id, validated
   `/^\d+$/`) + `accountType`. This is the guaranteed path if `organizationAcls` scope behaviour
   differs ([UNCONFIRMED] whether `w_organization_social` alone can read organizationAcls — resolve
   against LinkedIn docs during build; E2 removes the risk either way).
3. **E3 — LinkedIn image publishing (fixes D1).** Implement image upload in
   `LinkedInService.createPost` for `content.mediaUrls` (register upload → PUT binary from
   Cloudinary URL → attach asset URN, `shareMediaCategory: 'IMAGE'`). [UNCONFIRMED] exact endpoint
   generation (legacy `/v2/assets` registerUpload vs versioned `/rest/images`) — pick per LinkedIn
   docs at build time; must work with organisation author URNs.
4. **E4 — Campaign loader (fixes D2).** Script (`scripts/load-campaign-scheduler-payloads.ts`,
   dry-run default) that reads a campaign `scheduler-payloads.json`, filters by platform + status
   (skip `hold`), maps `suggestedScheduleAt→scheduledAt` and `mediaUrls→metadata.images`,
   **re-anchors past dates** (preserve cadence relative to go-live day), and POSTs each to
   `/api/scheduler/posts` as the CARSI org owner. Prints a full plan before any POST.
5. **E5 — Readiness-audit truthfulness (small).** `scripts/social-launch-readiness.ts` still
   reports `owned_profile_allowlist_missing` for LinkedIn, a blocker the live route no longer
   enforces (post-#372/#374/#382 auto-enable). Align the audit so CARSI LinkedIn can flip to
   `ready` and founders aren't chasing a phantom blocker.

**Founder-only (not buildable; sequence first — external long-poles):**

- F1. Confirm Phill's personal LinkedIn is Super/Content admin of `company/carsiaus`
  (orphaned-page recovery is multi-day — check immediately).
- F2. LinkedIn app review approval for Community Management API (`w_organization_social`) if not
  already granted ([UNCONFIRMED] current approval state — check the LinkedIn developer console).
- F3. Set `LINKEDIN_ORGANIZATION_SOCIAL_ENABLED=true` in Vercel production + redeploy (agent can
  execute via Vercel MCP with founder go — prod config change, founder-gated).
- F4. Click Connect in Synthex integrations as CARSI org owner, authorising with the admin account
  (AFTER F2+F3, else the connection stores only `w_member_social` and must be redone).
- F5. Record approval + asset rights per `docs/marketing-agency/CONSENT-AND-STORY-EVIDENCE-POLICY.md`
  before the first external post.

**Out of scope:** Meta/Facebook/Instagram unblock (separate console tasks); blog/email owned
channels (already `Ready`, human review only); any change to campaign copy (banned-phrase sweep
already passed, 0 hits); Synthex billing/GTM (internal tool).

## 6. Existing capability (do not rebuild)

- [VERIFIED] Publish route + owned-page policy complete and correctly gated
  (`app/api/social/post/route.ts`, `lib/social/owned-page-policy.ts` — auto-enables org-scoped
  LinkedIn connections, no allowlist entry needed).
- [VERIFIED] Scheduler CRUD + cron publisher exist (`app/api/scheduler/posts`,
  `app/api/cron/publish-scheduled` — passes `metadata.images` through as `mediaUrls`).
- [VERIFIED] OAuth connect/callback flow + HMAC state signing exist; only the LinkedIn org-id
  capture is missing.
- [VERIFIED] LinkedIn ARTICLE (link) posting and org-URN selection logic already implemented.
- [VERIFIED] Readiness audit script exists (`scripts/social-launch-readiness.ts`).

## 7. Specialist board (15+ yr lenses)

- **Product:** the fastest founder-visible win is E2+E4 (manual org id + loader) — E1/E3 improve
  robustness/quality but E2 alone satisfies G3. Ship value in that order.
- **Architect:** E1 belongs in the callback (single source of connection truth); do not patch the
  publish path to "look up the org at post time" — that adds a per-post API call and hides state.
- **UX:** connect flow must tell the founder _which_ page it will post as; after F4 show the
  resolved organisation name/id on the integration card. Failure copy must name the gate
  (scope missing vs org id missing) — silent blocks are the current pain.
- **Security:** E2 must be org-owner-scoped + Zod-validated (`/^\d+$/`), never expose tokens;
  image fetch (E3) must only fetch from the post's stored URLs (Cloudinary), no arbitrary URL
  fetch from request input at publish time; keep secrets in Vercel only.
- **QA:** every gate has a scriptable probe — unit-test URN selection, callback org mapping, loader
  date re-anchoring (past-date rejection is a live trap); e2e = one real shadow post before the
  12-post load.
- **Devil's advocate:** biggest schedule risk is not code — it's F1 (orphaned page) and F2 (app
  review lead time). If F2 is not already approved, no engineering sequencing matters; check both
  TODAY. Also: could we skip E3 and post text-only? No — 5 posts were designed around visuals and
  silently degrading founder-approved creative is the exact "silent block" pattern this campaign
  keeps hitting.

## 8. Judge challenge

- Rebuild risk: none — all five items fill verified gaps; nothing duplicates existing capability (§6).
- Cheapest alternative considered: manual-everything (founder edits DB, posts by hand) — rejected:
  12 posts over 28 days by hand defeats the scheduler and leaves G3/D1 broken for every future
  campaign.
- Scope reduction considered: drop E1, keep only E2 (manual id) — viable minimum; E1 retained
  because every future LinkedIn connection hits G3 otherwise. E5 is 30 minutes and kills a
  recurring founder confusion; keep.
- **Score: 100/100 for the engineering scope as bounded above** — every mandatory criterion
  (problem evidence, no-rebuild check, security, verification plan, acceptance criteria, rollback)
  is satisfied. **Verdict: APPROVE BUILD (E1–E5).** The _campaign go-live_ itself remains gated on
  F1–F5, which no build can satisfy — the spec makes that dependency explicit rather than hiding it.

## 9. Proposed solution (summary)

Build E1–E5 in Synthex behind existing gates; founder executes F1–F5 in parallel (F1/F2 first —
long-poles). Then: shadow post → verify on company page → run loader for the 12 posts → store
receipts in the campaign pack.

## 10. UX

- Integration card shows connected LinkedIn **organisation** (name + numeric id) when
  `accountType='company'`; personal-only connection shows a "will not post as company page" warning
  with the remediation link to the runbook.
- Loader is CLI, dry-run by default, prints per-post table (id, date old→new, media count) before
  `--execute`.

## 11. Technical

- **E1:** `app/api/auth/callback/[platform]/route.ts` — LinkedIn branch: after userinfo, if scope
  contains `w_organization_social`, GET `organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED`
  (projection to org id). Exactly one org → store numeric id + `accountType:'company'`. Else keep
  member behaviour + log a structured remediation event. No new deps.
- **E2:** `app/api/social/connections/[id]/organization` PATCH (org-owner RBAC, Zod
  `{ organizationProfileId: z.string().regex(/^\d+$/) }`) or an authenticated script — builder's
  choice, endpoint preferred (usable from UI later).
- **E3:** extend `LinkedInService.createPost`: fetch first `mediaUrls` binary (server-side, from
  stored post metadata only), register upload with owner = the same author URN, PUT bytes, attach
  asset URN, `shareMediaCategory:'IMAGE'`. Multi-image: LinkedIn UGC supports arrays — v1 may ship
  first-image-only if docs make multi-image ambiguous; state whichever is shipped.
- **E4:** new script; maps fields; re-anchor rule: `newDate = date + ceil((now+2h − firstPastDate)/1d) days`
  applied uniformly so relative cadence is preserved; refuses to run if any post would land in the past.
- **E5:** update the audit's LinkedIn blocker derivation to mirror
  `evaluateOwnedConnectionPublishGate` (import it, don't re-implement).
- Env: no new vars. Uses existing `LINKEDIN_ORGANIZATION_SOCIAL_ENABLED`.

## 12. Security

- No token/secret ever logged or returned; E2 validates + authorises via existing org-owner RBAC
  (`getEffectiveOrganizationId` scoping, per repo rule).
- E3 fetches only URLs already persisted in post metadata (no request-time arbitrary URL input);
  restrict to https Cloudinary hosts as defence-in-depth.
- Zod on all new/changed POST/PATCH bodies (repo rule). No new packages.

## 13. Verification

- Unit: URN selection (numeric vs member id), callback org mapping (0/1/N orgs), loader mapping +
  re-anchoring (past-date case), audit gate parity.
- Gauntlet: `npm run type-check && npm run lint && npm test` — paste real outputs (Fabel evidence
  standard; a subagent's green is [UNCONFIRMED] until re-run).
- Live: `npx tsx scripts/social-launch-readiness.ts --stdout` → CARSI LinkedIn `ready`; **shadow
  post** via `POST /api/social/post` `platforms:['linkedin']` → `success:true` + URL on
  `company/carsiaus` (screenshot). Acceptance is the publish response, not the audit.

## 14. Loop + stress testing

- Re-run loader dry-run against the pack after every founder merge to the pack (sibling-edit risk).
- Cron failure path: force one post with a dead media URL in staging → expect `failed` status +
  retry bookkeeping, not a crash.
- Token expiry mid-campaign (28-day window): verify refresh path on the stored connection; if
  refresh unsupported, document reconnect procedure in the pack.

## 15. Acceptance criteria

1. CARSI LinkedIn connection active with numeric org `profileId` + `accountType:'company'` [proof: DB/read API].
2. Readiness audit shows CARSI LinkedIn `ready` (no phantom allowlist blocker) [proof: script stdout].
3. Shadow post visible on `linkedin.com/company/carsiaus`, not the personal feed [proof: URL + screenshot].
4. 12 campaign posts queued with future dates preserving cadence; LI-12 included [proof: scheduler list output].
5. Image posts publish with their image attached [proof: platform receipt + visual check on ≥1 image post].
6. All receipts (`postId`, `url`) recorded into the campaign pack [proof: committed update].
7. Gauntlet green on the merged tree [proof: pasted outputs].

## 16. Goal command

```
/goal Implement spec docs/specs/2026-07-09-carsi-linkedin-golive-spec.md items E1–E5 in Synthex:
LinkedIn callback org-id capture, org-id override endpoint, LinkedIn image publishing, campaign
scheduler loader (dry-run default), readiness-audit gate parity. Completion = acceptance criteria
1,2,4 satisfiable in code + all unit tests + gauntlet green + PR(s) CI-green on CleanExpo/Synthex.
Criteria 3,5,6 execute only after founder gates F1–F5 (do not fake them; stop and hand off if blocked).
```

## 17. Implementation sequence

1. TODAY, founder, parallel: F1 (admin check — orphan risk) + F2 (app-review state) — the long-poles.
2. E2 + E4 (deterministic minimum) → PR.
3. E1 + E5 → PR. 4. E3 (image upload) → PR.
4. F3 (env flag + redeploy, founder go) → F4 (connect) → E2 if E1 didn't auto-resolve the org id.
5. Shadow post → criteria 3 → run E4 loader `--execute` → criteria 4–6.

## 18. Session-handoff seed

- Spec: `docs/specs/2026-07-09-carsi-linkedin-golive-spec.md` (this file, uncommitted on `main` @ `f6488b1ca`).
- Evidence anchors: `carsi-linkedin-go-live.md`, `publishing-handoff.md`,
  `app/api/auth/callback/[platform]/route.ts:522,890`, `lib/social/linkedin-service.ts:601-660`,
  `app/api/scheduler/posts/route.ts:62-88`, `app/api/cron/publish-scheduled/route.ts:534-541`.
- Open questions for founder: F1 admin status? F2 Community Management API approval state?
  Merge-on-green authority for the E-series PRs (per-session, must be re-granted)?

## 19. Final recommendation

**APPROVE BUILD for E1–E5** (judge 100/100 on the bounded engineering scope). Campaign go-live
additionally requires founder gates F1–F5; F1/F2 are the schedule-critical external long-poles and
should be checked before any code is written. The deterministic minimum that unblocks publishing is
**F1→F4 + E2 + E4**; E1/E3/E5 make it correct-by-default and media-complete.
