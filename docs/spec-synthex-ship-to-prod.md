# SPM Spec — Synthex: reconcile connections & ship to production

`/spm` output · 2026-07-14 · read-only spec (no build performed except the founder-authorized Stripe apply, logged in §17) · source map: `docs/wayfinder-synthex-to-prod.md`

---

## 1. Task
Reconcile Synthex's four connection classes and reach a defensible production-ready state: fix billing config, wire the launch-critical social publishers (Meta/X/LinkedIn), close the real launch-blocker gap, and define how each connection is *proven* live.

## 2. Project context
Synthex (synthex.social) is a multi-tenant social-content generation + publishing platform, **already live in prod** on Vercel (`unite-group/synthex`), prod Supabase `znyjoyjsvjotlzjppzal`. Repo D:\Synthex, branch `fix/f2-edge-hardening`. Most connections have been wired for months — this is **finish-and-prove, not build-from-zero**.

## 3. Problem
The destination as originally framed — "all four connection classes verified live on prod, feature-complete" — is **partly unprovable by the agent and partly the wrong vehicle** (judge score 58/100). Concrete defects exist, but they are narrower and more code-specific than "wire the connections":
- **Billing:** 3 price-ID env vars were missing in prod (now fixed, §17). But the Starter/Enterprise self-serve paths appear orphaned (no live page imports them), and self-serve pricing was deliberately repositioned to pilot/contact access (PR #274).
- **Social:** the publisher *machinery* exists, but per-platform **code defects** block actual publishing (Meta Graph API versions expired; Facebook aliased to Instagram; X has no token refresh + a cross-tenant legacy route; LinkedIn scope contradiction + stale API version). Plus **external review gates** (Meta Business Verification/App Review; LinkedIn Community Management API) that no code change can shortcut.
- **Verification:** the agent **cannot** verify live billing or publishing from this box (write-only Stripe key; founder-gated OAuth). Any agent-asserted GREEN there would be assumed, not proven.

## 4. Desired outcome (re-scoped)
A **launch-blocker set that is closeable and honest**, with live-verify reassigned to the founder where the agent cannot prove it:
1. Billing config correct (done) + founder decision on whether self-serve Starter/Enterprise tiers ship at all.
2. **X/Twitter** made genuinely publish-capable (the one publisher with no external-review gate) — pending the paid-tier decision.
3. **Meta + LinkedIn** code brought current + external reviews *tracked* (submitted, re-verify on approval) — **not** treated as ship-date blockers.
4. Per-platform connect entrypoints gated by approval status (no broken OAuth buttons).
5. A verification runbook with a named sandbox and founder-executed live smokes.

## 5. Scope
**In:** Stripe price-ID reconciliation (done); social publisher code fixes for Meta/X/LinkedIn; per-platform connect gating; verification runbook + sandbox policy; founder provisioning checklist.
**Out (explicit):** TikTok, Pinterest, Reddit, Threads publishers (routes exist, no creds, founder never named them — dead-code, leave disabled); "feature-complete" as an open-ended gate; re-architecting the OAuth `[platform]` abstraction (it generalizes correctly — architect seat).

## 6. Existing capability (do not rebuild)
- Generic OAuth flow `app/api/auth/oauth/[platform]` → `app/api/auth/callback/[platform]` — **generalizes to Meta/X/LinkedIn already** (architect). Google+YouTube fully wired.
- Publisher services exist: `lib/social/{instagram,linkedin,twitter-sync}-service.ts`, `createPlatformService` factory (`lib/social/index.ts`) is the single chokepoint.
- Token encryption at rest (`encryptField`), org-scoped connections, webhook signature verification, HMAC OAuth-state — all present (§12).
- Verification substrate: `synthex-test` docker profile (`:5499`/`:6399`, tmpfs, `sandbox-guard.ts`); `scripts/verify-deployment.js` (SHA drift), `scripts/verify/deploy-readiness.ts`, `scripts/social-launch-readiness.ts`, prior MCP verification runbook (commit c59bf346).

## 7. Specialist board (MOA bench receipt)
- **Tier: T3** — axes F2 I2 N1 X2 S2 (sum 9); I=2 and S=2 each auto-promote. `leveling_version 1.0`, `board_version 1.0`.
- **Seats convened (7):** product-manager (Sonnet), architect (Opus), security-reviewer (Opus→**failed: cyber safeguard blocked the dispatch twice; ran as inline author pass, reduced assurance**), qa-verification-lead (Opus), devils-advocate-judge (Opus), domain-specialist/social (Sonnet), ops-cost-realist (Sonnet). Requested tiers are intent; actual serving model not observable.
- **Verdicts:** product-manager needs-work (0.72) · architect needs-work (0.82) · security inline-pass (all 5 controls present) · qa needs-work (0.80) · judge **needs-work, score 58/100** (0.82) · domain needs-work (0.80) · ops needs-work (0.78).
- **Divergence:** verdict_split 0.14 (6/7 needs-work) · fix_overlap high canonical (≥0.5 — billing-scope, social-external-review, agent-cannot-verify recur across seats). **Reading: convergent criticism → fold all must_fix, no round 2.**
- **Hard floor:** security seat degraded to inline (filter) → **reduced assurance → cannot reach a clean 100/100**; no security *fail* found (controls present). Judge 58 → **REDUCE SCOPE, not APPROVE BUILD.**

## 8. Judge challenge (score 58/100 — mandatory must_fix folded into §15)
- `unverifiable-success-criterion` — agent can't prove live billing/publishing; reassign to founder with evidence artifacts.
- `publishers-already-built-vehicle-oversized` — 90% founder provisioning, not a build.
- `launch-staked-on-external-app-review` — decouple launch from all-3-approved; launch on Google/YouTube + first-approved.
- `broken-connect-button-risk` — gate connect entrypoint by approval status.
- `billing-tiers-live-intent-unproven` — founder confirm IDs active + tiers meant to sell (IDs confirmed active by founder 2026-07-14; tier-exposure decision still open).
- `feature-complete-is-unbounded-goldplating` — replace with a closed launch-blocker set.

## 9. Proposed solution (value-ordered)
1. **Billing (near-done):** price IDs added + prod redeployed (§17); prod confirmed **LIVE mode** (`pk_live_`). **Founder decision:** do self-serve Starter/Enterprise tiers ship, or stay sales-assisted? If ship → also wire the orphaned `pricing-grid.tsx`/`checkout-button.tsx` into a page.
2. **X/Twitter (closeable this cycle):** (a) founder decision on X paid API tier (no free tier since 2026-02-06); (b) delete or kill-switch the cross-tenant legacy route `app/api/social/twitter/post/route.ts`; (c) add `TwitterSyncService.refreshToken()` so tokens survive past ~2h.
3. **Meta (code + external):** bump Graph API v18/v19 → current (v22+; v18 expired 2026-01-26, v19 expired 2026-05-21 — **FB/IG publishing likely broken now**); add a real `FacebookService` (stop aliasing to Instagram); founder starts Business Verification + App Review.
4. **LinkedIn (code + external):** reconcile the publish-gate scope contradiction (`w_organization_social` required vs `w_member_social` granted); bump `LinkedIn-Version` (202401 → current) and migrate `/ugcPosts` → `/rest/posts`; Community Management API review already submitted 2026-07-09 — re-verify on approval.
5. **Connect gating:** feature-gate each platform's connect entrypoint by approval status.

## 10. UX
Primary regression risk: exposing a Connect button that starts an OAuth flow to an unapproved app → user hits the platform's "app unavailable" error (worse than an absent button). Server ops already fail closed via `isConfigured()`. Gate the *entrypoint*, not just the backend.

## 11. Technical
- Chokepoint: `lib/social/index.ts createPlatformService` — add `FacebookService` + Twitter refresh behind the `PlatformService` contract; `/api/social/post`, `/api/cron/refresh-tokens`, `/api/cron/publish-scheduled` inherit fixes with no edits.
- Keep legacy per-platform routes disabled in prod (`SYNTHEX_ENABLE_LEGACY_DIRECT_SOCIAL_POSTS` unset) to avoid the plaintext-token divergence + the cross-tenant Twitter route.
- Confirm new platforms populate `refresh_token`+`expiresAt` so the token-health cron stops perpetual alerts.

## 12. Security (inline author pass — reduced assurance; dispatched Opus seat blocked by cyber filter)
All five protective controls confirmed **PRESENT** with evidence:
- OAuth tokens encrypted at rest — `encryptField(access_token/refresh_token)` `lib/supabase-server.ts:313-362`.
- Tenant isolation — connections scoped by `organizationId` w/ `businessOwnership` check `app/api/auth/connections/route.ts:71-195`.
- Stripe webhook signature verified before processing `app/api/webhooks/stripe/route.ts`.
- OAuth state HMAC-signed, unsigned rejected `app/api/auth/callback/[platform]/route.ts:292-303`.
- Secret hygiene — `.env*` gitignored, none in history; only `.env.example`/`.env.test` tracked.
No security *fail*; assurance is *reduced* (seat couldn't run) → this alone bars a clean 100/100 until an independent security pass runs.

## 13. Verification plan (per connection class)
- **env/auth:** unauth→401 probe (`verify-deployment.js`) + authed JWT round-trip→200 org-scoped read via a seeded verification user.
- **Stripe:** per tier, drive the **real prod checkout route** (server holds the key) → assert a live Checkout Session mints with correct amount/currency/interval, placeholder-rejection does NOT fire; **STOP before card entry — no completion, zero charge.** Webhook: `stripe trigger` test event → confirm signature accepted. (Founder-executed — agent cannot hold the live key.)
- **Social (per platform):** OAuth connect round-trip (active connection + `resolvePlatformAccessToken`) + real publish smoke to a **named throwaway account** → capture post ID → read back by ID → delete. (Founder-executed.)
- **MCP:** mint scoped key → `tools/list` on `/api/mcp/mcp` → one non-mutating `tools/call` → assert one out-of-scope tool denied (reuse c59bf346).

## 14. Sandbox policy (§13 isolation — named)
Data-mutating verification runs ONLY in the **`synthex-test`** docker profile (`deployment/docker-compose.test.yml`, ephemeral pgvector `:5499` + redis `:6399`, tmpfs, hard-guarded by `tests/integration/setup/sandbox-guard.ts`). Prod Supabase `znyjoyjsvjotlzjppzal` receives **only** non-mutating probes + one seeded/tagged `verification` org/user + throwaway external social posts (deleted after readback). Billing tables stay clean because **no Checkout Session is ever completed**. Every check gated on deployed-SHA == release-SHA (`EXPECTED_GIT_SHA`).

## 15. Acceptance criteria (mandatory — folded from all seats)
1. `AC-billing-config` ✅ done — 3 price IDs in prod + redeployed + prod LIVE mode confirmed.
2. `AC-billing-scope` — founder decision recorded: self-serve Starter/Enterprise ship or stay sales-assisted (if ship, orphaned components wired).
3. `AC-x-refresh` — `TwitterSyncService.refreshToken()` implemented; token survives > 2h (proven in `synthex-test`).
4. `AC-x-legacy-route` — cross-tenant `twitter/post` route deleted or kill-switched.
5. `AC-x-tier` — founder decision on X paid API tier before X goes live.
6. `AC-meta-version` — all Meta Graph calls on a supported version (≥ v22); FB/IG connect + token exchange succeed.
7. `AC-facebook-service` — dedicated `FacebookService`; FB Page text+media post works on the canonical path.
8. `AC-linkedin-scope` — publish gate accepts the granted scope; default LinkedIn connect can publish.
9. `AC-linkedin-version` — `LinkedIn-Version` current + `/rest/posts` migration.
10. `AC-connect-gating` — connect entrypoint feature-gated by per-platform approval status.
11. `AC-external-reviews` — Meta Business Verification + App Review submitted; LinkedIn Community Mgmt tracked (submitted 2026-07-09); launch NOT blocked on their approval.
12. `AC-verify-ledger` — an "agent-cannot-verify" ledger lists every founder-executed live check with its required evidence artifact; no GREEN asserted without it.
13. `AC-rollback` — one-line prod rollback runbook documented (`vercel rollback` / promote-previous).

Ceiling: **not APPROVE BUILD (100/100).** Judge 58 + reduced-assurance security → honest verdict **REDUCE SCOPE + APPROVE the re-scoped work above**, with external-review and founder-verify items owned by the founder.

## 16. Goal command
`/goal Synthex social-publisher launch fixes — implement AC-x-refresh, AC-x-legacy-route, AC-meta-version, AC-facebook-service, AC-linkedin-scope, AC-linkedin-version, AC-connect-gating; verify each in the synthex-test sandbox (:5499/:6399); NO prod deploy, NO live-key smoke (founder-owned per §13). Branch off main. Definition of done = §15 AC 3,4,6,7,8,9,10 proven green in sandbox + PR opened, not merged.`

## 17. Implementation sequence
0. **DONE (founder-authorized):** added `STRIPE_STARTER_PRICE_ID`, `STRIPE_ENTERPRISE_PRICE_ID`, `STRIPE_ENTERPRISE_TIER_PRICE_ID` to Vercel prod; redeployed (`synthex-l1jk7niwi`, aliased synthex.social); prod confirmed LIVE mode + 200.
1. Founder starts Meta Business Verification + confirms X API tier (long-lead, non-code).
2. Agent PR: Meta version bump + FacebookService (highest urgency — FB/IG likely broken now).
3. Agent PR: X refresh + legacy-route gate.
4. Agent PR: LinkedIn scope + version/endpoint.
5. Agent PR: connect-entrypoint gating.
6. Founder-executed verification runbook (live smokes) with evidence artifacts.

## 18. Session-handoff seed
Stripe fix APPLIED+LIVE (LIVE mode, synthex.social 200). Bench T3 done, judge 58 → re-scoped. Next: agent code PRs #2–5 above (all sandbox-verified, no prod deploy). Founder owns: X tier, Meta/LinkedIn reviews, self-serve tier decision, live smokes. Map: `docs/wayfinder-synthex-to-prod.md`. Security: controls present, needs one independent pass (filter blocked the dispatched seat).

## 19. Final recommendation
**REDUCE SCOPE and proceed.** The original "verify all connections live on prod / feature-complete" is not agent-provable and over-scoped. The real, valuable, closeable work is a set of **social-publisher code fixes** (Meta version + FacebookService are urgent — FB/IG publishing is likely broken *now*), plus honest reassignment of live-verification to the founder. Billing config is fixed and safe. Do not gate launch on external app reviews.

**SPM spec complete. Next safe action:** run the §16 `/goal` to implement the Meta-version + FacebookService fix first (agent-doable, sandbox-verified, no prod deploy), while the founder starts Meta Business Verification and the X API-tier decision.
