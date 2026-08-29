# Intelligence Loop — build-ready spec

> Produced by `fable-engine` on the founder's brief: _"a system that can look at
> the Business Personas, then look at competitors, see what they might be doing,
> take inspiration from Influencers and posts getting millions of views, find and
> identify the reasons for success so we can iterate and design known winners
> autonomously."_
>
> Evidence tags per `.claude/rules/fabel-evidence-standard.md`. Every claim below
> is `[VERIFIED]` against source unless marked otherwise.

---

## 1. Finish line

**Done when** a `/design` run for a portfolio brand opens with a sourced,
evidence-tagged **Signal Brief** — persona + competitor + performance signal —
and at least one of the N variations is designed against a **named, falsifiable
hypothesis** drawn from that brief, with its kill threshold recorded in the
run manifest.

Rejected finish lines:

- _"Done when the engine autonomously designs known winners."_ Not testable.
  "Winner" is unmeasurable until something publishes and performs, and no
  outcome data exists yet (§8). As a finish line it can only be asserted.
- _"Done when the system reports why competitors' posts succeed."_ Testable only
  as "produces prose" — the exact failure mode where a confident machine
  manufactures rationalisations.

---

## 2. Decision up front

**This is not a build. It is four disconnections in a system that already
exists — and the fourth one dominates the other three.**

**Break #0, discovered against the live production database: nothing has ever
been published through this system.** `platform_posts` = **0 rows**.
`platform_metrics` = **0 rows** — not one impression, view, reach or engagement
figure has ever been recorded from a live social platform. `auto_research_runs`,
`trend_insights`, `marketing_agency_signals`, `marketing_agency_opportunities`
are all **0**. `image_generations` = **3 rows**, against a
`MIN_SAMPLE_FOR_RATES = 5` floor, so `groundedWinRate` has never once returned a
number. Follower counts on the connected accounts are **2 on YouTube, 3 on
Twitter, 1 on Reddit**. `[VERIFIED — read-only SELECT against project
znyjoyjsvjotlzjppzal]`

The hourly `analytics-sync` cron is running correctly today (`last_sync`
2026-08-29 00:00:14) and finds nothing, because there is nothing to fetch
metrics _for_. Roughly a dozen downstream modules — `insights-agent`,
`health-score-calculator`, `report-builder`, `weekly-digest`,
`forecasting/collect-training-data` — are reading an empty table and reporting
confidently on zeroes. `[VERIFIED]`

**This reframes the brief.** "Identify the reasons for success so we can design
known winners" presumes a corpus of outcomes to learn from. There is none, and
none can exist until something ships. A more sophisticated intelligence layer
built now would be a roof without walls.

There is one real exception, and it matters: **Google telemetry does flow.**
`gsc_snapshots` holds 1,167 rows across three months (406 impressions, 42
clicks); `follower_snapshots` 229 rows. Small, but genuinely live — the pipes
are proven, the audience is not yet there. `[VERIFIED]`

The loop the brief describes is largely present in this repo: `AutoResearchRun`

- `TrendInsight` models, 19 files under `lib/auto-research/` including
  `trend-analyzer.ts`, `prompt-optimizer.ts`, `research-bridge.ts` and
  `scheduler.ts`, an Apify client, three test files, a dashboard widget, and a
  governed `signal-ledger` that converts insights into reviewable
  `MarketingAgencyOpportunity` records. `TrendInsight` already carries
  `confidence`, `dataPoints`, `validUntil` and `applied` — the precise discipline
  this kind of system needs, already designed in. `[VERIFIED]`

It does not work end to end because of three independent breaks, each small:

1. **Persona knowledge is unreachable at runtime.** The rich per-brand audience
   definitions live as prose in `.claude/memory/ceo-foundation.md`. CARSI's
   §3.3.2 starts at character **225,736** of a 276,516-character file. Both
   loaders truncate far earlier — `SNIPPET_MAX_CHARS = 12_000`
   (`lib/agency/foundation-context.ts:15`) and
   `DEFAULT_FOUNDATION_CHAR_BUDGET = 8_000`
   (`lib/ai/skills/skill-compiler.ts:20`). No runtime path can see any
   Phase 3.X.2 section. `[VERIFIED]`
   Meanwhile `BrandDNA.persona` is `{}` for all four seeded brands, because
   `npm run seed:brands` → `prisma/seed-brand.ts` never writes the column;
   `scripts/seed-brand-dna.ts` **does** hold real personas but is not wired into
   `package.json`; and `composeClientFromBrandDna`
   (`lib/ai/prompt-layer-builder.ts`) does not select `persona` anyway. Three
   independent breaks in one chain. `[VERIFIED]`
2. **Trend insights only reach the forbidden code path.**
   `getVisualStyleInsights()` is called at `lib/services/ai/image-generation.ts:1057`,
   inside the `ESCAPE HATCH (useReferences === false)` branch that begins at
   line 1001. The grounded path returns at lines 979/986, before it. So trend
   signal enriches prompts **only when grounding is off** — the path
   `.claude/rules/real-images-only.md` forbids for brand surfaces. `[VERIFIED]`
3. **The research loop is never triggered.** `vercel.json` has 55 cron entries;
   none is auto-research. `lib/auto-research/scheduler.ts` has no caller outside
   itself. `[VERIFIED]` (`/api/competitors/track/execute` **does** run every 30
   minutes — competitor tracking is already live. `[VERIFIED]`)

**Recommendation: fix the three breaks first (Phase 0), then compose the Signal
Brief (Phase 1) and add hypothesis discipline (Phase 2). Do not build a new
intelligence system.** Phase 0 is days of work against an existing, tested
codebase and delivers most of the brief's value. A parallel new system would
duplicate `TrendInsight`, `signal-ledger` and the governed-opportunity flow, and
this repo's documented failure mode is exactly that — producers nothing reads.

---

## 3. Goals & non-goals

**Goals**

- Persona knowledge reachable by runtime code, not only by an agent grepping a file.
- One `SignalBrief` a design run can read, assembling persona + competitor +
  performance signal with per-item provenance and confidence.
- Every signal-derived design decision carries a falsifiable hypothesis and a
  kill threshold.
- Trend signal reaches the **grounded** generation path.

**Non-goals — explicitly out of scope**

- **Autonomous publishing.** Publishing stays behind the human approval gate.
  Nothing here changes that.
- **The phrase "known winners".** Nothing in this system may describe an
  untested design as a winner. See §8.
- **Scraping competitor or influencer platforms.** See §7 — this is a legal
  decision, not a technical one, and the recommendation is not to.
- **A new insights table.** `TrendInsight` already exists with the right shape.
- **Causal claims.** The system proposes hypotheses; only a run of the founder's
  own content can promote one to a finding.

---

## 4. Approach, in plain language

Today the design engine knows a brand's colours, fonts and voice, and nothing
about who it is talking to or what has worked. Everything needed to change that
is already in the repo but disconnected at three points.

Reconnect them, then add one new thing: a **Signal Brief** — a small, cited
document assembled per run that answers three questions with provenance
attached:

- **Who is this for?** From the brand's persona (Phase 0 makes this readable).
- **What is the category doing?** From competitor tracking, already running.
- **What has performed?** From `TrendInsight` and, when it exists, the brand's
  own platform metrics.

The design engine reads the brief at §2 and must name, in the manifest, which
signal drove which variation — and what result would prove it wrong.

The last part is the whole discipline. A brief that says _"carousels outperform
static for this audience"_ is worthless as a finding and valuable as a
hypothesis: **variation 2 tests it; if it does not beat the static control by
the stated margin within the stated window, the hypothesis is dead and gets
recorded as dead.** That is the difference between a learning system and a
machine that rationalises.

---

## 5. Phased plan

### Phase −1 — Ship one post (blocks everything downstream)

Not a feature. The loop cannot learn from an empty table, and every phase below
either depends on outcome data or is worth far less without it.

Publish one real post through the existing approval-gate flow so
`platform_posts` and `platform_metrics` receive their first rows, and the dozen
consumers reading zeroes get something true to read. Note the platform
constraint: `ingestConnectionPostMetrics` acts on **Instagram and LinkedIn
only** (`ANALYTICS_INGEST_PLATFORMS`), and Instagram is **not** among the 35
active connections — so LinkedIn is the only viable first target today.
`[VERIFIED]`

**DoD:** `select count(*) from platform_metrics` returns ≥ 1, and the value is
a real figure from a live platform.

**This is the founder's call, not an engineering task** — it needs something
worth publishing and the approval gate walked end to end. Everything below is
cheaper and more useful once it is done.

### Phase 0 — Reconnect what exists

**0a. Make persona reachable.**

- Wire `scripts/seed-brand-dna.ts` into `package.json` and reconcile it with
  `prisma/seed-brand.ts` — they currently disagree on CARSI's voice
  (`boldness: 2` vs `formality: 3, boldness: 4`) and only one writes `persona`.
  Whichever runs last wins today. `[VERIFIED]`
- Add `persona` to the field selection in `composeClientFromBrandDna`
  (`lib/ai/prompt-layer-builder.ts`).
- Add a section-addressed reader for `ceo-foundation.md` so a caller can request
  §3.3.2 specifically instead of receiving the first 8–12k characters.
  `skill-compiler.ts:20`'s own comment anticipates this ("so it can ask for a
  specific section instead of silently reasoning from a truncated document");
  nothing implements it. `[VERIFIED]`
- **Schema mismatch to resolve:** foundation personas are
  `{functional jobs, emotional jobs, trigger moments}`; `BrandDNA.persona` is
  `{ageRange, values, painPoints, description}`. They do not map.
  `scripts/seed-brand-dna.ts` works around it by inventing `audienceSegments`
  and flattening JTBD into `painPoints`. Pick one shape. `[VERIFIED]`

**DoD:** `prisma.brandDNA.findUnique({where:{organizationId}})` returns a
non-empty `persona` for all four portfolio brands, and a unit test asserts the
prompt layer includes it.

**0b. Move trend signal onto the grounded path.** Call `getVisualStyleInsights()`
before the grounded/escape-hatch branch so both paths receive it, or call it
inside `runGroundedFlux`. Keep the `confidence >= 0.7` and `validUntil` filters
exactly as they are — they are correct.

**DoD:** a test proving a grounded generation with a matching `TrendInsight` row
carries the enriched prompt. This is the guard that stops break #2 recurring —
note it has already regressed once, per the `SYN-MCP-003` comment at
`image-generation.ts:1053`. `[VERIFIED]`

**0c. Decide whether auto-research runs at all.** It cannot be scheduled until
§7 is settled, because its only ingestion path is Apify scraping. **This is the
gate, not a task.**

### Phase 1 — The Signal Brief

A pure compose function, `buildSignalBrief(brandSlug, ctx)`, returning persona +
competitor summary + ranked `TrendInsight` rows, each item carrying
`{source, confidence, dataPoints, retrievedAt, evidenceTag}`. Read by
`synthex-design` §2. No new table — it is assembled per run and embedded in the
existing manifest.

**DoD:** `/design ... | brand: carsi` prints a brief citing every source by path
or URL, and the manifest contains it.

### Phase 2 — Hypothesis discipline

Extend the run manifest with a `hypotheses[]` block:
`{id, claim, source_signal, variation, predicted_effect, kill_threshold, window, status}`
where `status ∈ untested | supported | dead`. A variation may only cite a signal
if it also names a kill threshold. Dead hypotheses are recorded, never deleted —
they are the most valuable rows in the system.

**DoD:** the run refuses to mark a variation signal-driven without a threshold.

### Phase 3 — Close the loop (blocked)

Only once real platform metrics flow (§8). Join `hypotheses[]` to
`PlatformMetrics` via `PlatformPost`, promote or kill each, and bias one of N
future variations toward supported hypotheses — the explore/exploit rule the
design skill currently and correctly says it does **not** have.

---

## 6. Data model

**No new tables in Phases 0–2.** `TrendInsight` and `AutoResearchRun` already
exist with the right shape; `PlatformMetrics` already has
`likes/shares/comments/views/reach/impressions/clicks/saves/engagementRate`.
`[VERIFIED]`

Phase 3 may need a `DesignHypothesis` table. If so: create-only migration with
`IF NOT EXISTS`, `organizationId` NOT NULL, RLS enabled — then **stop**.
Production DDL is founder-gated
(`.claude/rules/database/supabase-migrations.md`); an agent authors and proves
it, and does not apply it. `npm run db:push` is hard-blocked. `[VERIFIED]`

---

## 7. Security, legal & cost guardrails

**The scraping question is the one real decision in this spec.**

`.env.example` already declares
`APIFY (SOCIAL MEDIA SCRAPING) — For Auto-Research self-learning loop (scrapes
Instagram, TikTok, LinkedIn, Twitter/X, Facebook, Google)`. `[VERIFIED]`

External facts:

- **TikTok Research API excludes commercial entities.** Applicants must be
  "independent from commercial interests and be able to conduct research on a
  not-for-profit or non-commercial basis", affiliated with academic or
  not-for-profit institutions. `[VERIFIED]` —
  https://developers.tiktok.com/products/research-api/
- **Instagram's official APIs are not a competitive-intelligence tool.**
  Business Discovery returns a narrow public field set, is rate-capped per
  account per week, and cannot retrieve competitor engagement or follower data.
  `[VERIFIED — vendor sources, consistent across several]`
- **Scraping public data is not a CFAA violation, but it is a contract
  breach.** In _hiQ v. LinkedIn_ the Ninth Circuit held scraping public data
  likely is not "access without authorization" under the CFAA (2022) — and
  LinkedIn then **won on breach of contract**, ending in a **$500,000 judgment
  and a permanent injunction** against hiQ. `[VERIFIED]`

**Why that matters structurally here:** Synthex holds authenticated
`PlatformConnection` OAuth grants to these same platforms in order to publish.
Holding an account means having accepted its terms. Scraping those platforms
from the same operational identity risks the **publishing capability itself** —
the product — not merely the intelligence feature. An account termination would
cost far more than the signal is worth.

**Recommendation — signal sources, in priority order:**

1. **First-party performance data.** The brand's own `PlatformMetrics`. It is
   the only causally attributable signal about _this_ audience, and it is
   already licensed by definition.
2. **Licensed commercial data — but note Semrush is NOT integrated.** An
   earlier draft of this spec said it was; that was wrong. Semrush exists only
   as an agent-session MCP tool surface (`mcp__Semrush__*`) plus a set of
   `DATA_REQUIRED` comments in `lib/marketing-intelligence/`. There is no
   `SEMRUSH_API_KEY` in `.env.example`, no client and no route — **nothing in
   the product can call it.** The same is true of Higgsfield's
   `virality_predictor`. `[VERIFIED]`
   What _is_ real is `lib/social/competitor-fetcher.ts` (443 lines) — genuine
   `fetch()` calls to Twitter Bearer, Instagram Business Discovery, YouTube
   Channels, Facebook Page and Reddit public endpoints — plus
   `lib/services/competitive-intel.ts` (1,225 lines). **This is a legitimate
   official-API path to competitor signal that needs no scraping at all.**
   `/api/competitors/track/execute` is scheduled every 30 minutes, though
   `CompetitiveAnalysis` currently holds 0 rows and `TrackedCompetitor` 3.
   `[VERIFIED]`
3. **Apify scraping — only with explicit founder sign-off**, and never from an
   identity that holds publishing OAuth. Treat as a separate legal decision with
   its own risk acceptance recorded in `verification-gates.md`.

**Other guardrails:** every `TrendInsight` is `organizationId`-scoped and the
CCW L1–L9 carve-out applies — CCW is a client, outside the Nexus; its signal
must never pool with portfolio brands. Competitor trade dress remains banned by
`synthex-design` §10; `anti_references` records what a brand must not resemble.
"Take inspiration from" and "reproduce a competitor's look" must be separated
mechanically, not by good intentions.

---

## 8. Risk & assumption register

| #   | Item                                                                                                                                                                                                                                                                      | Tag                                                                             | Mitigation                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **No outcome data has been proven to exist.** Writers exist (`ingest-post-metrics.ts:227`, `social-webhook-handlers.ts:345`, integrations sync) but the CARSI campaign's `quality-gate.json` carries **30** `peer_data_waiting_for_oauth_or_platform_analytics` warnings. | `[VERIFIED]` warnings; `[INFERENCE]` that the table is empty — prod not queried | Phase 3 is explicitly blocked on this. Verify by querying `platform_metrics` before planning it.                                                     |
| R2  | Correlation presented as cause. A view count never explains itself.                                                                                                                                                                                                       | `[UNCONFIRMED]` by nature                                                       | Phase 2 hypothesis discipline is the entire mitigation. No signal may be stated as a finding.                                                        |
| R3  | Scraping costs the publishing capability                                                                                                                                                                                                                                  | `[VERIFIED]` legal precedent                                                    | §7 — do not scrape from the publishing identity.                                                                                                     |
| R4  | `BrandDNA.persona` and foundation personas have incompatible shapes                                                                                                                                                                                                       | `[VERIFIED]`                                                                    | Phase 0a picks one shape before any consumer is written.                                                                                             |
| R5  | Two seed scripts disagree on CARSI's voice; last writer wins                                                                                                                                                                                                              | `[VERIFIED]`                                                                    | Phase 0a reconciles them.                                                                                                                            |
| R6  | `customer-insights-lead` cites "Phase 3.1.2"; no such heading exists (RA's is §3.2)                                                                                                                                                                                       | `[VERIFIED]`                                                                    | Fix the reference, or an agent quoting "verbatim" quotes a summary line instead of the source.                                                       |
| R7  | Break #2 has regressed before (`SYN-MCP-003`: a provider id was passed where a platform was expected, so no row ever matched)                                                                                                                                             | `[VERIFIED]`                                                                    | Phase 0b ships with a regression test, not just a fix.                                                                                               |
| R8  | Apify actor availability and pricing not verified                                                                                                                                                                                                                         | `[UNCONFIRMED]`                                                                 | Out of scope until §7 is decided. Note the doc itself records a `402 x402-payment-required` and a missing token — it has never run. `[VERIFIED]`     |
| R9  | **`gbp_snapshots` writes 282 rows with all metric columns NULL** — a silent-failure bug producing the appearance of telemetry                                                                                                                                             | `[VERIFIED]`                                                                    | Fix before any consumer trusts GBP data. Rows that look like data and contain none are worse than no rows.                                           |
| R10 | `lib/algorithm/algorithm-context.ts` **hand-duplicates** the markdown knowledge base as a TS constant with no build step linking them                                                                                                                                     | `[VERIFIED]`                                                                    | Drift is silent and undetectable. Either generate the constant from the markdown or add a hash check like `hermes-skill-check`.                      |
| R11 | `lib/services/pattern-scraper.ts` is a hardcoded `return []` behind two API routes and a dashboard page; its type is literally named `MockContent`                                                                                                                        | `[VERIFIED]`                                                                    | Either wire it or delete it. A dashboard over an empty array reports success while showing nothing.                                                  |
| R12 | `lib/analytics/trend-predictor.ts` (1,037 lines of real maths) has two stubbed external feeds, and its only live query targets a **legacy Supabase** (`LEGACY_PLATFORM_URL`), not the Prisma DB — a second data lineage                                                   | `[VERIFIED]`                                                                    | Resolve which database is authoritative before trusting any forecast.                                                                                |
| R13 | Campaign quality gates **passed at 95/100** while every social slot carried `peer_data_waiting_for_oauth_or_platform_analytics` — 30 warnings across two campaigns                                                                                                        | `[VERIFIED]`                                                                    | The gate detected the total absence of outcome data and downgraded it to a warning. Missing outcome data should block a performance claim, not warn. |

---

## 9. Open questions

1. **Do we scrape at all?** (§7) Recommendation is no — first-party plus
   licensed only. This gates Phase 0c.
2. **Which persona shape wins** — foundation JTBD (functional/emotional jobs,
   trigger moments) or `BrandDNA.persona` (ageRange/values/painPoints)? The
   foundation shape is richer and human-authored; the DB shape is what code
   reads.
3. **What ships first, and to which platform?** `platform_metrics` is answered —
   it is empty, and LinkedIn is the only connection the ingest path supports
   today. The open part is what is worth publishing, and when.
4. **Is `ceo-foundation.md` the right home for personas at 276KB**, or should
   Phase 0a extract them into per-brand files the way `<slug>.claims.md` was
   extracted for claims?
5. **Does CCW participate?** It is outside the Nexus with an L1–L9 carve-out;
   its signal must not pool with portfolio brands.

---

## 10. Verification plan

Phase 0:

```bash
npm run seed:brands
node -e "require('@prisma/client');" # sanity
npx prisma validate
npx jest --config config/jest/jest.worktree.cjs tests/unit/auto-research/ tests/unit/ai/
npm run type-check && npm run lint && npm test
```

- Assert `BrandDNA.persona` is non-empty for `carsi`, `dr`, `nrpg`, `restoreassist`.
- Assert a grounded `generateImage()` call with a matching `TrendInsight`
  (`confidence >= 0.7`, unexpired) carries the enriched prompt — the regression
  guard for R7.

Phase 1–2:

```
/design instagram_post for CARSI CEC courses | brand: carsi | n: 3
```

- The run prints a Signal Brief citing every source by path or URL.
- `manifest.hypotheses[]` is present; every variation claiming a signal has a
  `kill_threshold` and a `window`.
- A variation citing a signal **without** a threshold fails the run.

Per Fabel directive 5, none of the above is done until its tool output says so.

---

`[STATUS] gate: awaiting approval`
