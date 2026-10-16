# REE — Reverse Engineer Everything

**Synthex search-intelligence spec · v1 · 16/10/2026**

Built with the `fable-engine` vision planner (`.claude/skills/fable-engine`). Evidence tags follow `.claude/rules/fabel-evidence-standard.md`:

- `[VERIFIED]`: a fetched source, a run command, or a file read in this repo.
- `[INFERENCE]`: a conclusion drawn from named verified material.
- `[UNCONFIRMED]`: a lead or assumption. It lives in the risk register.

Phase 1 is built on branch `feature/synthex-ree-search-agents`. Every later phase waits for the founder's approval of this spec.

Source ledgers:

- [`sources/platform-changes-2025-2026.md`](sources/platform-changes-2025-2026.md): 39 official facts, re-opened 16/10/2026.
- [`sources/zanet-design.md`](sources/zanet-design.md): Zanet Design, 146 transcripts.
- [`sources/seo-jesus.md`](sources/seo-jesus.md): SEO Jesus (Stewart Vickers).

---

## 1. Finish line

**Done when** Synthex runs, for every Unite Group brand, a durable weekly loop that does all of the following:

1. Observes official platform changes and the brand's measured search and AI visibility.
2. Takes apart who is winning, and why, against the brand's own entity.
3. Proposes only policy-safe changes, each behind an approval bound to its exact payload.
4. Measures each change against a baseline recorded in advance and the update calendar.
5. Promotes or retires playbook atoms based on the result.

No seed, demo value or failed read is ever shown as live data.

Rejected finish lines:

- "Rank #1 for X". Outcomes depend on Google, not on us.
- "Ship N agents". A count of agents measures nothing.

## 2. Decision up front

Build REE as one loop that every Synthex search agent shares: **observe → capture → decompose → diff → hypothesise → gate → intervene → measure → codify**. Do not build a pile of separate "SEO tools".

Synthex already has most of the parts: GSC, GBP, PageSpeed, E-E-A-T and GEO scorers, a Sentinel, approvals and 55 crons `[VERIFIED: L4 audit, vercel.json]`. What it lacks is honesty at the edges and a durable spine:

- Its algorithm feed was invented `[VERIFIED: fixed in Phase 1]`.
- Its AI Overview adapter never calls a provider.
- GEO-readiness shows random demo trends when it has no data.
- The citation aggregator turns read failures into zeros.
- The generic workflow engine never boots a worker or queues the next step `[VERIFIED: L4, file paths in §5]`.

So:

- **Phase 1** (built): the honest **Observe** foundation, meaning a live official update feed.
- **Phase 2**: remove the remaining fake-as-real paths.
- **Phase 3**: pick a durable engine (founder decision: Vercel Workflow or Inngest).
- **Phases 4–6**: add read-only agents first, then gated interventions.

The method intertwines the two creators the owner trusts (§7):

- **Zanet Design** brings the diagnosis: what Google already believes about the business, made consistent and true.
- **SEO Jesus** brings the tempo: fast experiments, automated by agents, measured honestly.

## 3. Goals

- One REE loop with a typed evidence trail (source, time, locale, engine, evidence class) that every search agent uses.
- Observe from official feeds and first-party telemetry before any third-party or practitioner signal:
  - Google Search Status, Search Console (including the AI and multimodal reports), the GBP APIs, Bing Webmaster AI Performance, and GA4's AI Assistant channel.
- Entity truth across Google Business Profile, Bing Places, Apple Business and the website, going "beyond NAP" (Zanet).
- Repeatable experiments: a frozen geo-grid and prompt-panel config, a control, a pre-registered metric and window, and an update-calendar confound check.
- A playbook of atoms, each tagged SAFE, CAUTION or PROHIBITED, with its evidence and a decay watch.
- Durable execution: crash-safe steps, idempotent external writes, and human-approval waits that can last days.

## 4. Non-goals

- No artificial GBP profiles, fake or gated reviews, PBNs, cloaking, scaled AI pages or site-reputation (parasite) abuse. These hold even where a creator shows them working (§7, risk register).
- No autonomous publishing, GBP edits, outreach or ad spend. Every external write needs an approval bound to its payload.
- No AI-generated imagery. `real-images-only` binds every visual.
- No `llms.txt` or "special AI markup" work aimed at Google. Google says to ignore it `[VERIFIED: ai-optimization-guide]`.
- No scraping of Google results pages against terms. SERP and AI-answer observation goes through a licensed provider (open question 2).
- No new database tables, dependencies or paid vendors without founder approval.

## 5. What discovery found

Seven parallel lanes, reconciled by the coordinator. Full ledgers are in `sources/`.

**Platforms** (all `[VERIFIED]`, re-opened 16/10/2026):

- **AI search uses the normal index.** A page must be indexed and snippet-eligible. Google needs no special AI file.
- **Measurement changed in 2026:**
  - Search Console gained generative-AI reports (June), platform properties (July) and a multimodal search type (September).
  - GA4 gained an AI Assistant channel (13/05/2026).
  - Bing Webmaster Tools reports AI citations and grounding queries, and added Topics Portfolio on 13/10/2026.
- **Local:**
  - AI Mode (08/10/2025) and Ask Maps (August 2026) are live in Australia.
  - The GBP Q&A API was discontinued on 03/11/2025.
  - GBP API policy forbids auto-reverting Google's edits and requires express consent.
- **Policy:**
  - Site-reputation abuse policy updated 28/08/2026.
  - Generative-AI content guidance updated 01/10/2026: scaled content without added value is abuse.
  - Google says E-E-A-T is not a specific ranking factor and warns against AI headshots and invented credentials.
- **Crawling:** Googlebot reads only the first 2 MB of a page. FAQ rich results are gone. Crawler purposes are split (OAI-SearchBot vs GPTBot, Claude-SearchBot vs ClaudeBot, Google-Extended for Gemini only).
- **Vendors:** Adobe completed its Semrush acquisition (28/04/2026). Semrush has an official MCP server.

**Synthex today** (`[VERIFIED: L4 read-only audit of 8324358]`):

| Area                                                  | State                                                                        | Evidence                                                                                                                                 |
| ----------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| GSC, GBP read/reply, PageSpeed, publishing, approvals | Real                                                                         | `lib/google/search-console-oauth.ts`, `lib/google/business-profile.ts`, `lib/seo/pagespeed-service.ts`, `app/api/cron/publish-scheduled` |
| Algorithm feed                                        | Invented seed: 5 of 7 entries since mid-2025 wrong, nothing after March 2026 | `lib/sentinel/algorithm-feed.ts` at 8324358 — **fixed in Phase 1**                                                                       |
| AI Overview citations                                 | Stub: adapter always `configured=false`                                      | `lib/geo-citation/ai-overview-adapter.ts`                                                                                                |
| GEO-readiness                                         | Random demo trends when history is empty                                     | `lib/seo/geo-readiness-service.ts`                                                                                                       |
| Citation aggregate                                    | Read failures become zero                                                    | `lib/citation/aggregator.ts`                                                                                                             |
| GEO score, IntentScape, knowledge graph               | Call a retired client that throws                                            | `lib/platform/noop-client.ts` callers                                                                                                    |
| Generic workflow engine                               | No worker boot; next step never enqueued; 30 s timer does not abort work     | `lib/queue/workers/index.ts`, `lib/workflow/orchestrator.ts`, `lib/workflow/step-executor.ts`                                            |
| Mission Control                                       | Goal → approved Linear tickets is real; code/test/PR is "coming soon"        | `lib/mission-control`, `components/mission-control`                                                                                      |

## 6. The REE loop

Each stage writes evidence. A stage that cannot run returns `UNAVAILABLE` with its reason, never an empty success.

| #   | Stage           | What happens                                                                                                                                                  | Output                                                      | Source of truth                                                                                                     |
| --- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1   | **Observe**     | Read official change feeds and first-party telemetry; tag every item O/A/I/L                                                                                  | Dated change ledger; telemetry snapshots                    | Google Search Status (live, Phase 1), Search Central, GBP changelog, Bing Webmaster, GSC, BWT, GBP Performance, GA4 |
| 2   | **Capture**     | For a query × location × surface (Map pack, organic, AI Overview/AI Mode, Copilot, ChatGPT, YouTube), record who wins and what is cited                       | Raw capture: time, locale, device, engine/model, cited URLs | Licensed SERP/AI provider (open question 2); BWT citations; GSC                                                     |
| 3   | **Decompose**   | List the winner's observable signals across nine layers: entity, reputation, content, structure, technical, media, mentions/links, freshness, conversion path | Signal sheet per winner                                     | Public pages, GBP/Places data, schema, PSI, crawl                                                                   |
| 4   | **Diff**        | Compare **at least three** winners with our entity; keep only differences that recur                                                                          | Gap matrix                                                  | Signal sheets                                                                                                       |
| 5   | **Hypothesise** | Rank causal hypotheses with an evidence class, then run the policy check: SAFE / CAUTION / PROHIBITED (PROHIBITED is dropped)                                 | Ranked hypotheses                                           | Spam policies, GBP guidelines, ACCC                                                                                 |
| 6   | **Gate**        | A human approves the exact payload: edit, post, page, outreach, spend                                                                                         | Approval bound to a payload hash                            | `ApprovalRequest` (existing)                                                                                        |
| 7   | **Intervene**   | The smallest reversible change; one variable per entity where possible                                                                                        | Change ledger entry with a rollback                         | Existing publish/GBP paths                                                                                          |
| 8   | **Measure**     | Pre-registered metric and window against a control; check whether a Google update overlapped                                                                  | Outcome: kept / inconclusive / reverted                     | Frozen grid/prompt panel, GSC, BWT, calls/bookings; Sentinel calendar                                               |
| 9   | **Codify**      | Promote, revise or retire the playbook atom; link the evidence                                                                                                | Versioned atom                                              | `docs/ree/` → later a table (CEO approval)                                                                          |

**Operating rules** (each traces to a lesson):

- **Never copy one winner.** Zanet: "He copied his competitor and lost everything". The #1 site was #1 despite its design, because of the "200 other things". Diff three or more winners `[UNCONFIRMED: practitioner lesson, adopted as a design rule]`.
- **Truth before tactics.** Consistency mismatches between profile, site and third-party sources cost Google's confidence (Zanet). Bing and Google both state that accurate, consistent entity data feeds local and AI eligibility `[VERIFIED: Bing AI Performance post; Google ai-features]`.
- **Every measurement is confounded until the update calendar says otherwise.** Phase 1 makes that calendar real.
- **Honest numbers.** SEO Jesus's "honest numbers" episodes show the value of publishing failures as well as wins. Inconclusive is a result, not a failure to report.
- **Decay watch.** Every atom names the platform changes that would invalidate it. The weekly Cloudroom sentinel re-tests them.

## 7. Zanet × SEO Jesus — the intertwined doctrine

Detail and citations are in `sources/`. Both creators' claims are practitioner leads `[UNCONFIRMED]` unless an official source in the ledger confirms them.

| Theme          | Zanet Design (local trust)                                                                                                                     | SEO Jesus (AI-search velocity)                                                   | REE synthesis                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Starting point | "Google already has a profile on your business": audit what it believes (`site:`, quoted-name search, Images, AI Mode summary and its sources) | Find where AI answers already cite, and what they cite                           | **Capture** both: what the engines say about us, and who they cite instead                    |
| Truth          | Consistency far beyond NAP: categories, services, service areas, website wording                                                               | Brand mentions and listicles shape AI answers                                    | Entity Steward fixes truth first; mentions are earned, never bought                           |
| Freshness      | "Google is a visitor": regular useful updates keep it coming back                                                                              | Fresh pages and agents keep up with change                                       | Freshness is a measured layer; cadence comes from data, not a quota                           |
| Media          | Real photos of real people and jobs; no stock, no AI images                                                                                    | AI avatars tested: "honest numbers"                                              | Real images only (Synthex rule); avatar tests stay out of brand surfaces                      |
| Speed          | The fix must last ("why your fix won't last")                                                                                                  | Rank in hours, iterate with Claude Code agents                                   | Fast, reversible experiments on a truthful entity; keep only what lasts past the decay window |
| Risk           | White-hat; warns against fake reviews and black-hat tricks                                                                                     | Openly uses parasite SEO, mass backlinks, expired domains                        | PROHIBITED list is enforced in the Hypothesise stage (§14)                                    |
| Operations     | Health path, 1:1 audits, masterclasses                                                                                                         | Agent swarms, update alerts (Cloudflare 403 on Googlebot, rank-tracker breakage) | Durable agents run the audits; Sentinel and Crawl-Access agents run the alerts                |

## 8. Playbook atoms

Policy class: **S** = SAFE, **C** = CAUTION. PROHIBITED tactics never become atoms. Owners refer to §9.

| ID  | Atom: input → action → output                                                                                                                            | Verify                                                  | Cadence                      | Class                | Owner                | Evidence                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------- | -------------------- | -------------------- | --------------------------------------------------- |
| A01 | Official feeds → dated change ledger → impact notes per brand                                                                                            | Source re-opened; region and preview state recorded     | Daily (Google), weekly (all) | S                    | Sentinel             | Ledger rows 1–39                                    |
| A02 | GBP + Bing Places + website + schema → field-level consistency diff (name, categories, services, areas, hours, phone, URL) → correction proposal         | Read-back after approved edit                           | Weekly                       | S                    | Entity Steward       | GBP guidelines; Bing AI Performance post; Zanet     |
| A03 | Brand name in AI Mode / Copilot / ChatGPT → recorded summary + cited sources → list of wrong facts and their source pages                                | Repeat sample; source pages fixed                       | Monthly                      | S                    | Citation Researcher  | Zanet; ai-features doc                              |
| A04 | Critical URLs → test Googlebot, Bingbot, OAI-SearchBot, Claude-SearchBot, PerplexityBot through the real CDN → access matrix                             | Real responses; CDN 403s found                          | Weekly + after deploys       | S                    | Crawl-Access Auditor | Crawler docs; SEO Jesus Cloudflare alert            |
| A05 | HTML size and render → flag pages whose essential content or schema sits past 2 MB                                                                       | Fetch-size check                                        | Weekly                       | S                    | Crawl-Access Auditor | Googlebot 2 MB post                                 |
| A06 | GSC (web + AI + multimodal) + BWT citations + GBP Performance + GA4 AI channel → baseline and deltas, annotated with the update calendar                 | Totals reconcile; no double-counting                    | Weekly                       | S                    | Visibility Analyst   | GSC/GA4/BWT posts                                   |
| A07 | Completed, consented jobs → neutral review invitations (no gating, no incentives) and drafted replies → approval queue                                   | Moderation state read back; complaints logged           | Daily                        | S                    | Reputation Ops       | Maps policy; ACCC                                   |
| A08 | Real job photos/footage + customer questions → evidence-led service and case pages, watch pages with VideoObject → expert review                         | Claims checked; schema matches visible content; indexed | Monthly                      | S                    | Evidence Editor      | Video structured-data doc; helpful-content guidance |
| A09 | Frozen geo-grid (keyword, coordinates, spacing, device, time) → share-of-local-voice before and after one approved change, against an untreated location | Same config; ≥3 observations each side                  | Weekly                       | S                    | Experiment Steward   | Local Falcon method (L2)                            |
| A10 | Frozen Australian prompt panel → citation/mention rate per engine                                                                                        | Raw answers stored; variance reported                   | Fortnightly                  | S                    | Citation Researcher  | Bing AI Performance; vendor studies                 |
| A11 | Relevant editorial opportunities + real case studies → substantiated pitch drafts                                                                        | Earned coverage and referral quality                    | Fortnightly                  | C (correlation only) | Evidence Editor      | Ahrefs correlation study                            |
| A12 | Changed/deleted URLs → IndexNow submission → receipt log                                                                                                 | Later crawl/index state, not just HTTP 200              | On publish                   | S                    | Crawl-Access Auditor | IndexNow docs                                       |
| A13 | FAQPage schema only where visible Q&A exists; no "rich result" promises                                                                                  | Schema matches page                                     | On publish                   | S                    | Evidence Editor      | FAQ rich results retired                            |

## 9. Agent roster

Durable agents share the REE evidence trail. Each starts read-only. Write powers are added only behind §13.

| Agent                    | REE stages                          | Data                                                                              | Human gate                                     | Phase            |
| ------------------------ | ----------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------- |
| **Sentinel**             | Observe; confound check for Measure | Google Search Status feed (live), later Search Central, GBP changelog, Bing feeds | None for reading; policy changes need approval | **1 (built)**, 4 |
| **Crawl-Access Auditor** | Observe, Decompose                  | Real HTTP fetches as each bot, CDN responses, page size                           | Robots/CDN changes                             | 4                |
| **Visibility Analyst**   | Observe, Measure                    | GSC (incl. AI/multimodal where API allows), BWT, GBP Performance, GA4             | Account connections                            | 4                |
| **Entity Steward**       | Decompose, Diff, Intervene          | GBP Business Information, Bing Places, site/schema                                | Every listing edit                             | 4–5              |
| **Citation Researcher**  | Capture, Measure                    | Licensed provider or BWT; prompt panel                                            | Provider and budget                            | 6                |
| **Experiment Steward**   | Hypothesise, Measure, Codify        | Change ledger, grids, outcomes                                                    | Experiment scope and spend                     | 5                |
| **Reputation Ops**       | Intervene                           | Consented job events, GBP reviews                                                 | Outreach scope; every sensitive reply          | 5                |
| **Evidence Editor**      | Intervene                           | Real photo library, expert records, CMS drafts                                    | Every publication                              | 5                |
| **Media/Video Editor**   | Intervene                           | Owned footage, YouTube APIs                                                       | Every publication                              | 6                |
| **Paid Search Analyst**  | Observe, Measure                    | Google Ads / Microsoft Ads APIs                                                   | Every budget/bidding change                    | Later            |

Coordination stays with the existing roles:

- The Senior PM (`.claude/agents/senior-pm.md`) turns approved phases into Linear work orders.
- Orchestrator v2 enforces its caps: 3 failures stop a lane; no schema change without approval.

## 10. Durable substrate

`[INFERENCE from L4 + L5]`:

- **Today:** today's crons (`maxDuration` 30–300 s `[VERIFIED: app/api/cron/*]`) and the in-request queue cannot carry multi-step, multi-day agent runs. The generic workflow engine has unbooted workers and no next-step dispatch.
- **Recommendation:** run a proof of concept on **Vercel Workflow** (`'use workflow'` / `'use step'`; persisted steps, retries, long waits; billed per event `[VERIFIED: vercel.com/docs/workflows]`). It matches the Vercel + Next 16 + AI SDK stack with no new vendor account.
- **Fallback:** **Inngest** (step results persist; run lifetime 30/90/366 days by plan `[VERIFIED: inngest limits doc]`).
- **How to choose:** by failure tests, not by SDK taste:
  - kill a run mid-step;
  - deliver a step twice;
  - wait 3 days for an approval;
  - redeploy during a wait.
- **Business record:** stays in Postgres, using the existing `ApprovalRequest`, `AuditLog` and `WorkflowExecution`. Any new table (for example `ReeExperiment`) needs CEO approval.
- **Founder decision:** this is a new dependency and a new cost.

## 11. Phased plan

Each phase has a definition of done (DoD). No phase starts before the previous DoD is met and the founder has approved it.

| Phase                                       | Scope                                                                                                                                                                                                                                              | DoD                                                                                                                   |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **1 — Honest Observe** (built, this branch) | Sentinel reads Google's Search Status Dashboard live (6 h throttle); fallback list replaced with the 18 official updates since March 2024; 5 invented ids hidden; `/api/sentinel/updates` reports `feed` status; this spec                         | Done-contract criteria C1–C9 pass on the exact commit; independent review PASS; GitHub checks green on the pushed SHA |
| **2 — No fake-as-real**                     | GEO-readiness: no random history, explicit "no data"; citation aggregate: failures become `unavailable`, not 0; AI Overview adapter surfaced as "not connected"; remove "rich results" promises from FAQ/schema advice; retire Q&A API assumptions | Tests prove each failure is labelled; UI shows "not connected / no data"                                              |
| **3 — Durable spine**                       | Founder picks Vercel Workflow or Inngest; POC wraps the Sentinel + one read-only agent; failure tests in §10                                                                                                                                       | All four failure tests pass; cost per run measured                                                                    |
| **4 — Read-only agents**                    | Crawl-Access Auditor, Visibility Analyst, Entity Steward (diff only) for DR, CARSI, RestoreAssist, CCW, NRPG                                                                                                                                       | Weekly reports per brand with an evidence trail; zero external writes                                                 |
| **5 — Gated interventions**                 | Experiment Steward + approval-bound GBP proposals, review invitations, evidence pages                                                                                                                                                              | Each change has payload-bound approval, rollback, pre-registered measure                                              |
| **6 — Citation panel and media**            | Licensed AI/SERP provider, prompt panel, video watch pages                                                                                                                                                                                         | Variance reported; budget cap enforced                                                                                |

## 12. Data model

- **Phase 1:** no schema change. It reuses `algorithm_updates`.
  - Live rows keep the `seed-<name>` id so existing review links stay attached.
  - Non-ranking incidents use `gssd-<incident id>`.
- **Later phases:** reuse `ApprovalRequest`, `AuditLog`, `WorkflowExecution`/`StepExecution` and `SiteHealthSnapshot`. Candidate new tables need CEO approval and go through `apply_migration` only:
  - `ReeExperiment`;
  - `ReeCapture`;
  - `PlaybookAtom`.

## 13. Security & cost guardrails

- **External writes** (GBP, publishing, outreach, ads) need an approval bound to a payload hash, plus idempotency keys. An interrupted write counts as uncertain until it is reconciled.
- **GBP API policy:** the business's express consent; no auto-revert of Google edits; caching limits `[VERIFIED: GBP policies]`.
- **Paid usage:** no paid API, provider or capacity without founder approval:
  - Semrush units;
  - SERP/AI providers;
  - Vercel Workflow events.
- **Ahrefs:** use its public API only. Its hosted MCP server forbids custom programmatic use `[UNCONFIRMED: L5]`.
- **Scope and data:**
  - Org scoping on every query.
  - Secrets stay in Vercel env.
  - Retrieved web content is data, never instructions (prompt-injection rule for every agent).
- **Images:** `real-images-only` binds all media.

## 14. Risk & assumption register

| Risk / assumption                                                                                                                 | Tag                                                     | Handling                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Creators' ranking claims ("#1 in 7 hours", "5,000% improvement")                                                                  | [UNCONFIRMED]                                           | Adopt the method, not the claim; only measured atoms are promoted                        |
| Parasite SEO, mass automated backlinks, expired/auction domains, fake GBP listings, fake/gated reviews, cloaking, scaled AI pages | [VERIFIED] policy breaches (spam policies, Maps policy) | PROHIBITED; dropped at the Hypothesise stage                                             |
| Brand mentions cause AI citations                                                                                                 | [UNCONFIRMED] (correlation only)                        | A11 stays CAUTION until measured                                                         |
| Australian availability of AI Mode ads, LSA categories, some GBP features                                                         | [UNCONFIRMED]                                           | Check in the live account first                                                          |
| GSC AI-report API parity                                                                                                          | [UNCONFIRMED]                                           | Use exports until the API is documented                                                  |
| Production rows with the 5 invented ids still exist                                                                               | [VERIFIED] (code hides them)                            | Cleanup SQL in §16; founder decides on deletion                                          |
| Dashboard feed format changes                                                                                                     | [INFERENCE]                                             | Sync fails closed to `unavailable`; the fallback list still loads; tests pin the mapping |
| Durable engine cost at scale                                                                                                      | [UNCONFIRMED]                                           | Measure in the Phase 3 POC before rollout                                                |

## 15. Open questions

1. **Durable engine:** Vercel Workflow (recommended) or Inngest? Both add a dependency and cost.
2. **AI/SERP observation provider and monthly cap:** Semrush AI toolkit vs a SERP API vs Bing Webmaster exports only. The AI Overview adapter stays "not connected" until then.
3. **Five invented rows in production:** hide only (Phase 1 does this), or delete with the SQL in §16?
4. **First brands and locations for experiments:** the foundation says DR has the clearest local-services GBP case. Confirm DR + one more.
5. **Bing Webmaster OAuth access:** does Synthex have it for the portfolio's sites, so the Visibility Analyst can read AI citations?

## 16. Verification plan

**Phase 1** is checked by the locked Done contract (`.claude/done/`; criteria run by `donectl verify` on the exact commit):

- **C1:** fallback list equals Google's live dashboard history: 18/18 entries, exact UTC times, no invented entries.
- **C2:** `npx jest --config config/jest/jest.worktree.cjs tests/unit/lib/sentinel`.
- **C3:** `LIVE_SENTINEL=1 … -t 'live dashboard'`. The real feed maps the September 2026 spam update exactly.
- **C4–C6:** `npm run type-check`, `npm run lint`, the full Jest suite.
- **C7–C9:** this spec's sections exist; no dependency, schema or cron change; the diff stays in scope.
- **Then:** independent review of the exact SHA, GitHub checks green on the pushed SHA, and a human merge.

**After merge (observed, not assumed):**

1. Call `GET /api/sentinel/updates?days=60` on synthex.social. Expect `feed.status: "live"` and the September 2026 spam update with source `status.search.google.com/incidents/XhUDXP7A67iHCD2kmbVu`.
2. Optional cleanup, **only with founder approval**:

```sql
-- Preview:
SELECT id, name, "announcedAt", reviewed, "linearIssueId" FROM algorithm_updates
WHERE id IN ('seed-june-2025-spam-update','seed-august-2025-core-update','seed-november-2025-core-update',
             'seed-december-2025-link-spam-update','seed-february-2026-helpful-content-update');
-- Delete (irreversible; Phase 1 already hides these rows):
-- DELETE FROM algorithm_updates WHERE id IN (...same list...);
```

**Phases 2–6:** each phase's DoD in §11 becomes its own locked Done contract before code is written.
