---
spec_type: master
spec_id: spec-master-agency-001
title: "Synthex — Professional Application & Full In-House Marketing Agency Build Spec"
version: 1.1.0
date: 2026-06-16
status: awaiting-approval
australian_context: true
inherits:
  - .claude/skills/fable-engine/SKILL.md          # phase loop + spec format
  - .claude/rules/fabel-evidence-standard.md       # [VERIFIED]/[INFERENCE]/[UNCONFIRMED]
  - .claude/rules/verification-gate.md             # completion proof discipline
overridden_by:
  - CONSTITUTION.md                                # immutable; wins on any conflict
review:
  - "v1.0 audit (4-lane parallel) — over-reported gaps; superseded"
  - "v1.1 opus-adversary pass — re-verified every consequential verdict against code"
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
the coverage floors already exist. This spec *references* them. `CONSTITUTION.md` remains the
immutable source of truth and overrides this file on any conflict.

**Evidence discipline.** Every factual line carries exactly one tag: `[VERIFIED]` (read in
the code/tool result), `[INFERENCE]` (concluded from verified material), `[UNCONFIRMED]`
(assumption — must also appear in §13). The matrix below was produced by a four-lane parallel
audit on 2026-06-16, then **re-verified by an `opus-adversary` pass** that corrected several
over-reported gaps; v1.1 reflects the corrected, code-checked verdicts.

**Decomposition.** This master spec is the parent. Each prioritised backlog item in §8 spawns
its **own** `fable-engine` child spec at execution time. One master, many children.

---

## 1. Finish line (locked)

> **Synthex is ready to operate as a full in-house marketing agency when (A) every
> *v1-in-scope* service line in §7 is deliverable in-product with real data — no mock-only
> and no stub paths — and passes the product verification gate (§15), AND (B) a test client
> can be taken end-to-end through the agency operating runbook (§10) on Synthex, each stage
> producing a real, client-visible artefact.**

Two gates, both must be green. To keep Gate A **falsifiable**, the in-scope row set is frozen
in §7 by a `Scope` column: **v1** rows must be green for "ready"; **v2** rows
(Paid Media, Influencer/UGC) are explicitly *out of Gate A v1* and tracked separately. Synthex
v1 is therefore "a full in-house **organic + owned-channel** marketing agency"; native paid-
media execution is a deliberate v2 phase (see §8 #7 and §14 Q1). This resolves the otherwise-
circular "no capability MISSING within agreed scope" — scope is the v1 set, named in §7.

- **Gate A — v1 product completeness.** No §7 row tagged **v1** is `MISSING` or mock/stub, and
  `npm run release:check` passes with the mandated live-endpoint proofs (§15).
- **Gate B — operating runbook.** The §10 runbook executes for one real test client; each
  stage produces a real artefact whose id/URL is captured. A mock/placeholder artefact fails
  the stage (this is what disqualifies — closing the §15 Gate-B loophole).

`[VERIFIED]` Today neither gate is green: Gate A v1 fails on scheduled-report delivery (stub),
the unwired authority-campaign generator, CRM unification, and client-facing invoicing; Gate B
fails because there is no client-facing invoicing or multi-client console (§7).

---

## 2. Decision up front

**Recommendation:** Synthex is ~80% of an organic/owned full-service agency platform and is
*real where it counts* — content, 9-platform publishing, video, SEO/Local/GBP (incl. live GBP
writes), sentiment + social listening, PR, email/lifecycle, landing/web, competitive
intelligence, autopilot, and PDF reporting all verified present in code. Close the remaining
~20% through the P0–P10 pipeline (§5), one backlog item (§8) at a time, each gated by the
existing SPM multiple-eyes review (§9). Sequence by client-revenue impact ÷ effort:
**wire scheduled-report delivery first** (smallest effort, most visible deliverable — the PDF
generator, the Resend sender and the cron already exist; only the wiring is missing), **then
wire the authority-campaign generator and unify the scattered CRM primitives**, **then build
the agency operating layer** (client-facing invoicing, multi-client console, white-label), and
**take a Board decision on Paid Media (build vs partner vs defer) before any code** so it never
blocks v1. Ship the operating runbook (§10) alongside Gate A so the platform is *usable as an
agency*, not just *feature-complete*.

`[INFERENCE]` This ordering exploits the large amount already built (the adversary pass proved
several "gaps" were already implemented) and confines the one true greenfield (Paid Media) to
a scoped v2 bet.

---

## 3. Goals & non-goals

**Goals**
- A single authoritative spec that *discovers* every required agency capability and states,
  with code-verified evidence, what is present / partial / missing.
- A reusable agency-grade build methodology (P0–P10) any feature or wave runs through.
- A prioritised, Linear-ready backlog that turns each real gap into an executable child spec.
- Named multiple-eyes review gates and a verification plan that make "ready" provable.
- An operating runbook so Synthex can be *run* as an in-house agency, not only shipped.

**Non-goals**
- Re-specifying capabilities already real in production (do not re-spec the 9 social services,
  the autopilot engine, the PDF generator, the campaign CRUD, the competitive-intel engine, or
  Stripe SaaS billing — verify, don't rewrite).
- Replacing `fable-engine`, the evidence standard, or the review agents — this inherits them.
- Migrating off the actual stack. The methodology's deploy phase is written cloud-portable
  ("AWS/Azure-class"), but Synthex's real substrate is **Vercel + Supabase + Prisma**, and this
  spec anchors to that reality.
- Committing Paid Media / Influencer-UGC to v1 scope; §8 lists them as v2.

---

## 4. Approach (plain language)

In one paragraph: treat Synthex not as a greenfield build but as a near-complete agency
platform that needs *finishing, wiring, and operationalising* — then prove it. First, **audit
honestly** (§6–§7): every agency service line gets a code-verified PRESENT/PARTIAL/MISSING
verdict, with an adversary re-check so we never mistake a grep miss for a gap. Second,
**freeze the v1 scope** (§7 `Scope` column) so "ready" is a falsifiable target, not a moving
one. Third, **run each remaining gap through the same agency-grade pipeline** (§5, P0–P10),
smallest-and-most-visible first (§8), with the existing multiple-eyes review (§9) gating every
merge. Fourth, **prove readiness twice** (§15): the product gate (build/test/coverage/live
proofs) and the operating-runbook gate (one real client taken end-to-end, every stage emitting
a real artefact). The methodology is reusable for any future feature; the matrix and backlog
are the Synthex-specific application of it today.

---

## 5. The Agency-Grade Build Methodology (P0–P10)

The canonical pipeline a 15-year agency runs every build through. Each phase: **purpose ·
output artefact · definition of done (DoD) · which eyes review · the existing Synthex owner**.
Phases run smallest-slice-first; a feature may loop P1→P6 many times.

| Phase | Purpose | Output artefact | DoD | Eyes | Synthex owner |
|---|---|---|---|---|---|
| **P0 Discovery, Requirements & Measurement** | Turn intent into a testable finish line; intake brief, ICP — **and define KPIs + UTM scheme + attribution model *before* build** | `fable-engine` child spec + measurement plan | Finish line is one testable sentence; KPIs/UTM/attribution agreed; ≤5 open questions | `senior-pm` intake; human gate | `fable-engine`, `grill-with-docs`, `marketing-icp-research`, `marketing-analytics-attribution` |
| **P1 Experience & UX/UI** | IA, flows, design system, accessibility | Flows + component plan; WCAG check | Matches existing patterns; a11y considered | `code-architect` + `ui-ux`/`design` | `ui-ux`, `ui-review`, `frontend-design` |
| **P2 System & Data Architecture** | Layer boundaries, Prisma models, org-scoping | Data-model section; migration plan | Layer rule honoured; new columns nullable/defaulted; `npx prisma validate` clean | `code-architect` + `senior-reviewer` | `database-prisma`, `architecture-enforcer`, `sql-hardener` |
| **P3 API & Integration** | Route contracts, Zod, auth tiers, integrations | Typed route(s) via `define-route.ts` | Zod on all mutations; org-scoped; `{error,details?}` | `senior-reviewer` + `route-auditor` | `api-testing`, `auth-patterns`, `route-auditor` |
| **P4 AI Integration** | Routing through the provider factory, scoring, guardrails | AI service via `getAIProvider()` | No direct SDK calls; cost guardrails; deterministic fallbacks | `senior-reviewer` + `code-architect` | `lib/ai/model-router.ts`, provider factory |
| **P5 Cloud / Deploy / Infra (AWS/Azure-class)** | Env, crons, build, deploy on the real substrate | `build:vercel` green; cron registered | Build passes; env verified; no secrets committed | `build-engineer` | `build-orchestrator`, `curator-deployment` |
| **P6 Quality & Testing** | Unit/integration/e2e, coverage floors, contract tests | Tests + coverage report | Per-path floors in `jest.worktree.cjs` met; 401→403→400→200 | `qa-sentinel` | `api-testing`, `qa-lead` |
| **P7 Security & Compliance** | The 5 attack surfaces, RLS, secrets, GST/privacy | Security review notes | SSRF/JWT-tier/CORS/org-scope/OAuth-redirect checked; RLS on | `codex-security-auditor` / `senior-reviewer` | `security-hardener`, `curator-security` |
| **P8 SPM Multiple-Eyes Review Gate** | Independent verification before merge | Unified review verdict | No CRITICAL; <3 HIGH; 80%-confidence filter | `chief-reviewer` + specialists; `opus-adversary`; `boardroom` (high-stakes) | §9 |
| **P9 Launch & Human Gate** | Production approval; verification-gate proof | Curl/Jest/Vercel proof + CEO sign-off | Live proof pasted; Vercel "Ready"; founder authorises | **Human (Phill)** | `verification-gate.md`, `production-gate` |
| **P10 Operate & Close-the-Loop** | Observe in prod; register; close to Linear (UNI-2046) | Linear closed; state saved; memory/wiki updated | Captured→grounded→integrated→verified→registered→observed→closed | `senior-pm` + observability | `wiki-ingest`, `.claude/scratchpad/` |

`[VERIFIED]` Each owner exists: phase agents in `.claude/agents/`; skills in `.claude/skills/`;
rules in `.claude/rules/`; CI in `.github/workflows/`.

---

## 6. Capability discovery engine

The instrument that makes this spec "inherently find and discover" features: a
**marketing-agency service-line taxonomy** — every offering a full-service agency sells —
each mapped to a Synthex surface so nothing is silently absent. The taxonomy is the row set of
§7. The v1.0 audit proved the method's failure mode: **a single grep miss over-reports a gap**
(it wrongly marked PDF, sentiment, competitive-intel and GBP-writes as missing/stub). So the
method now requires a **second skeptical pass** before any verdict ships:

1. For each service line, grep the owning `lib/` domain and `app/api/` + `app/dashboard/`
   surface for real implementation vs `TODO`/`FIXME`/`mock`/`stub`/`placeholder`/disabled.
2. Assign **PRESENT** / **PARTIAL** / **MISSING**, citing `path:line`.
3. **Adversary re-check**: for every MISSING/stub verdict, grep wider (sibling dirs, services,
   git log) to disprove it before accepting it. A "missing" verdict that survives a determined
   refutation is real; one that doesn't was a grep miss.
4. Reconcile against git history — a recent commit can contradict a grep miss (e.g. #458
   routed the sentiment analyzer that the first audit declared absent).

---

## 7. Seeded capability matrix (audited 2026-06-16, adversary-corrected)

`Scope`: **v1** = required for Gate A; **v2** = explicitly deferred (§14 Q1).

| # | Service line | Verdict | Scope | Evidence (`path:line`) | Gap note |
|---|---|---|---|---|---|
| 1 | **Content creation** (AI gen, variations, repurpose, calendar, templates, image gen, scoring) | PRESENT `[VERIFIED]` | v1 | `lib/ai/{content-generator,content-repurposer,content-scorer}.ts`, `lib/content/{calendar-service,industry-templates}.ts`, `lib/services/ai/image-generation.ts` | none |
| 2 | **Multi-channel publishing** (9 platforms + scheduled queue + cross-post) | PRESENT `[VERIFIED]` | v1 | `lib/social/*-service.ts`, `lib/publish/platformAdapters/{twitter,facebook}.ts`, `lib/publish/publishQueue.ts` | IG Stories/Reels lack dedicated UI; Twitter uses `postTweet` not base `createPost` |
| 3 | **Video / creative** (script, Remotion, pipeline, social derivation, HeyGen) | PRESENT `[VERIFIED]` | v1 | `lib/video/*`, `lib/remotion/compositions/` (17), `app/api/heygen/video/route.ts` | render quality-gate has no auto-retry |
| 4 | **Automation / autopilot / workflows** | PRESENT `[VERIFIED]` | v1 | `prisma` `WorkflowExecution`/`StepExecution`/`AutopilotRun`, `app/api/cron/autopilot/route.ts`, `app/api/workflows/executions/route.ts` | monitoring UI shallow; `WorkflowTemplate` no builder UI |
| 5 | **SEO / Local / GBP** (rank via GSC, PSI audit, geo, citations, backlinks, E-E-A-T, GBP posts **+ review replies**) | PRESENT `[VERIFIED]` | v1 | `lib/seo/rank-tracker.ts`, `lib/google/search-console.ts`, `lib/seo/pagespeed-service.ts`, `app/api/google-business/posts/route.ts:102`, `app/api/google-business/reviews/[reviewId]/reply/route.ts:80` | **PageSpeed fabricates demo scores** if key/API missing (`pagespeed-service.ts:215`) — honesty fix #9 |
| 6 | **Analytics & reporting** (real-time metrics, benchmarks, forecasting, effect/ROI, **PDF export**) | PRESENT `[VERIFIED]` | v1 | `lib/analytics/{analytics-tracker,benchmark-service,anomaly-detector,trend-predictor}.ts`, `lib/reports/pdf-generator.ts:202` (real jsPDF, wired `app/api/reporting/reports/[reportId]/download/route.ts:98`), `app/api/effect-report/route.ts` | benchmarks static; forecasting linear-only |
| 7 | **Scheduled report delivery** | PARTIAL `[VERIFIED]` | v1 | `lib/analytics/report-builder.ts:703` (cache-only save), `:711` (`sendReport` no-op) — **but** working sender `lib/email/effect-report-email.ts:354` (Resend) + cron exist | wire scheduled path to existing PDF + Resend + add DB table — #1 |
| 8 | **Attribution** | PARTIAL `[VERIFIED]` | v1 | `lib/analytics/analytics-tracker.ts` (UTM), `app/api/effect-report/route.ts` | single-touch only; multi-touch missing — #8 |
| 9 | **Sentiment & social listening** | PRESENT `[VERIFIED]` | v1 | `lib/social/sentiment-analyzer.ts` (via `getAIProvider()`, #458), `app/api/analytics/sentiment/route.ts`, `app/api/listening/{mentions,keywords}`, `app/dashboard/listening/` | surface sentiment score in dashboard — #13 |
| 10 | **Brand & voice** (DNA, voice quality scoring, consistency, **competitive intelligence + content gap**) | PRESENT `[VERIFIED]` | v1 | `lib/brand-dna/extractor.ts`, `lib/brand-voice/quality-scorer.ts`, `lib/brand/consistency-scorer.ts`, `lib/services/competitive-intel.ts` (1228 lines, `identifyContentGaps:575`, DataForSEO) | persona **training loop** incomplete — #11; competitive-intel lacks a UI surface — #12 |
| 11 | **Strategy / planning / campaigns** | PARTIAL `[VERIFIED]` | v1 | real CRUD `app/api/campaigns/route.ts:261` (`prisma.campaign.create` + audit log); `app/api/agents/dispatch-campaign/route.ts`; **but** `lib/marketing-agency/full-campaign-generator.ts:506 generateFullAuthorityCampaign` **unwired** (callers = scripts/tests only); demo route `app/api/marketing-agency/campaigns/route.ts:11` returns mock | wire the authority generator into a route — #2; demo route is mock-only |
| 12 | **PR / media relations** | PRESENT `[VERIFIED]` | v1 | `lib/pr/{press-release-builder,pitch-drafter,distribution-channels,coverage-linker,hunter-enricher,beat-classifier,ai-generator}.ts` | verify client-facing surface/UI |
| 13 | **Email marketing / lifecycle** | PRESENT `[VERIFIED]` | v1 | `lib/email/` (18 modules: `queue.ts`, `email-service.ts`, `effect-report-email.ts`, milestone/monthly/quarterly lifecycle) | not exposed as a publish-queue *channel*; no newsletter-builder UI (verify) — part of #17 |
| 14 | **Landing pages / web / CRO** | PRESENT `[VERIFIED]` | v1 | `lib/landing-page/{page-builder,jsonld-builder,validators}.ts`, `app/api/web-projects/route.ts` (`prisma.project.create`); A/B via `lib/experiments` | CRO/funnel testing partial; verify builder UX |
| 15 | **Approvals & collaboration** | PARTIAL `[VERIFIED]` | v1 | `app/api/approvals/route.ts`, `prisma` `ApprovalRequest`, `app/dashboard/{approvals,collaboration}/` | comments JSON-embedded; no @-mentions/notifications; no SLA enforcement — #10 |
| 16 | **Billing & commercials** (Stripe SaaS subs, usage, dunning, invoices+PDF, GST) | PARTIAL `[VERIFIED]` | v1 | `lib/stripe/*`, `app/api/invoices/route.ts`, `app/api/invoices/[id]/pdf/route.ts` (puppeteer), `lib/billing/plan-access.ts` | **no client-facing/agency invoicing** (#4 partner: #5); no discounts/promos (#18) |
| 17 | **Client / CRM** | PARTIAL `[VERIFIED]` | v1 | primitives exist: `prisma` `Lead:6446`, `DealDeliverable:1661`, `ClientHealthScore:6155`, `ClientEngagementEvent:6214`, `PipelineCostLedger:5751`; org-switch `app/api/businesses/switch/route.ts` + `getEffectiveOrganizationId` `parentOrgId` traversal | no unified `Client`/`Contact` entity or client console — unify, don't build greenfield — #3 |
| 18 | **White-label / agency tier** | MISSING `[VERIFIED]` | v1 | `prisma` `Organization.parentOrgId` + `{logo,primaryColor,customDomain}` (schema only); org-switch infra partial (#17) | no reseller pricing, agency console, branding override, white-label flag, SLA — #5, #6 |
| 19 | **Paid / performance media** (Google/Meta Ads, budget, bidding, ad performance) | MISSING `[VERIFIED]` | **v2** | grep `lib/`+`app/api/` = zero; `google_ads` vault enum never instantiated; Meta = format checks only (`lib/marketing-agency/meta/creative-checks.ts`) | Board decision: build/partner/defer — #7 |
| 20 | **Influencer / UGC management** | MISSING `[VERIFIED]` | **v2** | grep = no real domain (only incidental hits) | scope decision — #14 |
| 21 | **Contracts / proposals / e-sign** | MISSING `[VERIFIED]` | v1 | `sow-draft` skill emits a SOW doc but no in-product e-sign/countersign; grep = no DocuSign/e-sign | runbook stage 3 blocker — #15 |
| 22 | **Digital asset management (DAM)** | PARTIAL `[VERIFIED]` | v1 | `lib/services/visual-asset-manager.ts` + eeat asset routes; no central client-facing asset library | central library + reuse — #16 |

---

## 8. Prioritised gap backlog (Linear-ready)

Ordered by client-revenue impact ÷ effort, re-ranked after the adversary pass (several v1.0
items were already done or half-done). `Eff` S/M/L/XL · `Imp` Low/Med/High · `Phase` per §5.

| Pri | Title | Domain | Eff | Imp | Phase | Agent | Acceptance-criteria stub |
|---|---|---|---|---|---|---|---|
| 1 | **Wire scheduled-report delivery** — point `report-builder` scheduled path at the existing PDF generator + Resend sender; add a DB table for persistence | Reporting (#7) | S | High | P3 | `code-architect`+`qa-sentinel` | Scheduled report survives restart (DB row); email sent via `lib/email/effect-report-email.ts`; cron proof pasted |
| 2 | **Wire the authority-campaign generator** — expose `generateFullAuthorityCampaign` via a real route + persist (it exists, only scripts call it) | Strategy (#11) | M | High | P3/P4 | `code-architect` | A route returns a DB-backed authority campaign (not the mock demo route); integration test |
| 3 | **Unify CRM primitives** — fold `Lead`/`DealDeliverable`/`ClientHealthScore`/`ClientEngagementEvent` into a `Client`/`Contact` entity + client console | CRM (#17) | L | High | P2/P3/P1 | `code-architect`+`senior-reviewer` | Unified client list/detail render real data from existing tables; org-scoped CRUD with Zod |
| 4 | **Agency / client-facing invoicing** — invoice an org's end-clients via Stripe; margin/passthrough | Billing (#16) | L | High | P2/P3 | `code-architect` | Agency issues a client invoice; line items + 10% GST; status workflow; test |
| 5 | **Multi-client agency console + manage-as hardening** — consolidated dashboard; harden the existing org-switch for sub-account delegation | White-label (#18) | M | High | P1/P3/P7 | `code-architect`+`codex-security-auditor` | All sub-clients visible; manage-as switches org context with **403 on cross-org** test |
| 6 | **White-label tier** — branding override + custom-domain verification + plan tier | White-label (#18) | L | Med | P2/P3/P5 | `code-architect`+`build-engineer` | Tenant branding applied; domain DNS-verified; Synthex chrome hidden on white-label plan |
| 7 | **Paid Media — Board decision then phased** — Phase 1 = ad-account OAuth + read-only performance; budget/bidding later | Paid (#19) | XL | High | P0/P3/P4 | `ceo-board`→`senior-pm`→`code-architect` | **Board decision first** (build/partner/defer); if build, Phase 1 = OAuth + perf read |
| 8 | **Multi-touch attribution** — first/last/linear/time-decay | Attribution (#8) | M | Med | P4 | `code-architect` | Effect report exposes ≥2 models; documented assumptions; synthetic-journey test |
| 9 | **PageSpeed honesty** — remove demo fallback; surface "data unavailable" | SEO (#5) | S | Med | P6/P7 | `senior-reviewer` | No fabricated 85/95 when key/API missing; UI states unavailability |
| 10 | **Approvals collaboration** — comments API, @-mentions, notifications, SLA reminders | Approvals (#15) | M | Med | P3/P1 | `code-architect` | Threaded comments persisted; mention notifies; due-date reminder fires |
| 11 | **Brand persona training loop** — refinement + feedback (competitive-intel already exists) | Brand (#10) | M | Med | P4 | `code-architect` | Persona updatable from feedback; voice samples feed the scorer |
| 12 | **Competitive-intel UI surface** — expose the existing 1228-line engine + content-gap report | Brand/SEO (#10) | S | Med | P1 | `code-architect`+`ui-ux` | Content-gap + benchmark report rendered in dashboard from `competitiveIntel` |
| 13 | **Surface sentiment + listening** — expose existing sentiment score & mentions in audience UI | Analytics (#9) | S | Low-Med | P1 | `code-architect` | Sentiment + listening visible in dashboard; reads existing services |
| 14 | **Influencer / UGC management** — scope decision then build (v2) | Influencer (#20) | L | Med | P0/P2/P3 | `senior-pm`→`code-architect` | Scope decided (§14 Q1); if in, creator records + UGC intake workflow |
| 15 | **Contracts / proposals / e-sign** — in-product e-sign for SOW/MSA (runbook stage 3) | Contracts (#21) | M | Med | P2/P3 | `code-architect` | SOW/MSA countersigned in-product; signed artefact stored; ties to runbook stage 3 |
| 16 | **Central DAM** — client-facing asset library on `visual-asset-manager` | DAM (#22) | M | Low-Med | P2/P3 | `code-architect` | Central, org-scoped asset library with reuse across content |
| 17 | **Publishing polish** — IG Stories/Reels UI; email-as-channel in queue; Twitter `createPost` parity | Publishing (#2,#13) | M | Low | P1/P3 | `code-architect` | Story/Reel scheduling UI; email channel in publish queue; Twitter conforms to base interface |
| 18 | **Discounts / promo codes** — coupon model + checkout application | Billing (#16) | S | Low | P3 | `code-architect` | Promo reduces Stripe checkout; usage capped; test |
| 19 | **Retire the remaining report stub** — `report-generator.ts:471 generatePDFContent` (the actual stub, distinct from #6) | Reporting (#6) | S | Low | P3/P6 | `code-architect` | `generatePDFContent` delegates to the real `pdf-generator` or is removed |

`[INFERENCE]` #1–#2 make existing strengths sellable; #3–#6 build the agency operating layer;
#7 is the v2 bet; #8–#19 harden, surface already-built engines, and close the genuine gaps.

---

## 9. Multiple-eyes review model

The "Senior-Project-Manager tested, multiple eyes" gate — reused verbatim, not invented.
`[VERIFIED]` agents in `.claude/agents/`.

**Flow per change:** `senior-pm` (intake, scope, Linear) → orchestrator dispatch → build by
specialist (`code-architect` / domain skill) → **review fan-out**: `senior-reviewer`
(correctness/auth/arch) + `qa-sentinel` (tests/coverage) + `codex-security-auditor` (security,
when surfaces touched) → `chief-reviewer` unifies (blocks on CRITICAL or 3+ HIGH) →
`opus-adversary` pressure-test (default pre-merge on non-trivial) + `boardroom`/`ceo-board`
(strategic, e.g. Paid Media #7) → `verification-agent` runs the gauntlet → **P9 human gate
(Phill)** for production.

**Severity model** (`senior-reviewer`): **Blocker** (security/correctness) · **Warning**
(quality) · **Suggestion** (improvement). **80%-confidence filter** (`chief-reviewer`): drop
findings below 80% confidence.

**Binding rule** (`fabel-evidence-standard.md`): a subagent's "green" is `[UNCONFIRMED]` until
the orchestrator re-runs the gauntlet on the integrated tree. **This is not theoretical — the
`opus-adversary` pass on this very spec corrected three matrix verdicts the v1.0 audit got
wrong** (§13). Audits over-report; the adversary lens is what catches it.

---

## 10. Operating runbook (run Synthex as an in-house agency)

The ops layer that satisfies **Gate B**. Each stage names the surface + skill that powers it.
`[VERIFIED]` skills exist; ⛔ marks a stage a v1 gap still blocks.

| Stage | What happens | Surface / skill | Status |
|---|---|---|---|
| **1. Lead & discovery** | Qualify, capture goals, ICP, **+ measurement/KPI plan** | `discovery-12q`, `marketing-icp-research`, `marketing-analytics-attribution` | Ready |
| **2. Scope** | Milestone SOW; ABN/GST verified | `sow-draft` → `sow.json` | Ready |
| **3. Contract & sign** | Countersign MSA/SOW before any delivery | in-product e-sign | ⛔ #15 (today: out-of-band) |
| **4. Onboard** | Linear project + Supabase portal + intake bot + welcome email | `client-portal-provision` | Ready |
| **5. Billing setup** | Deposit + milestone invoices, GST | `stripe-milestone-invoice` | Ready (own-client); ⛔ end-client billing #4 |
| **6. Brand capture** | Voice + DNA + consistency + competitive baseline | `lib/brand-dna`, `brand-voice`, `competitive-intel` | Ready (persona loop #11) |
| **7. Deliver — content/social** | Plan → write → schedule → publish (9 platforms) | `marketing-orchestrator`, `lib/social`, autopilot | Ready (authority-campaign route #2) |
| **8. Deliver — SEO/local** | Audit, rank track, GBP posts + review replies, citations | `seo`, `lib/seo`, `lib/gbp` | Ready (PageSpeed honesty #9) |
| **9. Deliver — PR & email** | Press releases, pitches; lifecycle/newsletter sends | `lib/pr`, `lib/email` | Ready (email-as-channel polish #17) |
| **10. Deliver — video & web** | Script→render→derive cuts; landing pages | `video-director`, `lib/video`, `lib/landing-page` | Ready |
| **11. Approve** | Editorial + brand gate before client-visible | approvals engine, `qa-lead`, `brand-guardian` | Ready (collab #10) |
| **12. Report** | Performance + ROI, client-visible, scheduled | `lib/reports` (PDF), `lib/analytics` | ⛔ scheduled delivery #1 |
| **13. Retain & retro** | Weekly digest; campaign retrospective / win-loss | `client-retention`, retro template (`marketing-analytics-attribution`) | Ready (retro wiring) |

**Roles:** Founder (P9 human gate) · `senior-pm` (intake/scope/Linear) · orchestrator
(dispatch) · senior agents (architect/qa/build/reviewer) · minions (skill bundles) ·
`brand-guardian` (editorial gate) · `qa-lead` (ship gate).

**SLAs (proposed `[UNCONFIRMED]`):** social post ≤2 business days; SEO audit ≤5; video ≤7;
approval response ≤1; monthly report by the 3rd. Confirm with Phill (§14 Q3).

---

## 11. Data-model notes

`[VERIFIED]` **216** Prisma models (`rg -c "^model " prisma/schema.prisma` = 216). Note: the
CONSTITUTION/`control-plane.md` figure of 201 is **stale drift** — flag for update, do not
change CONSTITUTION here. Backlog implies **new/extended** models — all **nullable or
defaulted**, applied via Supabase `apply_migration`, never `prisma db push` (hard rule):

- `Client` / `Contact` (backlog #3) — *unify* the existing scattered primitives (`Lead`,
  `DealDeliverable`, `ClientHealthScore`, `ClientEngagementEvent`, `PipelineCostLedger`),
  do not duplicate them.
- `ScheduledReport` persistence row (#1); `ClientInvoice`/passthrough (#4).
- `ResellerPlan` + `WhiteLabelConfig` (#6); `SignedDocument` (#15); `PromoCode` (#18).
- `ApprovalComment` table to replace JSON embedding (#10).
- `AdAccount`/`AdCampaign`/`AdMetric` (#7) — only if the Board approves the build path.

Never drop/rename/type-change existing columns without explicit CEO approval. `npx prisma
validate` before any change.

---

## 12. Security & cost guardrails (structural)

`[VERIFIED]` Honour the 5 attack surfaces on every new route (P7): `validateExternalUrl`
(SSRF), `resolveVerifiedTier` (JWT tier elevation), `CORS_ORIGIN` exact-match, Prisma
`organizationId` scoping (cross-org bypass), `returnTo` validation (OAuth open redirect). New
tables RLS-enabled. Secrets in Vercel dashboard only — never committed, never logged. **The
multi-client "manage-as" (#5) is the highest-risk addition** — cross-org context switching must
be org-scope-tested (403 on cross-org) and audited; the existing `businesses/switch` route is
the surface to harden, not a greenfield.

**Cost:** AI calls route through `getAIProvider()` — never direct SDK (commits #458/#460).
Loop/agent work runs on the Anthropic Max plan, not metered API. External SEO providers
(DataForSEO, PSI, OpenPageRank) are quota-bound — gate by plan and cache; **never fabricate
data when a quota is exhausted** (the PageSpeed demo fallback, #9, violates this today).

---

## 13. Risk & assumption register

| Tag | Item | Mitigation |
|---|---|---|
| `[VERIFIED]` lesson | **v1.0 audit over-reported gaps** — wrongly flagged PDF export, sentiment, competitive-intel, GBP-writes as missing/stub; the `opus-adversary` pass caught all four against code | §6 now mandates an adversary re-check on every MISSING/stub verdict before it ships |
| `[VERIFIED]` risk | **Scheduled-report delivery stub** (`report-builder.ts:703,711`) — but PDF gen + Resend + cron exist | #1 (small) wires them; until then no recurring client reports |
| `[VERIFIED]` risk | **Authority-campaign generator unwired** — real but only scripts call it | #2 wires it; the *demo* route stays mock and must not be sold |
| `[VERIFIED]` risk | **PageSpeed fabricates demo scores** (`pagespeed-service.ts:215`) | #9 removes the fallback |
| `[VERIFIED]` constraint | §1/§8 **Paid Media contradiction** resolved by scoping it **v2** | Finish line is now "organic+owned v1"; Board decides build/partner/defer (#7) |
| `[VERIFIED]` risk | New CRM/white-label/manage-as touch multi-tenancy — cross-org leakage | P7 + #5 org-scope 403 tests are blocking |
| `[VERIFIED]` drift | Model count: actual **216**, CONSTITUTION says 201 | Flag CONSTITUTION update; spec uses verified 216 |
| `[UNCONFIRMED]` | PR/email/landing **client-facing UI** depth not fully audited | Verify surfaces during #12/#17 |
| `[UNCONFIRMED]` | Proposed **SLAs** (§10) | Confirm with Phill (§14 Q3) |
| `[INFERENCE]` | Paid Media is XL; may be better partnered than built | Board (#7) before any code |

---

## 14. Open questions (≤5)

1. **v2 scope:** Paid Media — build native (Google/Meta Ads), integrate a partner, or defer?
   And is Influencer/UGC (#14) in or out? (these define the v1↔v2 line in §7)
2. **Agency model:** priority = Unite's *own* in-house delivery, or productising a white-label
   tier for *external* agencies? (re-weights #3–#6 vs #1–#2)
3. **SLAs:** are the §10 proposed turnaround times right?
4. **Reporting substrate:** the PDF generator (jsPDF) and an invoice PDF path (puppeteer) both
   exist — standardise on one for #1, or leave both?
5. **v1 scope cut:** any §7 **v1** row we explicitly exclude from Gate A v1 so "ready" is
   achievable sooner (e.g. DAM #22, e-sign #21)?

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

**Per-backlog-item live proof** (the real acceptance — one command per item, not optional):
- #1 scheduled report → DB row persists across restart **and** a test email is received.
- #2 authority campaign → route returns a DB id, not the mock fixture.
- #5 manage-as → cross-org `GET` returns **403**.
- #9 PageSpeed → with key removed, response states "unavailable" (no 85/95).
- #19 → `generatePDFContent` no longer returns a placeholder string.
Each remaining backlog item ships with its own one-line proof command in its child spec.

**Gate B — operating runbook dry-run:** onboard one test client end-to-end through §10 stages
1–13; each stage must produce a **real** artefact (Linear project, `sow.json`, **signed**
contract, Stripe invoice, a published post with a platform URL, a client-visible PDF report).
A mock/placeholder artefact **fails** the stage. Capture the artefact id/URL per stage.

**Spec-of-record verification (this document):** all sections present; no `TBD`/`TODO`; every
factual/matrix/backlog line tagged; every PRESENT/PARTIAL row cites a path; every
`[UNCONFIRMED]` appears in §13; the `opus-adversary` pass is complete and its findings folded
in (done — v1.1); backlog is Linear-ready and #1 is ready to spawn a child spec.
