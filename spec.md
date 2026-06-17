---
spec_type: master
spec_id: spec-master-agency-001
title: 'Synthex — Professional Application & Full In-House Marketing Agency Build Spec'
version: 1.3.0
date: 2026-06-16
status: scope-locked — ready to plan
australian_context: true
inherits:
  - .claude/skills/fable-engine/SKILL.md # phase loop + spec format
  - .claude/rules/fabel-evidence-standard.md # [VERIFIED]/[INFERENCE]/[UNCONFIRMED]
  - .claude/rules/verification-gate.md # completion proof discipline
overridden_by:
  - CONSTITUTION.md # immutable; wins on any conflict
review:
  - 'v1.0 audit (4-lane parallel) — over-reported gaps; superseded'
  - 'v1.1 opus-adversary pass — re-verified every consequential verdict against code'
  - 'v1.2 founder scope-lock (5 decisions, §14) — Paid architect-ready, Influencer/UGC in v1, in-house-first, DAM+e-sign v2'
  - 'v1.3 founder rule — use existing infra only; no AWS/Azure/new SaaS/new npm; #1 shipped (PR #467 → main 226bc854)'
---

# Synthex — Master Build Spec: A Full In-House Marketing Agency

## 0. How to read this document

This is the **master spec**. It does two jobs at once:

1. **Methodology** — it codifies how a 15+ year full-stack agency designs and builds
   professional, end-to-end applications from the ground up (§5, the P0–P10 pipeline).
2. **Application of that methodology to Synthex** — it audits Synthex's readiness to operate
   as a full in-house marketing agency, names the gaps with evidence (§6–§7), prioritises the
   work (§8), and defines the review and verification gates that prove readiness (§9, §15).

**It inherits, it does not reinvent.** The Fabel method (`fable-engine`), the evidence tags
(`fabel-evidence-standard.md`), the verification gate, the review agents, the CI gates and
the coverage floors already exist. This spec _references_ them. `CONSTITUTION.md` remains the
immutable source of truth and overrides this file on any conflict.

**Evidence discipline.** Every factual line carries exactly one tag: `[VERIFIED]` (read in
the code/tool result), `[INFERENCE]` (concluded from verified material), `[UNCONFIRMED]`
(assumption — must also appear in §13). The matrix below was produced by a four-lane parallel
audit on 2026-06-16, re-verified by an `opus-adversary` pass that corrected several over-
reported gaps, then **scope-locked by five founder decisions** (§14) on the same day.

**Decomposition.** This master spec is the parent. Each prioritised backlog item in §8 spawns
its **own** `fable-engine` child spec at execution time. One master, many children.

---

## 1. Finish line (locked)

> **Synthex is ready to operate as a full in-house marketing agency when (A) every
> _v1-in-scope_ service line in §7 is deliverable in-product with real data — no mock-only
> and no stub paths — and passes the product verification gate (§15), AND (B) a test client
> can be taken end-to-end through the agency operating runbook (§10) on Synthex, each stage
> producing a real, client-visible artefact.**

Two gates, both must be green. The in-scope row set is frozen in §7 by a `Scope` column:

- **v1** — required for "ready". Includes Influencer/UGC (founder decision §14-1) and the
  **multi-client console for in-house delivery** (§14-2).
- **v1 (architect-ready)** — **Paid Media** is _not built_ in v1, but v1 **must ship the
  extension points** so it slots in later with zero rework: channel-agnostic attribution, a
  reserved (documented, not migrated) ad-data shape, and an empty "paid" slot in reporting
  (§14-1). White-label architecture is likewise kept ready though the external tier is v2.
- **v2** — explicitly deferred: native Paid Media build, external white-label/reseller tier,
  in-product e-sign, central DAM (§14).

Synthex v1 is therefore "a full in-house **organic + owned-channel** marketing agency that is
_wired for paid and white-label_ but does not yet execute them." This keeps Gate A
falsifiable — "ready" = every **v1** row green, with **v1 (architect-ready)** rows proven to
have working extension points (not the feature itself).

- **Gate A — v1 product completeness.** No §7 row tagged **v1** is `MISSING` or mock/stub;
  every **v1 (architect-ready)** row has a verified extension point; `npm run release:check`
  passes with the mandated live-endpoint proofs (§15).
- **Gate B — operating runbook.** The §10 runbook executes for one real test client; each
  stage produces a real artefact whose id/URL is captured. A mock/placeholder artefact fails
  the stage.

`[VERIFIED]` Today neither gate is green: Gate A v1 fails on scheduled-report delivery (stub),
the unwired authority-campaign generator, CRM unification, client-facing invoicing, the
multi-client console, Influencer/UGC, and the paid-ready extension points; Gate B fails
because there is no client-facing invoicing or multi-client console (§7).

---

## 2. Decision up front

**Recommendation:** Synthex is ~80% of an organic/owned full-service agency platform and is
_real where it counts_ — content, 9-platform publishing, video, SEO/Local/GBP (incl. live GBP
writes), sentiment + social listening, PR, email/lifecycle, landing/web, competitive
intelligence, autopilot, and PDF reporting all verified present in code. Close the remaining
~20% through the P0–P10 pipeline (§5), one backlog item (§8) at a time, each gated by the
existing SPM multiple-eyes review (§9). Sequence by client-revenue impact ÷ effort: **wire
scheduled-report delivery first** (smallest effort, most visible deliverable — jsPDF
generator, Resend sender and cron already exist; only the wiring is missing), **then wire the
authority-campaign generator, unify the scattered CRM primitives, and stand up the multi-
client console**, **then the rest of the agency operating layer** (client-facing invoicing,
Influencer/UGC), with **paid-ready architecture built but paid execution deferred** to v2 per
the founder decision. Ship the operating runbook (§10) alongside Gate A so the platform is
_usable as an agency_, not just _feature-complete_.

`[INFERENCE]` This ordering exploits the large amount already built (the adversary pass proved
several "gaps" were already implemented) and confines true greenfield (native paid execution,
external white-label) to v2 while keeping v1 architecturally ready for both.

---

## 3. Goals & non-goals

**Goals**

- A single authoritative spec that _discovers_ every required agency capability and states,
  with code-verified evidence, what is present / partial / missing.
- A reusable agency-grade build methodology (P0–P10) any feature or wave runs through.
- A prioritised, Linear-ready backlog that turns each real gap into an executable child spec.
- Named multiple-eyes review gates and a verification plan that make "ready" provable.
- An operating runbook so Synthex can be _run_ as an in-house agency, not only shipped.
- **v1 architecture that is paid-ready and white-label-ready** even where those features ship later.
- **Use what Synthex already has.** Every item builds on the existing stack and libraries (see
  non-goals) — finishing and wiring, not adding.

**Non-goals**

- Re-specifying capabilities already real in production (do not re-spec the 9 social services,
  the autopilot engine, the PDF generator, the campaign CRUD, the competitive-intel engine, or
  Stripe SaaS billing — verify, don't rewrite).
- Replacing `fable-engine`, the evidence standard, or the review agents — this inherits them.
- **Adding anything new.** Use what Synthex already has — Vercel + Supabase + Prisma; Resend/
  SendGrid; jsPDF/puppeteer; the 9 social services; the `lib/ai` provider factory;
  `competitive-intel`, `lib/pr`, `lib/email`, `lib/landing-page`, `lib/seo`, `lib/analytics`,
  `lib/reports`, the autopilot/workflow engines, Stripe. **No new external platforms (no AWS/
  Azure/GCP), no new SaaS, no new npm packages** without explicit Board approval (CONSTITUTION
  rule). Grep for the existing module first.
- **Building native Paid Media execution or the external white-label/reseller tier in v1** —
  both are v2; v1 only builds their extension points (§14-1, §14-2).
- In-product e-sign and a central DAM in v1 — both v2 (§14-5).

---

## 4. Approach (plain language)

In one paragraph: treat Synthex not as a greenfield build but as a near-complete agency
platform that needs _finishing, wiring, and operationalising_ — then prove it. First, **audit
honestly** (§6–§7): every agency service line gets a code-verified PRESENT/PARTIAL/MISSING
verdict, with an adversary re-check so we never mistake a grep miss for a gap. Second,
**freeze the v1 scope** (§7 `Scope` column + §14 decisions) so "ready" is a falsifiable
target. Third, **run each remaining gap through the same agency-grade pipeline** (§5, P0–P10),
smallest-and-most-visible first (§8), with the existing multiple-eyes review (§9) gating every
merge, and **design every deferred capability's extension points in v1** so paid and white-
label slot in later without rework. Fourth, **prove readiness twice** (§15): the product gate
(build/test/coverage/live proofs) and the operating-runbook gate (one real client taken end-
to-end, every stage emitting a real artefact). The methodology is reusable for any future
feature; the matrix and backlog are the Synthex-specific application of it today.

---

## 5. The Agency-Grade Build Methodology (P0–P10)

Each phase: **purpose · output artefact · definition of done (DoD) · which eyes review · the
existing Synthex owner**. Phases run smallest-slice-first; a feature may loop P1→P6 many times.

| Phase                                                              | Purpose                                                                                                                         | Output artefact                                 | DoD                                                                                                                 | Eyes                                                          | Synthex owner                                                                                  |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **P0 Discovery, Requirements & Measurement**                       | Turn intent into a testable finish line; intake brief, ICP — **and define KPIs + UTM + attribution _before_ build**             | `fable-engine` child spec + measurement plan    | Finish line is one testable sentence; KPIs/UTM/attribution agreed; ≤5 open questions                                | `senior-pm`; human gate                                       | `fable-engine`, `grill-with-docs`, `marketing-icp-research`, `marketing-analytics-attribution` |
| **P1 Experience & UX/UI**                                          | IA, flows, design system, accessibility                                                                                         | Flows + component plan; WCAG check              | Matches existing patterns; a11y considered                                                                          | `code-architect` + `ui-ux`/`design`                           | `ui-ux`, `ui-review`, `frontend-design`                                                        |
| **P2 System & Data Architecture**                                  | Layer boundaries, Prisma models, org-scoping — **+ extension points for deferred capabilities (paid-ready, white-label-ready)** | Data-model section; migration plan              | Layer rule honoured; new columns nullable/defaulted; deferred-feature seams documented; `npx prisma validate` clean | `code-architect` + `senior-reviewer`                          | `database-prisma`, `architecture-enforcer`, `sql-hardener`                                     |
| **P3 API & Integration**                                           | Route contracts, Zod, auth tiers, integrations                                                                                  | Typed route(s) via `define-route.ts`            | Zod on all mutations; org-scoped; `{error,details?}`                                                                | `senior-reviewer` + `route-auditor`                           | `api-testing`, `auth-patterns`, `route-auditor`                                                |
| **P4 AI Integration**                                              | Routing through the provider factory, scoring, guardrails                                                                       | AI service via `getAIProvider()`                | No direct SDK calls; cost guardrails; deterministic fallbacks                                                       | `senior-reviewer` + `code-architect`                          | `lib/ai/model-router.ts`, provider factory                                                     |
| **P5 Deploy / Infra (Vercel + Supabase — the existing substrate)** | Env, crons, build, deploy on the existing stack — no new infra                                                                  | `build:vercel` green; cron registered           | Build passes; env verified; no secrets committed; no new platform/SaaS/package added                                | `build-engineer`                                              | `build-orchestrator`, `curator-deployment`                                                     |
| **P6 Quality & Testing**                                           | Unit/integration/e2e, coverage floors, contract tests                                                                           | Tests + coverage report                         | Per-path floors in `jest.worktree.cjs` met; 401→403→400→200                                                         | `qa-sentinel`                                                 | `api-testing`, `qa-lead`                                                                       |
| **P7 Security & Compliance**                                       | The 5 attack surfaces, RLS, secrets, GST/privacy                                                                                | Security review notes                           | SSRF/JWT-tier/CORS/org-scope/OAuth-redirect checked; RLS on                                                         | `codex-security-auditor` / `senior-reviewer`                  | `security-hardener`, `curator-security`                                                        |
| **P8 SPM Multiple-Eyes Review Gate**                               | Independent verification before merge                                                                                           | Unified review verdict                          | No CRITICAL; <3 HIGH; 80%-confidence filter                                                                         | `chief-reviewer` + specialists; `opus-adversary`; `boardroom` | §9                                                                                             |
| **P9 Launch & Human Gate**                                         | Production approval; verification-gate proof                                                                                    | Curl/Jest/Vercel proof + CEO sign-off           | Live proof pasted; Vercel "Ready"; founder authorises                                                               | **Human (Phill)**                                             | `verification-gate.md`, `production-gate`                                                      |
| **P10 Operate & Close-the-Loop**                                   | Observe in prod; register; close to Linear (UNI-2046)                                                                           | Linear closed; state saved; memory/wiki updated | Captured→grounded→integrated→verified→registered→observed→closed                                                    | `senior-pm` + observability                                   | `wiki-ingest`, `.claude/scratchpad/`                                                           |

`[VERIFIED]` Each owner exists: phase agents in `.claude/agents/`; skills in `.claude/skills/`;
rules in `.claude/rules/`; CI in `.github/workflows/`.

---

## 6. Capability discovery engine

A **marketing-agency service-line taxonomy** mapped to Synthex surfaces so nothing is silently
absent — the row set of §7. The v1.0 audit proved the failure mode: **a single grep miss
over-reports a gap** (it wrongly flagged PDF, sentiment, competitive-intel and GBP-writes). So
the method requires a **second skeptical pass** before any verdict ships:

1. Grep the owning `lib/` domain + `app/api/` + `app/dashboard/` for real implementation vs
   `TODO`/`FIXME`/`mock`/`stub`/`placeholder`/disabled.
2. Assign **PRESENT** / **PARTIAL** / **MISSING**, citing `path:line`.
3. **Adversary re-check**: for every MISSING/stub verdict, grep wider (sibling dirs, services,
   git log) to disprove it before accepting it.
4. Reconcile against git history (e.g. #458 routed the sentiment analyzer the first audit
   declared absent).

---

## 7. Seeded capability matrix (audited 2026-06-16, adversary-corrected, scope-locked)

`Scope`: **v1** = required for Gate A · **v1\*** = v1 architect-ready (extension points only,
feature deferred) · **v2** = deferred build.

| #   | Service line                                                                                      | Verdict              | Scope    | Evidence (`path:line`)                                                                                                                                                                                                                          | Gap note                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------- | -------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Content creation**                                                                              | PRESENT `[VERIFIED]` | v1       | `lib/ai/{content-generator,content-repurposer,content-scorer}.ts`, `lib/content/*`, `lib/services/ai/image-generation.ts`                                                                                                                       | none                                                                                                                                                                                 |
| 2   | **Multi-channel publishing** (9 platforms + queue + cross-post)                                   | PRESENT `[VERIFIED]` | v1       | `lib/social/*-service.ts`, `lib/publish/platformAdapters/{twitter,facebook}.ts`, `lib/publish/publishQueue.ts`                                                                                                                                  | IG Stories/Reels UI; Twitter `postTweet` vs base — #13                                                                                                                               |
| 3   | **Video / creative**                                                                              | PRESENT `[VERIFIED]` | v1       | `lib/video/*`, `lib/remotion/compositions/` (17), `app/api/heygen/video/route.ts`                                                                                                                                                               | render quality-gate no auto-retry                                                                                                                                                    |
| 4   | **Automation / autopilot / workflows**                                                            | PRESENT `[VERIFIED]` | v1       | `prisma` `WorkflowExecution`/`StepExecution`/`AutopilotRun`, `app/api/cron/autopilot/route.ts`                                                                                                                                                  | monitoring UI shallow                                                                                                                                                                |
| 5   | **SEO / Local / GBP** (rank, PSI, geo, citations, backlinks, E-E-A-T, GBP posts + review replies) | PRESENT `[VERIFIED]` | v1       | `lib/seo/rank-tracker.ts`, `lib/google/search-console.ts`, `app/api/google-business/posts/route.ts:102`, `app/api/google-business/reviews/[reviewId]/reply/route.ts:80`                                                                         | PageSpeed fabricates demo scores (`pagespeed-service.ts:215`) — #9                                                                                                                   |
| 6   | **Analytics & reporting** (metrics, benchmarks, forecasting, effect/ROI, PDF export)              | PRESENT `[VERIFIED]` | v1       | `lib/analytics/*`, `lib/reports/pdf-generator.ts:202` (jsPDF, wired `app/api/reporting/reports/[reportId]/download/route.ts:98`)                                                                                                                | benchmarks static; forecasting linear                                                                                                                                                |
| 7   | **Scheduled report delivery**                                                                     | PARTIAL `[VERIFIED]` | v1       | working cron `app/api/reports/scheduled/execute/route.ts` (Resend+SendGrid send, updates `ScheduledReport`, records `ReportDelivery`); model `schema.prisma:6478`; CRUD `app/api/reports/scheduled/route.ts`; dashboard `app/dashboard/reports` | only gap: `sendReportEmail` attaches JSON only — `generatePDF` never called, so `format:'pdf'` sends no PDF; dead legacy `ScheduledReportManager` (`report-builder.ts:703/711`) — #1 |
| 8   | **Attribution (channel-agnostic, paid-ready)**                                                    | PARTIAL `[VERIFIED]` | v1\*     | `lib/analytics/analytics-tracker.ts` (UTM), `app/api/effect-report/route.ts`                                                                                                                                                                    | single-touch; build multi-touch + paid-ready seam — #7                                                                                                                               |
| 9   | **Sentiment & social listening**                                                                  | PRESENT `[VERIFIED]` | v1       | `lib/social/sentiment-analyzer.ts:89` (`getAIProvider()`), `app/api/analytics/sentiment/route.ts`, `app/api/listening/*`                                                                                                                        | surface in dashboard — #11                                                                                                                                                           |
| 10  | **Brand & voice** (DNA, voice scoring, consistency, competitive-intel + content gap)              | PRESENT `[VERIFIED]` | v1       | `lib/brand-dna/extractor.ts`, `lib/brand-voice/quality-scorer.ts`, `lib/services/competitive-intel.ts` (1228 lines, `:575 identifyContentGaps`)                                                                                                 | persona training loop — #8; competitive-intel UI — #10                                                                                                                               |
| 11  | **Strategy / planning / campaigns**                                                               | PARTIAL `[VERIFIED]` | v1       | real CRUD `app/api/campaigns/route.ts:262` (`tx.campaign.create`); `full-campaign-generator.ts:506` **unwired** (scripts/tests only); demo route `app/api/marketing-agency/campaigns/route.ts:11` mock                                          | wire the authority generator — #2                                                                                                                                                    |
| 12  | **PR / media relations**                                                                          | PRESENT `[VERIFIED]` | v1       | `lib/pr/{press-release-builder,pitch-drafter,distribution-channels,coverage-linker,hunter-enricher,beat-classifier,ai-generator}.ts`                                                                                                            | verify client surface                                                                                                                                                                |
| 13  | **Email marketing / lifecycle**                                                                   | PRESENT `[VERIFIED]` | v1       | `lib/email/` (18 modules: `queue.ts`, `email-service.ts`, `effect-report-email.ts`, milestone/monthly/quarterly)                                                                                                                                | not a publish-queue channel; newsletter UI — #13                                                                                                                                     |
| 14  | **Landing pages / web / CRO**                                                                     | PRESENT `[VERIFIED]` | v1       | `lib/landing-page/{page-builder,jsonld-builder,validators}.ts`, `app/api/web-projects/route.ts`; A/B via `lib/experiments`                                                                                                                      | CRO/funnel partial                                                                                                                                                                   |
| 15  | **Approvals & collaboration**                                                                     | PARTIAL `[VERIFIED]` | v1       | `app/api/approvals/route.ts`, `prisma` `ApprovalRequest`, `app/dashboard/{approvals,collaboration}/`                                                                                                                                            | comments JSON-only; no @-mentions/notifications — #12                                                                                                                                |
| 16  | **Billing & commercials** (Stripe SaaS, usage, dunning, invoices+PDF, GST)                        | PARTIAL `[VERIFIED]` | v1       | `lib/stripe/*`, `app/api/invoices/route.ts`, `app/api/invoices/[id]/pdf/route.ts` (puppeteer)                                                                                                                                                   | no client-facing/agency invoicing — #5; no discounts — #14                                                                                                                           |
| 17  | **Client / CRM**                                                                                  | PARTIAL `[VERIFIED]` | v1       | primitives: `prisma` `Lead:6446`, `DealDeliverable:1661`, `ClientHealthScore:6155`, `ClientEngagementEvent:6214`, `PipelineCostLedger:5751`; org-switch `app/api/businesses/switch/route.ts`                                                    | unify into `Client`/`Contact` + console — #3                                                                                                                                         |
| 18  | **Multi-client console (in-house)**                                                               | MISSING `[VERIFIED]` | v1       | org-switch + `parentOrgId` traversal exist (infra only)                                                                                                                                                                                         | consolidated dashboard + manage-as hardening — #4                                                                                                                                    |
| 19  | **Influencer / UGC management**                                                                   | MISSING `[VERIFIED]` | v1       | grep = no real domain                                                                                                                                                                                                                           | creator records + outreach + UGC intake — #6 _(founder §14-1: in v1)_                                                                                                                |
| 20  | **Paid / performance media**                                                                      | MISSING `[VERIFIED]` | **v1\*** | grep = zero; `google_ads` vault enum unused; Meta = format checks only                                                                                                                                                                          | **build extension points only** (attribution seam #7, reserved data shape §11, paid report slot); native build v2 — #16 _(founder §14-1)_                                            |
| 21  | **White-label / external agency tier**                                                            | MISSING `[VERIFIED]` | **v2**   | `Organization.parentOrgId` + branding fields (schema only)                                                                                                                                                                                      | reseller pricing, branding override, custom domains — #17; architecture kept ready in v1                                                                                             |
| 22  | **Contracts / proposals / e-sign**                                                                | MISSING `[VERIFIED]` | **v2**   | `sow-draft` emits a doc; no in-product e-sign                                                                                                                                                                                                   | v1 = out-of-band (manual/DocuSign); in-product e-sign — #18 _(founder §14-5)_                                                                                                        |
| 23  | **Digital asset management (DAM)**                                                                | PARTIAL `[VERIFIED]` | **v2**   | `lib/services/visual-asset-manager.ts` + per-feature assets                                                                                                                                                                                     | central library — #19 _(founder §14-5)_                                                                                                                                              |

---

## 8. Prioritised gap backlog (Linear-ready)

Ordered by client-revenue impact ÷ effort, scope-locked. `Eff` S/M/L/XL · `Imp` Low/Med/High.
**v1 items** build to Gate A; **v2 items** are deferred but listed so nothing is lost.

### v1 — build to "ready"

| Pri | Title                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Domain                    | Eff | Imp      | Phase    | Agent                                     | Acceptance-criteria stub                                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | --- | -------- | -------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | ✅ **SHIPPED** (`844e0ac6`) **Attach real PDF/CSV to scheduled reports + retire dead manager** — `buildReportAttachments` wired into the cron's `sendReportEmail` (Resend+SendGrid); dead `ScheduledReportManager` removed                                                                                                                                                                                                                               | Reporting (#7)            | S   | High     | P3/P6    | done                                      | DONE: `format:'pdf'` emails a real `%PDF` attachment (unit-proven, 3 tests); dead manager gone; type-check + lint + report tests green        |
| 2   | ✅ **SHIPPED** **Wire the authority-campaign generator** — `POST /api/marketing-agency/campaigns` now runs the real `generateFullAuthorityCampaign` (Zod-validated) + persists to the `Campaign` model, org-scoped; mock removed from the route                                                                                                                                                                                                          | Strategy (#11)            | M   | High     | P3/P4    | done                                      | DONE: 201 returns a DB-backed authority campaign (not the mock); 401/400/201 tests green; type-check + lint + 125 marketing-agency tests pass |
| 3   | 🟡 **PARTIAL** (clients console slice 1 `#471`; merged `#532`: `Contact` model + `clientId`/`crmClientId` columns to schema; additive migration `20260618_add_contacts_and_crm_links` (contacts table + RLS + 4 client-link columns) this PR — still needs Zod `/api/contacts` route + tests) **Unify CRM primitives** — fold `Lead`/`DealDeliverable`/`ClientHealthScore`/`ClientEngagementEvent` into `Client`/`Contact` + client console              | CRM (#17)                 | L   | High     | P2/P3/P1 | `code-architect`+`senior-reviewer`        | Unified client list/detail from existing tables; org-scoped CRUD + Zod                                                                        |
| 4   | ✅ **SHIPPED** (`#482`) **Multi-client console + manage-as hardening** — consolidated dashboard; org-switch hardened for sub-account delegation with cross-org 403                                                                                                                                                                                                                                                                                       | Console (#18)             | M   | High     | P1/P3/P7 | `code-architect`+`codex-security-auditor` | DONE: all sub-clients visible; manage-as switches org context; **403 on cross-org** test green                                                |
| 5   | **Agency / client-facing invoicing** — invoice an org's end-clients via Stripe; margin/passthrough                                                                                                                                                                                                                                                                                                                                                       | Billing (#16)             | L   | High     | P2/P3    | `code-architect`                          | Agency issues a client invoice; line items + 10% GST; status workflow; test                                                                   |
| 6   | 🟡 **PARTIAL** (merged `#531`: `Creator`+`UgcSubmission` models + `/api/creators` with Zod + RLS migration; `#536`: creators route tests; `#537`: `/api/ugc` GET+POST intake + PATCH moderate; `promoteApprovedSubmission` worker (approved→ContentCalendar slot via SYN-1040 `persistPublishSlot`) this PR; remaining: thin cron/route trigger to invoke the worker) **Influencer / UGC management** — creator records + outreach + UGC intake workflow | Influencer (#19)          | L   | Med-High | P2/P3/P1 | `code-architect`                          | Creator CRM + UGC intake; org-scoped; intake feeds the content pipeline                                                                       |
| 7   | ✅ **SHIPPED** (`#479`) **Paid-ready architecture** — channel-agnostic multi-touch attribution + reserved ad-data shape + empty paid slot in reports (NO ad execution)                                                                                                                                                                                                                                                                                   | Attribution/Paid (#8,#20) | M   | Med      | P2/P4    | `code-architect`                          | Attribution exposes ≥2 models channel-agnostically; reports render a (empty) paid section; data seams documented & additive                   |
| 8   | ✅ **SHIPPED** (`#477`) **Brand persona training loop** — refinement + feedback                                                                                                                                                                                                                                                                                                                                                                          | Brand (#10)               | M   | Med      | P4       | `code-architect`                          | Persona updatable from feedback; voice samples feed the scorer                                                                                |
| 9   | ✅ **SHIPPED** (`#472`) **PageSpeed honesty** — remove demo fallback; surface "data unavailable"                                                                                                                                                                                                                                                                                                                                                         | SEO (#5)                  | S   | Med      | P6/P7    | `senior-reviewer`                         | No fabricated 85/95 when key/API missing; UI states unavailability                                                                            |
| 10  | ✅ **SHIPPED** (`#474` + `#478`) **Competitive-intel UI surface** — expose the existing engine + content-gap report                                                                                                                                                                                                                                                                                                                                      | Brand/SEO (#10)           | S   | Med      | P1       | `code-architect`+`ui-ux`                  | Content-gap + benchmark rendered from `competitiveIntel`                                                                                      |
| 11  | ✅ **SHIPPED** (`#475`) **Surface sentiment + listening** — expose existing score & mentions in audience UI                                                                                                                                                                                                                                                                                                                                              | Analytics (#9)            | S   | Low-Med  | P1       | `code-architect`                          | Sentiment + listening visible; reads existing services                                                                                        |
| 12  | ✅ **SHIPPED** (`#483` + RLS reconcile `#485`) **Approvals collaboration** — threaded comments API, @-mentions; SLA reminders remain                                                                                                                                                                                                                                                                                                                     | Approvals (#15)           | M   | Med      | P3/P1    | `code-architect`                          | DONE: threaded comments persisted + @-mentions; org-member RLS aligned. Follow-up: notifications + due-date reminder                          |
| 13  | 🟡 **PARTIAL** (Twitter parity `#476` + IG Reels backend `#480`; IG composer UI + email-as-channel remain) **Publishing polish** — IG Stories/Reels UI; email-as-channel; Twitter `createPost` parity                                                                                                                                                                                                                                                    | Publishing (#2,#13)       | M   | Low      | P1/P3    | `code-architect`                          | Story/Reel scheduling UI; email channel in queue; Twitter conforms to base                                                                    |
| 14  | ✅ **SHIPPED** (`#484`) **Discounts / promo codes** — coupon model + checkout application                                                                                                                                                                                                                                                                                                                                                                | Billing (#16)             | S   | Low      | P3       | `code-architect`                          | DONE: promo reduces Stripe checkout; org-member RLS on `promo_codes`; tests green                                                             |
| 15  | ✅ **SHIPPED** (`#473`) **Retire the remaining report stub** — `report-generator.ts:471 generatePDFContent`                                                                                                                                                                                                                                                                                                                                              | Reporting (#6)            | S   | Low      | P3/P6    | `code-architect`                          | Delegates to the real `pdf-generator` or is removed                                                                                           |

### v2 — deferred (architecture kept ready in v1)

| Pri | Title                                                                                          | Domain            | Eff | Why deferred                                                                       |
| --- | ---------------------------------------------------------------------------------------------- | ----------------- | --- | ---------------------------------------------------------------------------------- |
| 16  | **Paid Media native build** — Google/Meta Ads creation, budget pacing, bid automation          | Paid (#20)        | XL  | Founder §14-1: cannot fund paid spend now; v1 ships only the extension points (#7) |
| 17  | **External white-label / reseller tier** — branding override, custom domains, reseller pricing | White-label (#21) | L   | Founder §14-2: in-house delivery first; sell-to-other-agencies later               |
| 18  | **In-product e-sign / contracts** — countersign MSA/SOW in-product                             | Contracts (#22)   | M   | Founder §14-5: v1 signs contracts out-of-band (manual/DocuSign)                    |
| 19  | **Central DAM** — client-facing asset library on `visual-asset-manager`                        | DAM (#23)         | M   | Founder §14-5: per-feature asset handling covers v1                                |

`[INFERENCE]` v1 #1–#5 make existing strengths sellable + stand up the agency layer; #6–#7
add the founder-requested Influencer/UGC and paid-readiness; #8–#15 harden and surface
already-built engines.

---

## 9. Multiple-eyes review model

The "Senior-Project-Manager tested, multiple eyes" gate — reused verbatim, not invented.
`[VERIFIED]` agents in `.claude/agents/`.

**Flow per change:** `senior-pm` (intake, scope, Linear) → orchestrator dispatch → build by
specialist (`code-architect` / domain skill) → **review fan-out**: `senior-reviewer`
(correctness/auth/arch) + `qa-sentinel` (tests/coverage) + `codex-security-auditor` (security,
when surfaces touched) → `chief-reviewer` unifies (blocks on CRITICAL or 3+ HIGH) →
`opus-adversary` pressure-test (default pre-merge on non-trivial) + `boardroom`/`ceo-board`
(strategic, e.g. the v2 Paid Media build #16) → `verification-agent` runs the gauntlet →
**P9 human gate (Phill)** for production.

**Severity model** (`senior-reviewer`): **Blocker** · **Warning** · **Suggestion**.
**80%-confidence filter** (`chief-reviewer`): drop findings below 80% confidence.

**Binding rule** (`fabel-evidence-standard.md`): a subagent's "green" is `[UNCONFIRMED]` until
the orchestrator re-runs the gauntlet on the integrated tree. **The `opus-adversary` pass on
this very spec corrected three matrix verdicts the v1.0 audit got wrong** (§13). Audits over-
report; the adversary lens is what catches it.

---

## 10. Operating runbook (run Synthex as an in-house agency)

The ops layer that satisfies **Gate B**. ⛔ marks a stage a v1 gap still blocks.

| Stage                            | What happens                                                                     | Surface / skill                                                              | Status                                           |
| -------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------ |
| **1. Lead & discovery**          | Qualify, capture goals, ICP, + measurement/KPI plan                              | `discovery-12q`, `marketing-icp-research`, `marketing-analytics-attribution` | Ready                                            |
| **2. Scope**                     | Milestone SOW; ABN/GST verified                                                  | `sow-draft` → `sow.json`                                                     | Ready                                            |
| **3. Contract & sign**           | Countersign MSA/SOW before delivery                                              | **v1: out-of-band (manual/DocuSign)**; in-product e-sign = v2 (#18)          | Ready (out-of-band)                              |
| **4. Onboard**                   | Linear project + Supabase portal + intake bot + welcome email                    | `client-portal-provision`                                                    | Ready                                            |
| **5. Billing setup**             | Deposit + milestone invoices, GST                                                | `stripe-milestone-invoice`                                                   | Ready (own-client); ⛔ end-client billing #5     |
| **6. Brand capture**             | Voice + DNA + consistency + competitive baseline                                 | `lib/brand-dna`, `brand-voice`, `competitive-intel`                          | Ready (persona loop #8)                          |
| **7. Deliver — content/social**  | Plan → write → schedule → publish (9 platforms)                                  | `marketing-orchestrator`, `lib/social`, autopilot                            | Ready (authority-campaign route #2)              |
| **8. Deliver — SEO/local**       | Audit, rank track, GBP posts + review replies, citations                         | `seo`, `lib/seo`, `lib/gbp`                                                  | Ready (PageSpeed honesty #9)                     |
| **9. Deliver — PR, email & UGC** | Press releases, pitches; lifecycle sends; creator/UGC intake                     | `lib/pr`, `lib/email`, Influencer/UGC (#6)                                   | Ready (PR/email); ⛔ UGC #6                      |
| **10. Deliver — video & web**    | Script→render→derive cuts; landing pages                                         | `video-director`, `lib/video`, `lib/landing-page`                            | Ready                                            |
| **11. Approve**                  | Editorial + brand gate before client-visible                                     | approvals engine, `qa-lead`, `brand-guardian`                                | Ready (collab #12)                               |
| **12. Report**                   | Performance + ROI (incl. empty paid slot, paid-ready), client-visible, scheduled | `lib/reports` (jsPDF), `lib/analytics`                                       | Ready (scheduled delivery #1 shipped `844e0ac6`) |
| **13. Retain & retro**           | Weekly digest; campaign retrospective / win-loss                                 | `client-retention`, retro template (`marketing-analytics-attribution`)       | Ready (retro wiring)                             |

**Roles:** Founder (P9 human gate) · `senior-pm` (intake/scope/Linear) · orchestrator
(dispatch) · senior agents (architect/qa/build/reviewer) · minions (skill bundles) ·
`brand-guardian` (editorial gate) · `qa-lead` (ship gate).

**SLAs (locked v1, configurable per client tier later — §14-3):** social post ≤2 business
days · SEO audit ≤5 · video ≤7 · approval response ≤1 · monthly report by the 3rd.

---

## 11. Data-model notes

`[VERIFIED]` **216** Prisma models (`rg -c "^model " prisma/schema.prisma` = 216). The
CONSTITUTION/`control-plane.md` figure of 201 is **stale drift** — flag for update, do not
change CONSTITUTION here. New/extended models — all **nullable or defaulted**, applied via
Supabase `apply_migration`, never `prisma db push`:

- `Client` / `Contact` (#3) — _unify_ the existing scattered primitives (`Lead`,
  `DealDeliverable`, `ClientHealthScore`, `ClientEngagementEvent`, `PipelineCostLedger`),
  do not duplicate them.
- `ScheduledReport` persistence row (#1); `ClientInvoice`/passthrough (#5).
- `Creator`/`UgcSubmission` (#6, Influencer/UGC — v1).
- **Paid-ready (v1 architecture, §14-1):** reserve and **document** the `AdAccount` /
  `AdCampaign` / `AdMetric` shape and a channel-agnostic attribution join now (so the v2
  build is purely additive); **do not migrate the tables until the v2 Paid build (#16)**.
- `ApprovalComment` table to replace JSON embedding (#12); `PromoCode` (#14).
- **v2:** `ResellerPlan`/`WhiteLabelConfig` (#17), `SignedDocument` (#18), DAM library (#19).

Never drop/rename/type-change existing columns without explicit CEO approval. `npx prisma
validate` before any change.

---

## 12. Security & cost guardrails (structural)

`[VERIFIED]` Honour the 5 attack surfaces on every new route (P7): `validateExternalUrl`
(SSRF), `resolveVerifiedTier` (JWT tier elevation), `CORS_ORIGIN` exact-match, Prisma
`organizationId` scoping (cross-org bypass), `returnTo` validation (OAuth open redirect). New
tables RLS-enabled. Secrets in Vercel dashboard only — never committed, never logged. **The
multi-client "manage-as" (#4) is the highest-risk addition** — cross-org context switching
must be org-scope-tested (403 on cross-org) and audited; harden the existing
`businesses/switch` route, not a greenfield.

**Cost:** AI calls route through `getAIProvider()` — never direct SDK (commits #458/#460).
Loop/agent work runs on the Anthropic Max plan, not metered API. External SEO providers
(DataForSEO, PSI, OpenPageRank) are quota-bound — gate by plan and cache; **never fabricate
data when a quota is exhausted** (the PageSpeed demo fallback, #9, violates this today).
**Paid Media (v2) carries spend exposure** — when built, ad spend stays blocked-by-default
behind an explicit human gate (the founder funds it, §14-1).

---

## 13. Risk & assumption register

| Tag                     | Item                                                                                                                                                                                                    | Mitigation                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `[VERIFIED]` lesson     | **v1.0 audit over-reported gaps** — wrongly flagged PDF export, sentiment, competitive-intel, GBP-writes as missing/stub; the `opus-adversary` pass caught all four against code                        | §6 now mandates an adversary re-check on every MISSING/stub verdict before it ships; saved to memory                                                               |
| `[VERIFIED]` correction | **Scheduled-report delivery already works** (cron sends via Resend, updates `ScheduledReport`, records `ReportDelivery`) — earlier "stub" call was the dead `ScheduledReportManager`, not the live path | #1 narrows to: attach the real PDF (today JSON-only) + delete the dead manager. Every other backlog item gets the same verify-before-build pass via its child spec |
| `[VERIFIED]` risk       | **Authority-campaign generator unwired** — real but only scripts call it                                                                                                                                | #2 wires it; the _demo_ route stays mock and must not be sold                                                                                                      |
| `[VERIFIED]` risk       | **PageSpeed fabricates demo scores** (`pagespeed-service.ts:215`)                                                                                                                                       | #9 removes the fallback                                                                                                                                            |
| `[VERIFIED]` decision   | **Paid Media** — funded later, not now (§14-1)                                                                                                                                                          | v1 ships extension points only (#7); native build is v2 (#16); finish line scoped accordingly                                                                      |
| `[VERIFIED]` risk       | **Paid-ready seam could rot** if attribution isn't truly channel-agnostic                                                                                                                               | #7 acceptance requires a documented, additive seam reviewed by `code-architect`                                                                                    |
| `[VERIFIED]` risk       | New CRM/console/manage-as touch multi-tenancy — cross-org leakage                                                                                                                                       | P7 + #4 org-scope 403 tests are blocking                                                                                                                           |
| `[VERIFIED]` drift      | Model count: actual **216**, CONSTITUTION says 201                                                                                                                                                      | Flag CONSTITUTION update; spec uses verified 216                                                                                                                   |
| `[UNCONFIRMED]`         | PR/email/landing/UGC **client-facing UI** depth not fully audited                                                                                                                                       | Verify surfaces during #6/#10/#13                                                                                                                                  |
| `[INFERENCE]`           | Native Paid Media may be better partnered than built when funded                                                                                                                                        | Board (#16) before any v2 paid code                                                                                                                                |

---

## 14. Decisions (locked 2026-06-16, founder)

1. **Paid Media — architect-ready, build-deferred.** "The system needs the option of paid ads
   in the future. Right now we can't afford them — that's for now, not forever." → v1 builds
   the extension points (channel-agnostic attribution #7, reserved ad-data shape §11, empty
   paid report slot); native ad execution is v2 (#16). Matrix rows #8 (v1*), #20 (v1*).
2. **Agency model — in-house delivery first.** Multi-client console + manage-as (#4) is v1
   (Unite runs its own agency on Synthex); the external white-label/reseller tier (#17) is v2,
   with the multi-tenant architecture kept white-label-ready.
3. **SLAs — adopt the proposed baseline** (social ≤2 biz days · SEO audit ≤5 · video ≤7 ·
   approval ≤1 · monthly report by the 3rd), configurable per client tier later (§10).
4. **PDF substrate — jsPDF for reports** (reuse the wired generator for #1), **puppeteer for
   invoices only** (lightest serverless footprint).
5. **v1 scope cut — defer central DAM (#19) and in-product e-sign (#18) to v2.** Contracts are
   handled out-of-band (manual/DocuSign) in v1 so the runbook contract stage is still honoured;
   Influencer/UGC (#6) is **in v1** (decision 1). Everything else stays v1.

---

## 15. Verification plan

**Gate A — v1 product completeness (commands that prove "done"):**

```bash
npm run type-check                 # tsc --noEmit — zero errors
npm run lint                       # ESLint --max-warnings 0
npm test -- --coverage             # per-path floors in jest.worktree.cjs (auth=100%, etc.)
npm run build:vercel               # prod build (migrate + drift gate + next build)
npm run e2e                        # Playwright critical paths
npm run release:check              # full pre-release chain
```

Plus the **mandated live-endpoint proof** (CONSTITUTION § Verification Non-Negotiables) — paste
actual output, no "done" without it:

```bash
curl -s -X POST https://synthex.social/api/demo/analyze \
  -H "Content-Type: application/json" -d '{"url":"https://google.com.au"}'
# MUST contain "businessName" and "caption"; "error" or 5xx = not done
```

**Per-backlog-item live proof** (the real acceptance — one command per item):

- #1 scheduled report → a `format:'pdf'` report emails a real `%PDF` attachment; the dead `ScheduledReportManager` is removed.
- #2 authority campaign → route returns a DB id, not the mock fixture.
- #4 manage-as → cross-org `GET` returns **403**.
- #6 UGC → an intake submission creates a `Creator`/`UgcSubmission` row, surfaced in content.
- #7 paid-ready → reports render an (empty) paid section; attribution returns ≥2 models; the
  reserved ad-data seam is documented and additive (no migration yet).
- #9 PageSpeed → with key removed, response states "unavailable" (no 85/95).
  Each remaining backlog item ships its own one-line proof command in its child spec.

**Gate B — operating runbook dry-run:** onboard one test client end-to-end through §10 stages
1–13; each stage must produce a **real** artefact (Linear project, `sow.json`, signed contract
[out-of-band in v1], Stripe invoice, a published post with a platform URL, a client-visible PDF
report). A mock/placeholder artefact **fails** the stage. Capture the artefact id/URL per stage.

**Spec-of-record verification (this document):** all sections present; no `TBD`/`TODO`; every
factual/matrix/backlog line tagged; every PRESENT/PARTIAL row cites a path; every
`[UNCONFIRMED]` appears in §13; the `opus-adversary` pass is complete and folded in (v1.1); the
five founder decisions are locked (§14, v1.2); backlog is Linear-ready and #1 is ready to spawn
a child spec.
