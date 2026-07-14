# Wayfinder Map — Synthex to Production (all connections verified)

`wayfinder:map` · charted 2026-07-14 · tracker: local-markdown (no Linear tracker configured for wayfinder; mirror to SYN board on request)

## Destination

Synthex (synthex.social) **fully shippable on production** — feature-complete, deploys green, with all four connection classes **verified live on the prod path** (proof-discipline, not "it's set"):
1. Env/auth connectors (Supabase, JWT/encryption/OAuth secrets) across local → preview → prod
2. Third-party integrations (OpenAI, Stripe, email, social OAuth publishers)
3. MCP surfaces
4. Product working end-to-end

Prove the playbook here, then cascade the same pattern to the other Unite-Group businesses in **later** efforts (out of scope for this map).

## Notes

- **Domain:** Synthex = a social-content generation + publishing platform. Prod domain `synthex.social`. Prod Supabase DB `znyjoyjsvjotlzjppzal`. Vercel project `unite-group/synthex` (CLI authed on this box, repo linked at D:\Synthex).
- **Reality reframe:** Synthex is NOT greenfield. It is a mature, already-live prod deploy (most env vars 329d old). The work is **audit → close gaps → verify live**, not build-from-zero.
- **Skills to consult:** `/nexus` (orchestrator framing — run inline, `disable-model-invocation`), `/spm` (build spec), `nexus-connector-doctor` (connector/env drift), `proof-discipline` (verify live before GREEN), `unite-group-ci-recovery` (ship mechanics).
- **Ship mechanics (from memory):** auto-merge disabled repo-wide; org policy green-gates merges; prod DB migration apply is a MANUAL founder's gate (CI does NOT auto-apply); classifier blocks prod DDL via MCP.
- **Gating:** creating developer-portal apps + entering credentials is founder work (prohibited for the agent). Prod billing env changes = business-critical, confirm before applying.

## Decisions so far

<!-- index — one line per closed ticket -->

- **T1 — Launch social publishers** → **Meta (FB+IG), X/Twitter, LinkedIn** are launch-critical (join already-wired Google+YouTube). TikTok + Pinterest deferred to post-launch. Callback pattern: `https://synthex.social/api/auth/callback/<platform>`.
- **T2 — Stripe price-ID drift** ✅ APPLIED 2026-07-14 (founder-confirmed IDs active). Added STRIPE_STARTER/ENTERPRISE/ENTERPRISE_TIER_PRICE_ID to Vercel prod + redeployed (synthex-l1jk7niwi, aliased synthex.social); prod confirmed **LIVE mode** (pk_live_) + 200. Caveat: Starter/Enterprise self-serve paths may be orphaned (PM seat) — founder tier-exposure decision open.
- **T3/T5 via /spm** → full T3 bench spec at `docs/spec-synthex-ship-to-prod.md`. Judge **58/100 → REDUCE SCOPE**. Key discovery: Meta FB/IG publishing **likely broken now** (Graph API v18/v19 expired). Re-scoped launch-blocker set = social-publisher CODE fixes (agent) + external reviews & live smokes (founder). "Feature-complete" dropped as a gate.
- **All 8 agent-doable code findings SHIPPED** 2026-07-14 → PR #761 (branch fix/social-publisher-launch, NOT merged — founder-gated). Meta version outage, FacebookService de-alias, X refresh+legacy-gate, LinkedIn scope+version, oauth/available endpoint, stripe price-ID healthcheck + rollback runbook. tsc + eslint clean.

## Frontier now (post-PR-761)
- **Founder-gated (queued):** merge PR #761 to prod · Meta Business Verification + App Review · X API paid-tier decision · LinkedIn Community Mgmt review (submitted 2026-07-09) · self-serve tier exposure · independent security pass.
- **Agent 1%s (next loop):** finish Meta version centralization (7 files) · token-health cron alerts for new platforms · Sentry DSN prod check · IG connect-flow API re-verify.
- **Fog:** cascade the proven playbook to the next Unite-Group business.

## Frontier — open decision tickets

### T1 — Which social publishers are in-scope for launch? ✅ CLOSED
**Resolved:** Meta (FB+IG), X/Twitter, LinkedIn launch-critical. TikTok + Pinterest post-launch. See Decisions so far.

### T1a — Provision + wire Meta (Facebook + Instagram) `wayfinder:task` (HITL — founder registers app; agent wires) — graduated from fog
Callback: `https://synthex.social/api/auth/callback/facebook` and `/api/auth/callback/instagram`. Meta app + Facebook/Instagram Login for Business + app review. Founder-gated (account + credentials).

### T1b — Provision + wire X/Twitter `wayfinder:task` (HITL) — graduated from fog
Callback: `https://synthex.social/api/auth/callback/twitter`. Twitter Developer Portal OAuth2 app. Founder-gated.

### T1c — Provision + wire LinkedIn `wayfinder:task` (HITL) — graduated from fog
Callback: `https://synthex.social/api/auth/callback/linkedin`. Scope `w_member_social` (needs LinkedIn app review). Founder-gated.

### T2 — Reconcile Stripe price-ID drift `wayfinder:task` (AFK-resolvable, founder-confirm to apply) — RESOLVABLE NOW
**Question:** Code SSOT (`lib/stripe/config.ts`) reads `STRIPE_STARTER_PRICE_ID`, `STRIPE_ENTERPRISE_PRICE_ID`, `STRIPE_ENTERPRISE_TIER_PRICE_ID` — **all three missing in prod** → checkout falls back to placeholder price IDs → Starter + Enterprise + per-additional-business checkout **fail at Stripe**. Real IDs exist in `.env.example`. Resolution = verify those 3 IDs are live/active in Stripe, then add to Vercel prod (founder-confirm, billing-critical), then smoke-test a checkout.

### T3 — Feature-completeness gap: deployed vs shippable `wayfinder:research` (AFK) — RESOLVABLE NOW
**Question:** Synthex is deployed but "shippable" ≠ "deployed". What's the real remaining gap? Resolve by inspecting recent session handoffs (`docs/session-handoffs/`), open PRs, and the founder-gated items already tracked (parity F1/F2, evidence-audit false-completes, image-gen #649). Output = the concrete shippability checklist.

### T4 — Founder provisioning checklist `wayfinder:task` (HITL — founder executes) — RESOLVABLE NOW (I produce it)
**Question:** Enumerate the exact developer-portal apps + credentials the founder must create/enter for the T1 in-scope connectors (callback URLs, scopes, app-review requirements per platform). The agent produces the precise checklist; the founder provisions.

### T5 — Prod verification runbook `wayfinder:task` (AFK) — RESOLVABLE NOW
**Question:** How do we PROVE each connection live on prod (proof-discipline)? Define the per-connector smoke set (curl/MCP/checkout/publish-test) that turns each "set" into "verified GREEN".

## Not yet specified (fog — in scope, not yet sharp)

- Per-platform OAuth wiring + app-review for each T1 in-scope social publisher (blocked on T1).
- The actual prod cutover / launch-gate sequence (blocked on T2 + T3).
- MCP surface verification against the live 23-tool scoped surface (blocked on T5 runbook).
- End-to-end "generate → schedule → publish" happy-path proof per connected platform (blocked on T1 + T4).

## Out of scope

- **The other 10 Unite-Group businesses** — this map is Synthex-only per the scoping decision. Cascade is a fresh effort after the playbook is proven here.
- **Firecrawl connector** — absent in prod but code falls back to native fetch; not launch-blocking unless T3 says otherwise.
