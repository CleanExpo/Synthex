# North Star — the multi-sector results engine

> **fable-engine spec · 2026-08-29.** Founder brief: Synthex becomes the
> provider that gets measurable results — paid customers, web traffic,
> recognition, influencer reach, industry standards — across multiple
> industries and sub-markets, each with its own personas and per-sector
> delivery; operational mastery of E-E-A-T / Google algorithms / SEO / AEO /
> GEO / Semrush; a second-brain store; senior + sub agents pulling and storing
> data; missing connectors, skills and hooks wired into a loop. Founder
> instruction: treat this framing as the foundation, not the ceiling — name
> the gaps it misses.
>
> Research: source channel (repo substrate map, 29-system inventory),
> prior-work channel (the merged intelligence-loop spec, which this composes
> with and does not re-litigate), web channel (all sources 2026, links
> inline), and two senior-board lenses channelling the repo's 15+yr skill
> personas against the foundation and gate registry. Evidence Standard
> applies: every claim is tagged.

---

## 1. Finish line

**Done when a named non-restoration sector goes from zero to a published,
sector-personalised content programme whose every claim is register-backed,
whose performance is measured against pre-declared thresholds from live GSC +
platform (+ Semrush, if funded) data stored in the second brain, and whose
loop — research → persona → produce → publish → measure → learn — runs
without rediscovering anything a previous sector already learned.**

Rejected finish lines: "all connectors wired" (infrastructure without proof);
"first content-attributed paid customer" (right ambition, wrong test — the
attribution window makes it ~December 2026 at the earliest `[INFERENCE —
30–90-day B2B consideration from data starting 2026-08-29]`; it is Phase 5's
DoD, not the spec's gate).

---

## 2. Decision up front

**This is a repair-and-connect programme, not a build programme.** The
founder's list maps, item for item, onto systems that are already authored in
this repo and dead:

| Founder asked for             | Already exists                                                                                                                                                           | State                                                                                                                                                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Second-brain / wiki           | pgvector knowledge graph — retrieval with fusion scoring + citations (`lib/knowledge-query.ts:96,183,257`), builder with 6 extractors (`lib/knowledge-graph/builder.ts`) | `[VERIFIED]` Live tables exist in prod with pgvector, **0 rows** (read-only SQL, 2026-08-29). Write path throws on `builder.ts:16` (`noop-client`). Schema absent from `prisma/schema.prisma`. Scheduler is a comment naming an edge function that does not exist. |
| Per-sector personas           | `lib/industries/taxonomy.ts` — 882 lines, ~34 verticals, each with `targetAudiences[]` (`:41`) and full `aiPersona` (`:56-70`)                                           | `[VERIFIED]` **Zero importers** repo-wide. Finished and orphaned.                                                                                                                                                                                                  |
| Data-pulling agents in a loop | `lib/auto-research/orchestrator.ts` (writes `TrendInsight`), `lib/marketing-intelligence/*` (12 scoring models, GSC adapter)                                             | `[VERIFIED]` Neither has an ignition: no cron among the 55 for auto-research (BullMQ worker not deployed); marketing-intelligence has no route, no cron, no DB write — CLI + tests only.                                                                           |
| Hooks in a loop               | `.claude/hooks/` — 33 authored files                                                                                                                                     | `[VERIFIED settings.json:239-272]` 3 registered. ~30 dormant; the `.ps1` majority are Windows-only.                                                                                                                                                                |
| Algorithm/docs mastery        | `algorithm-knowledge-base` skill + `lib/algorithm/algorithm-context.ts`                                                                                                  | `[VERIFIED references/*.md:3]` All five references `last_verified_date: 2026-04-01` — five months stale, **pre-dating the Aug 2026 spam update**; TS const hand-duplicated with no reconciliation.                                                                 |
| Semrush mastery               | Declared in schemas as `DATA_REQUIRED`                                                                                                                                   | `[VERIFIED]` No key, no client, no route. Product code has never fetched a Semrush datum.                                                                                                                                                                          |
| Measurement                   | GSC dual-auth clients, 7 routes, 3 crons, `gsc_snapshots` flowing 1,167 rows                                                                                             | `[VERIFIED]` The one connector genuinely live.                                                                                                                                                                                                                     |

So the recommended path: **ignite what exists, in dependency order, prove the
whole loop on Sector One (restoration — the vertical where entity authority
already compounds), then run Sector Two purely from the playbook.** Sector Two
is the finish line because it is the first true test of "multi-sector": a
sector the system has never seen, served without rediscovery.

The board lenses bind this with the foundation's own law: _"building supply
ahead of demand is explicitly forbidden"_ `[VERIFIED ceo-foundation.md:300]`.
The refuse-to-fund list until the gates below pass: new-sector research wikis,
sub-sector persona harvesting beyond Sector One, Semrush at multi-sector
scale, and any content programme in a sector with an empty claims register.

---

## 3. Goals & non-goals

**Goals**

1. A working second brain: the existing KG repaired, fed, partitioned, and
   readable by agents and product code — with the foundation's persona corpus
   bridged into it.
2. One canonical sector key, ending the five incompatible industry
   vocabularies `[VERIFIED — taxonomy.ts:193 (~34), industry-templates.ts:14
(6), BrandDNA.vertical (5), two onboarding lists, INDUSTRY_STARTERS]`.
3. Per-sector, per-sub-sector personas as structured data with governed
   provenance (foundation → register → DB), not prose in a 279 KB markdown
   file only skills can read.
4. Measurement identity per publishing property, and the doc-freshness
   mechanism that makes "know the docs like no one else" a property of the
   system instead of a snapshot.
5. Named authors with accruing E-E-A-T, publishing register-backed content
   through the existing design engine + claims machinery.
6. The Sector Playbook: the reusable artifact Sector Two runs on.

**Non-goals**

- **No scraping.** Inherited from the intelligence-loop spec §7; first-party
  - licensed + official APIs only. Not re-litigated here.
- **No 10-sector launch.** Sectors enter one at a time through the playbook's
  entry gate. The Aug 2026 spam update zeroed exactly the
  scale-first pattern ([SEL](https://searchengineland.com/google-august-2026-spam-update-done-rolling-out-485471),
  [SER](https://www.seroundtable.com/google-august-2026-spam-update-done-41906.html) — rolled out 18–21 Aug, global).
- **No invented bylines.** E-E-A-T accrues to named humans with verifiable
  experience; fabricated authors are the demoted profile `[VERIFIED
algorithm-knowledge-base references/google-search.md:57-63]`.
- **No new knowledge-store dependency.** The wiki is the repaired KG.
  Obsidian stays a founder-side local tool (`localhost:27124` cannot serve
  Vercel `[VERIFIED lib/obsidian/client.ts:39-43]`).
- **No Semrush spend without the CEO gate.** Business plan US$499.95/mo with
  **zero** included API units; units separate (~US$50/1M; organic-keywords
  live = 10 units/line) ([pricing](https://thatmarketingbuddy.com/blog/semrush-api-pricing),
  [sem.discount](https://sem.discount/semrush-api/)). `dependency-discipline`
  makes this a founder decision, and GSC (free, quota'd:
  [limits](https://developers.google.com/webmaster-tools/limits)) is the
  default backbone until then.
- **No `llms.txt` cargo cult.** No published evidence it improves citations;
  not used by Google's AI features ([GEO guide](https://www.averi.ai/learn/the-definitive-guide-to-geo-get-cited-by-ai-in-2026),
  [Sturm](https://edwardsturm.com/articles/ai-seo-geo-aeo-get-shown-llms-2026/)).
  The one file that exists stays; effort goes to what LLMs actually cite:
  cross-source consensus and third-party presence.

---

## 4. Approach

Plain language: **feed the brain, name the sectors, name the humans, measure
one loop end to end, then copy the loop.**

The repo already contains a research engine, a scoring engine, a design
engine, a claims register, a workflow orchestrator with human-approval and
brand-voice gates, and a knowledge graph. None of them are connected. The
programme is almost entirely wiring, plus two genuinely new pieces: the
canonical sector/persona data model, and the doc-freshness mechanism.

### 4.1 The gaps the founder did not name

Consolidated from both board lenses; each is binding on a phase below.

| #   | Gap                                                                                                                                                                                   | Consequence                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | **No authors → no E-E-A-T.** Plumbing exists (`AuthorProfile` model `prisma/schema.prisma:91`, Person schema `lib/seo/schema-markup-service.ts:573`), zero published author entities. | Every sector launches at E-E-A-T zero until named humans are chosen and accrue history. Personas are audiences, not authors.                                                    |
| G2  | **Proof before promise.** Zero posts, zero metrics, claims registers empty except CARSI (3).                                                                                          | "The provider that gets results" dies at the first "show me yours". Sector One must produce the case study before Sector Two is marketed.                                       |
| G3  | **Eight domains = eight authority sandboxes** (`hostAge` 6–12 mo `[VERIFIED google-search.md:29-35]`).                                                                                | Spread thin, everything ranks nowhere for a year; concentrated wrongly, per-sector intent dilutes — the spam-update failure. Sector strategy must pick its domain deliberately. |
| G4  | **The CCW carve-out is the multi-client template.** L1–L9: client data never pools `[VERIFIED ceo-foundation.md:2074-2088]`.                                                          | The second brain must be tenancy-partitioned from row one, or the first external client makes it a liability.                                                                   |
| G5  | **Claims substantiation does not parallelise.** Gate flips are founder-only, source-documented `[VERIFIED verification-gates.md:166]`.                                                | At N sectors the claims pipeline is the throughput ceiling — CARSI's $795 flip was the live demo. The playbook must batch claims for founder review, not stream them.           |
| G6  | **Frequency-cap arithmetic.** 3 touches / 7 days pooled across ALL brands `[VERIFIED ceo-foundation.md:371]`; the enforcing identity layer is `[not built]` (VG-91/92).               | Every added sector either starves for touches or silently burns sender reputation portfolio-wide. Email joins the loop only after VG-91/92.                                     |
| G7  | **Unit economics unknown even at home.** ACV/LTV are `[placeholder]` (VG-48/49) `[VERIFIED verification-gates.md:77-78]`.                                                             | No CAC ceiling per sector → no rational spend decision → the board cannot fund sector expansion by its own rules.                                                               |
| G8  | **Founder bandwidth is the real constraint.** 6–10 hr/wk, 20–40 review pieces/wk, every output human-gated `[VERIFIED ceo-foundation.md:25,94-95]`.                                   | The loop's cadence must be derived from review capacity, not generation capacity. Ten sectors exceeds it by an order of magnitude `[INFERENCE]`.                                |
| G9  | **Knowledge rots invisibly.** The five-month-stale references pre-date the algorithm they describe.                                                                                   | Without hashes, cadence and confidence decay, the second brain becomes a liability that cites April against August.                                                             |

### 4.2 Answers this spec gives to the intelligence-loop's open questions

- **Q2 (persona shape):** both, layered. Foundation Phase 3.X.2 JTBD profiles
  are the human-authored source of truth; they are extracted to per-brand
  files (the `claims.md` pattern) and seeded into the new `SectorPersona`
  model keyed by the canonical sector id. `BrandDNA.persona` stays as the
  org-level default. `[INFERENCE from substrate: BrandDNA/ClientProfile are
1:1-locked (`@unique organizationId`) and cannot hold sub-personas]`
- **Q3 (what ships first):** Sector One restoration content, LinkedIn,
  produced by the design engine against the CARSI/DR claims registers —
  Phase −1 of the intelligence-loop spec stands as the universal blocker.
- **Q4 (extract from the 279 KB foundation):** yes — same answer as Q2.
- **Q5 (CCW):** participates only inside its own partition. Its sector
  research is stored under its org id and never joins portfolio queries (G4).

---

## 5. Phased plan

Dependencies: intelligence-loop **Phase −1 (ship one post)** blocks Phase 4
here. Phases 0–3 are parallel-safe lanes with disjoint files. No phase starts
before the prior phase's DoD _within its own lane_.

### Phase 0 — Ignite the second brain _(repair, smallest first)_

1. Fix `lib/knowledge-graph/builder.ts:16` — replace the `noop-client` import
   with Prisma `$queryRaw`/`$executeRaw` against the existing tables.
2. Add `ClientKnowledgeEntity`/`ClientKnowledgeEdge` models to
   `prisma/schema.prisma` with `@@map` onto the **existing** prod tables
   (no DDL — the tables exist `[VERIFIED — SQL 2026-08-29]`). Record the
   drift reconciliation for founder sign-off rather than silently adopting it.
3. Make the embedding hash-fallback fail loud: no `OPENAI_API_KEY` ⇒
   `DATA_REQUIRED`, never a meaningless vector `[VERIFIED
lib/ai/embedding-service.ts:60]`.
4. Schedule the builder honestly: a `vercel.json` cron (the 55-cron chassis
   exists) replacing the phantom edge-function comment.
5. Feed it: the six extractors run over what exists today (brand configs,
   claims sidecars, taste logs, TrendInsights when they flow).
6. `KNOWLEDGE_GRAPH_ADVISOR` documented in `.env.example`.

**DoD:** builder writes real rows to prod-shaped tables in a test org;
`queryKnowledge()` returns cited results above the 10-entity floor; RLS
verified on the live tables (see R1); hash-fallback removed and a guard test
proves no-key ⇒ loud failure.

### Phase 1 — One sector key, real persona storage

1. Declare `lib/industries/taxonomy.ts` ids the **canonical sector key**.
   Map the other four vocabularies onto it (a `sectorKeyFrom*()` adapter per
   legacy list); new code accepts only canonical ids.
2. New `SectorPersona` model (§6) — DDL authored, validated, **founder
   applies** per migration rules.
3. Extract foundation Phase 3.1–3.4 personas into
   `packages/brand-config/src/brands/<slug>.personas.md` sidecars (the
   proven `claims.md` pattern), then seed `SectorPersona` from them with
   provenance (`source`, `verified_on`, gate ref).
4. Seed the ~34 taxonomy `aiPersona`/`targetAudiences` as
   `provenance: 'taxonomy-draft'` rows — usable by agents as drafts, never
   publishable until a foundation-grade profile supersedes them (G5
   discipline).

**DoD:** one query returns the persona stack for (brand × sector ×
sub-sector) with provenance; the five-vocabulary drift has a failing-test
guard (new industry string outside the canonical map fails CI);
`business-dna` and the design engine read personas from the store, not from
276 KB of markdown `[VERIFIED — foundation loaders truncate before Phase
3.X.2 today, spec:78-91]`.

### Phase 2 — Measurement identity + the freshness mechanism

1. GSC property per publishing domain, registered as gate entries; the
   `gsc-adapter.ts` bridge gets its missing route/cron so scoring models see
   live rows (today: CLI-only `[VERIFIED]`).
2. GA4 at **organisation** level: provision, register in
   `verification-gates.md` (`[UNCONFIRMED as live today]` — the skills'
   property ids are worked examples, not verified properties). Per-brand GA4
   is **not** in scope: `GA4Property` is keyed
   `@@unique([organizationId, propertyId])` with no brand relation
   `[VERIFIED prisma/schema.prisma:5422-5436]`, and
   `/api/integrations/ga4/select-property` resolves on that pair, so an
   organisation running several brands cannot attribute a property to one of
   them. Brand-level GA4 would need a schema change plus brand-aware
   authorisation — a separate decision, deliberately not smuggled in here.
   Until it is taken, brand-level GA4 metrics are `DATA_REQUIRED`.
3. **Doc-freshness mechanism** (the operational meaning of "know the docs
   like no one else"): a `KnowledgeSource` registry — URL, tier (1–4),
   `last_verified_date`, content hash; weekly cron fetch-hash-diff flags
   `re-verify`; confidence decays CONFIRMED→INFERRED at 90 days unverified,
   →SPECULATIVE at 180; `algorithm-context.ts` generated from the markdown or
   hash-checked against it (closes intelligence-loop R10). Mastery = freshest
   verified corpus + honest decay, not a bigger snapshot.
4. LLM-citation sampling: a scripted weekly prompt-panel across
   ChatGPT/Claude/Perplexity/AI Overviews for the sector's money questions,
   logged to a table. Directional snapshot, never a KPI `[VERIFIED
local-seo-geo-veteran Q3.2.3 Amendment 2 discipline]`.
5. Semrush: **decision, not default** — presented to the founder with the
   real economics (§3). If funded: `SEMRUSH_API_KEY` in Vercel, a thin client
   in `lib/`, unit-budget guard, `DATA_REQUIRED` when the budget is out.

**DoD:** every metric any report cites resolves to a live property or a
`DATA_REQUIRED`; the algorithm KB carries no CONFIRMED claim older than 90
days; the citation panel has ≥2 weekly runs stored.

### Phase 3 — Authors and the E-E-A-T substrate

1. Founder names the humans (open question 1). Each gets an `AuthorProfile`
   row, a Person schema block, a bio page with verifiable experience, and
   sameAs links (author entities / Knowledge Graph presence are the rising
   2026 signals — [QRG takeaways](https://dageno.ai/academy/googles-quality-rater-guidelines),
   [E-E-A-T 2026](https://www.seo-kreativ.de/en/blog/e-e-a-t-guide-for-more-trust-and-top-rankings/)).
2. Every published piece carries a real author; AI assistance disclosed where
   it aids the reader (Google guidance, not ranking rule `[web —
koanthic/layer3 2026 guides]`).
3. GEO posture: consensus is third-party — the programme allocates effort to
   being cited _about_ the sector on external authoritative surfaces
   (associations, standards bodies, podcasts) rather than on-site tricks.

**DoD:** N≥1 named author live with schema validating; author pages indexed;
zero published pieces without an author row.

### Phase 4 — Sector One, end to end _(gated on intelligence-loop Phase −1)_

Run the whole loop in restoration, where entity authority already compounds
(L8) and claims can actually be substantiated:

research (auto-research cron ignited, first-party + licensed) → Signal Brief
→ sector personas (Phase 1 store) → produce (design engine + claims register,
batched founder review per G5/G8 — cadence derived from the 20–40 pieces/wk
review cap) → publish (LinkedIn first) → measure (GSC + platform metrics +
citation panel, pre-declared thresholds + kill criteria per piece per
`senior-cmo` discipline) → learn (taste logs, `PRINCIPLES.md`, TrendInsight
`applied` loop).

**DoD (= the board's three metrics, first two):** ≥N published-and-measured
posts/week sustained for 4 weeks (N set by founder review capacity); the
restoration claims registers populated with ≥1 verified case-study claim;
every claim on every canvas register-backed; one written **Sector Playbook**
capturing entry criteria, persona sourcing, claims batch process, thresholds.

### Phase 5 — Sector Two, by playbook _(the finish line)_

Founder picks the sector (open question 3). Entry gate: named author with
credible experience in or adjacent to the sector; ≥1 substantiatable claim
source identified; domain decision made (G3); unit-economics hypothesis with
a CAC ceiling (G7). Then the playbook runs without new engineering.

**DoD:** the finish-line sentence, plus the third board metric armed.

**The attribution key chain, stated because the first draft got it wrong.**
Search Console reports search dimensions — query, page, country, device,
searchAppearance — and carries **no** UTM values; UTM parameters are Analytics
campaign data. An earlier draft of this spec wrote the join as
"Stripe → UTM/GSC source", which is not a join that exists. The real chain is:

`platform_posts` row → the tagged outbound link it published
(`utm_source` / `utm_medium` / `utm_campaign` / `utm_id`, generated per post)
→ landing session (GA4 campaign data) → Stripe Checkout session carrying the
same `utm_id` **in `metadata`** → the conversion.

**`client_reference_id` is not available, and must not be used.**
`app/api/stripe/checkout/route.ts:169` already sets it to `userId`, and
`lib/stripe/webhook-handlers.ts:467` reads it _first_ when resolving the user,
falling back to `metadata.userId` `[VERIFIED — both lines read 29/08/2026]`.
Putting a `utm_id` there would hand `handleCheckoutCompleted` a campaign id
where it expects a user id; the `if (!userId || !customerId) return` guard
would not catch it, because a `utm_id` is a non-empty string. So `metadata` is
the only slot, and it is additive — the existing `userId` / `planName` keys
stay.

**The propagation does not exist yet — it is Phase 5 work, not an assumption.**
That route accepts no campaign parameter today and writes no `utm_id`. The
chain therefore needs: the `utm_id` carried from the landing page to the
checkout call, **server-validated** against the issuing `platform_posts` row
rather than trusted from the client (an unvalidated pass-through lets any
caller attribute revenue to any post), then written into
`checkout.sessions.create({ metadata })` and read back off the webhook.

GSC is reserved for organic-search metrics and never appears in this chain.
Because Phase 4 publishes to LinkedIn first, the tagged link is the only
durable key — referrer alone is not one.

**Armed means both cases are handled**, not just the happy one: an
_attributed_ conversion resolves end to end, and an _unattributed_ conversion
(direct, stripped parameters, cross-device) is counted as unattributed rather
than silently dropped or optimistically assigned. A metric that can only
describe its successes overstates itself. Reported `[window not yet elapsed]`
until ~Dec 2026 `[INFERENCE]`.

---

## 6. Data model

Per Synthex migration rules: authored + `npx prisma validate` + proven on a
throwaway DB, then **stop — founder applies**. `apply_migration` only; never
`prisma db push`.

- `ClientKnowledgeEntity` / `ClientKnowledgeEdge` — **no DDL**: models added
  with `@@map` to the existing prod tables (`vector(1536)`, IVFFlat, RLS per
  the archived DDL). Unsupported `vector` type handled as `Unsupported
("vector(1536)")` with raw-SQL access confined to the repaired builder and
  `knowledge-query`.
- `SectorPersona` _(new, DDL)_ — `id`, `organizationId` (RLS key, G4),
  `brandSlug?`, `sectorId` (canonical taxonomy id), `subSectorId?`, `name`,
  `jtbd Json` (functional/emotional jobs, triggers — foundation shape),
  `voice Json` (vocabulary/emphasis/avoid — taxonomy `aiPersona` shape),
  `provenance` (`foundation | taxonomy-draft | client-research`),
  `verifiedOn?`, `gateRef?`, `expiresOn?`.

  **Uniqueness.** `brandSlug` and `subSectorId` are both nullable, and
  Postgres treats `NULL`s as distinct by default — so a naive composite
  unique would silently permit duplicate org-scoped or whole-sector personas.
  The constraint is therefore declared `NULLS NOT DISTINCT` over
  (`organizationId`, `brandSlug`, `sectorId`, `subSectorId`, `name`), which
  is available on the production instance `[VERIFIED — Synthex prod is
PostgreSQL 17.4; NULLS NOT DISTINCT landed in PG 15]`. Prisma cannot yet
  express this in schema syntax, so the migration adds it as a raw
  `CREATE UNIQUE INDEX ... NULLS NOT DISTINCT` alongside the model.

  **Publication eligibility — the predicate, not a sentiment.** A persona may
  reach a publishable canvas **iff all** of: `provenance = 'foundation'` (a
  `taxonomy-draft` row qualifies only once a foundation-grade row for the same
  key supersedes it, at which point the draft is superseded, not promoted);
  `gateRef` resolves to a gate whose registry state is approved; and
  `expiresOn` is null or in the future. `taxonomy-draft` rows stay fully
  usable for persona-stack assembly, briefing and drafting — they are rejected
  **at the publish boundary only**, which is where the §7.6 workflow gates
  already sit. §10 Phase 4 carries the guard test.

- `KnowledgeSource` _(new, DDL)_ — `organizationId` (RLS key — §7.1 admits no
  exception, and a source registry is second-brain data like any other),
  `url`, `tier Int`, `contentHash`, `lastVerifiedAt`, `confidence`
  (`CONFIRMED|INFERRED|SPECULATIVE`), `sectorId?`. Indexed on
  `organizationId`; tenant-scoped RLS policy. Feeds the freshness cron.
- `CitationSample` _(new, DDL)_ — `organizationId` (RLS key, as above),
  `panelRunAt`, `engine`, `prompt`, `citedDomains Json`, `sectorId`. Indexed
  on `organizationId`; tenant-scoped RLS policy. Directional only.

  Both were specified without a tenancy key in the first draft, contradicting
  §7.1. Corrected here rather than left for the implementer to notice.

---

## 7. Security & cost guardrails (structural)

1. **Tenancy partition (G4):** every second-brain row carries
   `organizationId`; RLS enforced at the table — **required, and not true
   today**: the live tables carry only a blanket `service_role` policy (R1), so
   Phase 0.1 adds the org-scoped policy and §10's Phase 0 gate fails until it
   does; no query
   path that joins across orgs. CCW's partition never pools with Nexus
   brands. This is the L1–L9 carve-out made mechanical.
2. **Spend gates:** Semrush is CEO-gated with a monthly unit budget and a
   hard `DATA_REQUIRED` stop at budget exhaustion — never silent overage.
   OpenAI embeddings keyed and metered; the hash-fallback is deleted, not
   deprecated. GSC/GA4 are free tiers.
3. **No scraping** (inherited §7 of the intelligence-loop spec). Official
   APIs + Apify only where its ToS and the platform's allow, per that spec.
4. **Secrets:** all keys in Vercel env only; `.env.example` documents names,
   never values; the credential vault (`lib/vault`) is for client
   credentials and is not the knowledge store (they were conflated in the
   brief — different systems, kept different).
5. **Claims law:** nothing renders on any surface without a register-backed
   claim (`<slug>.claims.md` pattern); price claims carry currency + GST
   inline (the #921/#922 lesson, now a schema rule).
6. **Publish gates:** the workflow orchestrator's existing `human-approval`,
   `brand-voice-gate`, `strategist-gate` step types are the loop's gate
   chassis — no new approval machinery, and nothing auto-publishes.

---

## 8. Risk & assumption register

| #   | Risk / assumption                                                                                                                                                                                                                                        | Tag                                                              | Mitigation                                                                                                                                                                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | RLS is enabled on both live KG tables, but the **only** policies are `service_role_all_cke` / `service_role_all_cke_edge`, `cmd = ALL` with `qual = true` — a blanket grant, not tenant isolation. §7.1's "RLS enforced at the table" is not true today. | `[VERIFIED — live pg_policies query, 29/08/2026]`                | Phase 0.1 adds the org-scoped policy; the §10 Phase 0 gate asserts `relrowsecurity` **and** a policy whose predicate scopes by `organization_id`, so it fails until that lands. No multi-org write before it passes. |
| R2  | GA4 is organisation-scoped, so brand-level attribution is unavailable                                                                                                                                                                                    | `[VERIFIED prisma/schema.prisma:5422-5436]`                      | Phase 2 provisions org-level GA4 and registers it; brand-level GA4 metrics stay `DATA_REQUIRED` until the schema decision in §5 Phase 2.2 is taken.                                                                  |
| R3  | Named authors are available and willing                                                                                                                                                                                                                  | `[UNCONFIRMED — founder decision]`                               | Open question 1; Phase 3 blocks Phase 4 publishing, not Phase 0–2 engineering.                                                                                                                                       |
| R4  | Content-attributed revenue readable before ~Dec 2026                                                                                                                                                                                                     | `[INFERENCE — window arithmetic]`                                | Reported as `window not yet elapsed`, never back-filled optimistically.                                                                                                                                              |
| R5  | The 34-vertical taxonomy fits AU sub-markets the founder targets                                                                                                                                                                                         | `[UNCONFIRMED]`                                                  | Taxonomy rows are drafts; foundation-grade profiles supersede. Sector Two entry gate re-validates.                                                                                                                   |
| R6  | Skill files carry broken foundation references (e.g. "Phase 3.1.2" vs §3.2 headings)                                                                                                                                                                     | `[VERIFIED intelligence-loop R6/spec:365]`                       | Persona extraction (Phase 1) reads the foundation directly with line anchors, never via skill citations.                                                                                                             |
| R7  | BullMQ worker infra for auto-research is deployable on current hosting                                                                                                                                                                                   | `[UNCONFIRMED]`                                                  | Phase 0.4 prefers the vercel.json cron chassis; BullMQ only if cron cadence proves insufficient.                                                                                                                     |
| R8  | The Aug 2026 spam update's "legitimate programmatic survived" holds for our pattern                                                                                                                                                                      | `[VERIFIED as reported — SEL/SER]`, generalisation `[INFERENCE]` | Per-sector intent tests + human-signal thresholds in every piece's kill criteria.                                                                                                                                    |

---

## 9. Open questions (founder)

1. **Who are the named authors?** E-E-A-T accrues to humans. You, Rana,
   named SMEs per sector? This gates Phase 3 and therefore all publishing.
2. **Semrush: fund or defer?** US$499.95/mo + units on top. Recommendation:
   **defer** until Sector One's loop runs on GSC alone, then decide with
   usage data. GSC is free and already flowing.
3. **Sector Two candidate?** Taxonomy has ~34 coded verticals; the entry
   gate (Phase 5) needs an author + claim source + domain decision.
   Adjacency to restoration (e.g. commercial cleaning, aged-care
   compliance) maximises transferable authority `[INFERENCE]`.
4. **Second-brain hosting stance:** confirm the repaired in-DB KG is _the_
   wiki, with Obsidian remaining your local tool (recommendation), vs.
   funding a hosted Obsidian bridge.
5. **Drift adoption:** the KG tables exist in prod but not in the migration
   history. Approve recording them (schema models + a reconciliation note in
   the registry) — the alternative is leaving live tables unversioned.

---

## 10. Verification plan

Phase 0 — three separate gates, deliberately not collapsed into one:

```bash
# (a) static / unit
npx prisma validate
npx jest --config config/jest/jest.worktree.cjs tests/unit/knowledge-graph/  # no-key ⇒ DATA_REQUIRED; builder writes against a disposable DB
npm run type-check && npm run lint && npm test

# (b) live RLS gate — read-only, BLOCKING, exact tables.
# A bare SELECT is NOT a gate: psql exits 0 on an empty result set, and
# ON_ERROR_STOP only catches SQL errors. The check must RAISE.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
DO \$\$
DECLARE bad text;
BEGIN
  SELECT string_agg(t, ', ') INTO bad
  FROM unnest(ARRAY['client_knowledge_entities','client_knowledge_edges']) AS t
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = t AND c.relrowsecurity
  )
  OR NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = t
      AND p.qual IS NOT NULL
      AND p.qual <> 'true'              -- a permissive policy is not isolation
      AND p.qual ILIKE '%organization_id%'
  );
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'RLS gate: no org-scoped policy (or RLS disabled) on %', bad;
  END IF;
END \$\$;"
```

The gate asserts two things per table, not the existence of rows: RLS is
enabled (`pg_class.relrowsecurity` — a policy on a table with RLS off is
inert), and at least one policy exists whose predicate actually scopes by
`organization_id`. `RAISE EXCEPTION` is what makes it blocking; a `SELECT`
that returns nothing exits 0.

**This gate fails today, which is the point.** Queried read-only on
29/08/2026: RLS is enabled on both tables, and the only policies present are
`service_role_all_cke` and `service_role_all_cke_edge` — both `cmd = ALL`
with `qual = true` `[VERIFIED — live pg_policies query]`. A blanket
service-role grant is not tenant isolation, so §7.1's "RLS enforced at the
table" is **not** true today; adding the org-scoped policy is Phase 0.1 work,
and this gate is what stops Phase 0 closing without it. An earlier draft of
this gate listed matching rows, which would have returned those two rows and
passed — reproducing, inside the fix for it, exactly the defect the gate
exists to catch.

**`npm run rls:coverage` is not a substitute and must not be cited as one.**
It reads `prisma/schema.prisma` off disk with `readFileSync` and never opens a
database connection `[VERIFIED scripts/validate-rls-coverage.js:18,81]`, so it
cannot see a live policy — and these two tables are not in `schema.prisma`
until Phase 0.2 lands anyway. The repo's live adversarial RLS job is
non-blocking and does not assert these tables. Hence the explicit read-only
check above, blocking, before any multi-org write. This is the gate R1
promises; an earlier draft named it in the risk register but never placed it
in the verification plan.

Phase 1:

```bash
npx jest --config config/jest/jest.worktree.cjs __tests__/sectors/          # canonical-key guard: unmapped industry string fails
node scripts/personas/seed-from-foundation.ts --dry-run                     # prints (brand × sector) persona stack with provenance
```

Phase 2:

```bash
node scripts/marketing-intelligence/run-gsc-backlog.ts                      # now backed by a route/cron, rows persisted
npx jest --config config/jest/jest.worktree.cjs tests/unit/knowledge-freshness/  # decay: >90d CONFIRMED fails CI
```

Phases 3–5: publish-side proof is the intelligence-loop spec §10 (Phase −1's
own-post gate: the new `platform_posts` row + linked post-dated
`platform_metrics` row), plus:

```bash
npx jest --config config/jest/jest.worktree.cjs tests/unit/authors/         # no published piece without AuthorProfile + Person schema
npx jest --config config/jest/jest.worktree.cjs tests/unit/personas/        # publish boundary rejects provenance='taxonomy-draft',
                                                                            # an unapproved gateRef, or a past expiresOn — while the
                                                                            # same draft row still assembles into a persona stack
```

Programme metrics (the board's three, in order of arming): published-and-
measured posts/week; verified-claims coverage (brands/sectors with ≥1
verified case-study claim — measurable in-repo today); content-attributed
paid revenue (the Phase 5 key chain: tagged post link → GA4 campaign
session → Stripe conversion, attributed **and** unattributed cases both
handled; GSC is not in this chain; CARSI $795 first). This third metric stays
**unarmed** until the `utm_id` propagation of §5 Phase 5 — server-validated
into Checkout `metadata`, never `client_reference_id` — is proven end to end
by a test that follows one `utm_id` from a `platform_posts` row through to the
webhook, and by a second that shows an untagged conversion recorded as
unattributed rather than dropped or misattributed. Until both pass, the metric
reports `DATA_REQUIRED`.

---

_Sources (web channel, all 2026): [Search Engine Land — Aug 2026 spam update done](https://searchengineland.com/google-august-2026-spam-update-done-rolling-out-485471) · [Search Engine Roundtable](https://www.seroundtable.com/google-august-2026-spam-update-done-41906.html) · [Semrush API pricing](https://thatmarketingbuddy.com/blog/semrush-api-pricing) · [sem.discount — Semrush API](https://sem.discount/semrush-api/) · [Google Search Console API limits](https://developers.google.com/webmaster-tools/limits) · [Quality Rater Guidelines takeaways](https://dageno.ai/academy/googles-quality-rater-guidelines) · [E-E-A-T 2026 guide](https://www.seo-kreativ.de/en/blog/e-e-a-t-guide-for-more-trust-and-top-rankings/) · [GEO definitive guide](https://www.averi.ai/learn/the-definitive-guide-to-geo-get-cited-by-ai-in-2026) · [Edward Sturm — AI SEO/GEO/AEO](https://edwardsturm.com/articles/ai-seo-geo-aeo-get-shown-llms-2026/)_
