# REE — Reverse Engineer Everything

**Synthex search-intelligence spec · v1.1 · 16/10/2026**

Built with the `fable-engine` vision planner (`.claude/skills/fable-engine`). Evidence tags follow `.claude/rules/fabel-evidence-standard.md`:

- `[VERIFIED]`: a fetched source, a run command, or a file read in this repo.
- `[INFERENCE]`: a conclusion drawn from named verified material.
- `[UNCONFIRMED]`: a lead or assumption. It lives in the risk register.

Phase 1 is built on branch `feature/synthex-ree-search-agents`. Every later phase waits for the founder's approval of this spec.

v1.1 applies the Board's seven required changes; see §17 and [`BOARD-MEMO.md`](BOARD-MEMO.md).

Source ledgers:

- [`sources/platform-changes-2025-2026.md`](sources/platform-changes-2025-2026.md): 39 official facts, re-opened 16/10/2026.
- [`sources/zanet-design.md`](sources/zanet-design.md): Zanet Design, 146 transcripts.
- [`sources/seo-jesus.md`](sources/seo-jesus.md): SEO Jesus (Stewart Vickers), 180 transcripts.

---

## 1. Finish line

**Done when** Synthex runs a durable weekly loop for a founder-approved pilot: Disaster Recovery plus one contrasting brand. The loop then extends to each further brand that passes its eligibility, access and outcome checks: the foundation's other front doors (CCW, CARSI, RestoreAssist, NRPG), CleanExpo if the founder confirms it is in scope (open question 1), and client businesses.

Each week the loop must:

1. **Observe** official platform changes and the brand's measured visibility, with every reading in an explicit evidence state (§6).
2. **Take apart** who wins, and why, against matched non-winners and the brand's own entity.
3. **Propose** only policy-safe changes, each behind an approval bound to its exact payload.
4. **Measure** each change against a pre-registered baseline, a control and a stopping rule.
5. **Promote or retire** playbook atoms only on replicated results.

Two hard conditions:

- Qualified enquiries and booked work are reported **next to** visibility. They are never inferred from it.
- No seed, demo value or failed read is ever shown as live data.

Rejected finish lines:

- "Rank #1 for X". Google decides that, not us.
- "Ship N agents". A count of agents measures nothing.
- "Visibility up". That does not show the business won.

## 2. Decision up front

Build REE as **one loop with three roles, not a fleet**:

- **Collector**: deterministic, no LLM.
- **Analyst / Experiment Steward**.
- **Evidence Editor**.
- **Executor**: a deterministic component that sits at the write gate and is the only thing allowed to touch the outside world.

The loop runs: **observe → capture → decompose → diff → hypothesise → gate → intervene → measure → codify**.

Synthex already has many of the parts: GSC, GBP, PageSpeed, E-E-A-T and GEO scorers, a Sentinel, approvals and 55 crons `[VERIFIED: L4 audit; vercel.json]`. What it lacks is honest evidence at the edges and a durable spine:

- The algorithm feed was invented (fixed in Phase 1).
- The AI Overview adapter never calls a provider.
- GEO-readiness shows random demo trends when it has no data.
- The citation aggregator turns read failures into zeros.
- Some features call a retired client that throws.
- The generic workflow engine never boots a worker or queues the next step `[VERIFIED: L4; paths in §5]`.

**Order:**

1. Honest Observe (built).
2. Honesty, access and baselines.
3. A read-only pilot that produces a weekly decision packet.
4. A founder-approved durability spike.
5. Gated interventions.
6. Expansion, only where results justify it.

Automation has to earn its place on observed workload. The Board's dissent stands: manual operation is the right first test.

The method intertwines the two creators the owner trusts (§7):

- **Zanet Design** brings the diagnosis: what Google already believes about the business, made consistent and true.
- **SEO Jesus** brings the tempo: fast experiments, agent automation and honest numbers.

REE keeps each creator's method and drops any tactic that breaches policy.

## 3. Goals

- **Outcome contract per brand**, before any experiment:
  - customer and intent;
  - legitimate geography (real locations and service areas only);
  - accountable owner;
  - conversion definition: qualified enquiry, booked job, and contribution where observable;
  - baseline, smallest useful effect, AUD cost ceiling and expansion gate.
- **One typed evidence trail** shared by every role. Each reading records:
  - source and fetch time;
  - source timezone;
  - tenant;
  - surface and interface/model;
  - configuration version;
  - numerator, denominator and completeness;
  - evidence state.
- **Official and first-party sources first:**
  - Google Search Status (live, Phase 1);
  - Search Console, including the AI and multimodal reports where the account has them;
  - the GBP APIs;
  - Bing Webmaster AI Performance;
  - GA4's AI Assistant channel.
- **Entity truth** across Google Business Profile, Bing Places, Apple Business and the website, going "beyond NAP" (Zanet).
- **Experiments that can fail:**
  - frozen grid and prompt-panel configs;
  - matched controls and non-winners;
  - windows sized from baseline variance;
  - pre-registered keep / inconclusive / stop rules;
  - replication before any causal claim.
- **A playbook of atoms:** each is SAFE or CAUTION, with evidence, applicability limits and a decay watch. Negative and inconclusive results are kept.
- **Durable execution** that protects external effects:
  - no duplicate writes;
  - uncertain writes reconciled before any retry;
  - multi-day approval waits survive redeploys.

## 4. Non-goals

- **No manipulative tactics:**
  - artificial GBP profiles or false addresses;
  - fake, incentivised or gated reviews, or asking for specific review content;
  - link schemes or PBNs, cloaking, or scaled low-value AI pages;
  - expired-domain abuse;
  - site-reputation abuse.

  These hold even where a creator shows a tactic working (§14).

- **No unsupervised writes.** That covers publishing, GBP edits, review replies and invitations, IndexNow submissions, outreach and ad spend. Every one goes through the Executor after an approval bound to its payload.
- **No AI-generated imagery.** `real-images-only` binds every visual. There is no synthetic-image exception for this programme.
- **No `llms.txt` or "special AI markup" work aimed at Google.** Google says to ignore it `[VERIFIED: ai-optimization-guide]`.
- **No scraping of Google pages against its terms.** Observation goes through official reports, exports or a licensed provider (open question 2).
- **No founder-gated items without founder approval:** new tables, dependencies, vendors, paid capacity or a pooled cross-tenant data warehouse.
- **Not in the pilot:** a ten-agent fleet, a generic repair of the legacy queue, avatars, bulk mention acquisition, paid-search expansion, or bespoke "ranking scores".

## 5. What discovery found

Seven parallel lanes and a Board review, reconciled by the coordinator. Full ledgers are in `sources/`.

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
  - Google's Maps policy forbids asking customers to include specific content in reviews.
- **Policy:**
  - Site-reputation abuse policy updated 28/08/2026.
  - Generative-AI content guidance updated 01/10/2026: scaled content without added value is abuse.
  - Google says E-E-A-T is not a specific ranking factor and warns against AI headshots and invented credentials.
- **Crawling:** Googlebot reads only the first 2 MB of a page. FAQ rich results are gone. Crawler purposes are split (OAI-SearchBot vs GPTBot, Claude-SearchBot vs ClaudeBot, Google-Extended for Gemini only).
- **Vendors:** Adobe completed its Semrush acquisition (28/04/2026). Semrush has an official MCP server.

**Synthex today** (`[VERIFIED: L4 read-only audit of 8324358]`):

| Area                                                  | State                                                                        | Evidence                                                                                                                                 |
| ----------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| GSC, GBP read/reply, PageSpeed, publishing, approvals | Real code paths (live credentials not checked)                               | `lib/google/search-console-oauth.ts`, `lib/google/business-profile.ts`, `lib/seo/pagespeed-service.ts`, `app/api/cron/publish-scheduled` |
| Algorithm feed                                        | Invented seed: 5 of 7 entries since mid-2025 wrong, nothing after March 2026 | `lib/sentinel/algorithm-feed.ts` at 8324358 — **fixed in Phase 1**                                                                       |
| AI Overview citations                                 | Stub: adapter always `configured=false`                                      | `lib/geo-citation/ai-overview-adapter.ts`                                                                                                |
| GEO-readiness                                         | Random demo trends when history is empty                                     | `lib/seo/geo-readiness-service.ts`                                                                                                       |
| Citation aggregate                                    | Read failures become zero                                                    | `lib/citation/aggregator.ts`                                                                                                             |
| GEO score, IntentScape, knowledge graph               | Call a retired client that throws                                            | `lib/platform/noop-client.ts` callers                                                                                                    |
| Tenant scoping                                        | Inconsistent in AEO aggregation, legacy histories, schedule selection        | L4 gap 8                                                                                                                                 |
| Generic workflow engine                               | No worker boot; next step never enqueued; 30 s timer does not abort work     | `lib/queue/workers/index.ts`, `lib/workflow/orchestrator.ts`, `lib/workflow/step-executor.ts`                                            |
| Mission Control                                       | Goal → approved Linear tickets is real; code/test/PR is "coming soon"        | `lib/mission-control`, `components/mission-control`                                                                                      |

## 6. The REE loop

**Evidence states.** Every reading has exactly one:

- `OBSERVED`: a value was read, including a genuine zero.
- `UNAVAILABLE`: the read failed.
- `UNAUTHORISED`: no grant or consent.
- `UNSUPPORTED`: the account or API lacks the report.
- `STALE`: older than the atom's freshness limit.
- `PARTIAL`: some pages or dates are missing.

Only `OBSERVED` is ever drawn as a number.

Other evidence rules:

- **Diagnostics stay diagnostics.** Heuristic GEO and E-E-A-T scores, and model probes such as `lib/prompts/prompt-tester.ts`, are labelled `DIAGNOSTIC`. They are never shown as visibility.
- **Separate the measures.** Mentions, citations and outcomes are reported separately. Overlapping GSC subsets are never added together.
- **Synthetic is not verified.** A fetch with a spoofed bot user-agent tests our own CDN rules. It does not prove what the real crawler sees; confirm that through GSC crawl stats or logs.

| #   | Stage           | What happens                                                                                                                                                          | Output                                                              |
| --- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | **Observe**     | Collector reads official change feeds and first-party telemetry; tags items O/A/I/L and evidence state                                                                | Change ledger; telemetry snapshots                                  |
| 2   | **Capture**     | For a query × location × surface, record who wins and what is cited, through official reports or a licensed provider                                                  | Raw capture with time, locale, device, engine/model, config version |
| 3   | **Decompose**   | List observable signals across nine layers: entity, reputation, content, structure, technical, media, mentions/links, freshness, conversion path                      | Signal sheet per result                                             |
| 4   | **Diff**        | Compare winners **and matched non-winners**, plus their history; keep differences that recur                                                                          | Gap matrix. Hypotheses only, never proof                            |
| 5   | **Hypothesise** | Rank hypotheses with evidence class; policy check SAFE / CAUTION / PROHIBITED (PROHIBITED dropped); pre-register metric, window, control, keep/inconclusive/stop rule | Registered experiment                                               |
| 6   | **Gate**        | Human approves the exact action (§13)                                                                                                                                 | Approval record bound to payload hash                               |
| 7   | **Intervene**   | Executor performs only the approved payload; one change per independent test unit                                                                                     | Receipt, public/moderation read-back, rollback note                 |
| 8   | **Measure**     | Compare against control and baseline; record overlapping Google updates, seasonality, opening hours, campaigns and concurrent edits                                   | Outcome: keep / inconclusive / stop                                 |
| 9   | **Codify**      | Promote an atom only after replication; keep failures with applicability limits                                                                                       | Versioned atom                                                      |

**Operating rules:**

- **Never copy one winner.** Zanet's case: "He copied his competitor and lost everything". The leader was #1 despite its design, because of the "200 other things". Differences between results suggest hypotheses; only controlled outcomes confirm them `[UNCONFIRMED: practitioner lesson, adopted as a design rule]`.
- **Truth before tactics.** Mismatches between the profile, the site and third-party sources erode confidence (Zanet). Google and Bing both tie local and AI eligibility to accurate, consistent business information `[VERIFIED: ai-features doc; Bing AI Performance post]`.
- **The update calendar flags confounds. It never clears them.** An overlapping Google update marks a result as confounded. A quiet calendar does not prove the change caused the result.
- **Honest numbers.** Publish wins, losses and inconclusive results, as SEO Jesus does in his "Honest Numbers" video. An inconclusive result is a result.
- **Decay watch.** Every atom names the platform changes that would invalidate it. The weekly Cloudroom sentinel re-tests them.

## 7. Zanet × SEO Jesus — the intertwined doctrine

Detail and citations are in `sources/`. Both creators' claims are practitioner leads `[UNCONFIRMED]` unless an official source in the ledger confirms them.

| Theme          | Zanet Design (local trust)                                                                                                                     | SEO Jesus (AI-search velocity)                                                    | REE synthesis                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Starting point | "Google already has a profile on your business": audit what it believes (`site:`, quoted-name search, Images, AI Mode summary and its sources) | Find where AI answers already cite, and what they cite                            | **Capture** both: what the engines say about us, and who they cite instead                            |
| Truth          | Consistency far beyond NAP: categories, services, service areas, website wording                                                               | Brand mentions and listicles shape AI answers                                     | Entity truth first; mentions are earned, never bought                                                 |
| Freshness      | "Google is a visitor": regular, useful updates keep it coming back                                                                             | Fresh pages and agents keep pace with change                                      | Freshness is a measured layer; cadence comes from data, not a quota                                   |
| Media          | Real photos of real people and jobs; no stock, no AI images                                                                                    | AI avatar channel tested with honest numbers                                      | Real images only (Synthex rule); avatars stay out of the pilot                                        |
| Reviews        | Recent reviews describing real work help customers choose                                                                                      | Speed of acquisition                                                              | Neutral invitations only. Google forbids asking for specific content, so we never suggest words       |
| Speed          | The fix must last ("why your fix won't last")                                                                                                  | Rank in hours; iterate with Claude Code agents                                    | Fast, reversible experiments on a truthful entity; keep only what survives its window and replication |
| Risk           | White-hat; warns against fake reviews and black-hat tricks                                                                                     | Openly uses parasite SEO, mass backlinks, domain plays                            | The PROHIBITED list is enforced at the Hypothesise stage (§14)                                        |
| Operations     | Health path, one-to-one audits, masterclasses                                                                                                  | Agent swarms; update alerts (Cloudflare 403s on Googlebot, rank-tracker breakage) | The Collector runs audits and alerts; the Analyst turns them into a weekly decision packet            |

## 8. Playbook atoms

Policy class: **S** = SAFE, **C** = CAUTION. PROHIBITED tactics never become atoms. Every atom that writes externally goes through the Executor (§13).

| ID  | Atom: input → action → output                                                                                                                                                                    | Verify                                                  | Cadence                      | Class                | Role                          | Evidence                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ---------------------------- | -------------------- | ----------------------------- | --------------------------------------------------- |
| A01 | Official feeds → dated change ledger → impact notes per brand                                                                                                                                    | Source re-opened; region and preview state recorded     | Daily (Google), weekly (all) | S                    | Collector                     | Ledger rows 1–39                                    |
| A02 | GBP + Bing Places + website + schema → field-level consistency diff (name, categories, services, areas, hours, phone, URL) → correction proposal                                                 | Approved edit read back from the API and public listing | Weekly                       | S                    | Collector → Editor → Executor | GBP guidelines; Bing AI Performance post; Zanet     |
| A03 | Brand name in AI Mode / Copilot / ChatGPT, via licensed or permitted access → recorded summary + cited sources → wrong facts and their source pages                                              | Repeat sample; source pages fixed                       | Monthly                      | S                    | Collector → Analyst           | Zanet; ai-features doc                              |
| A04 | Critical URLs → synthetic fetches as each bot through the real CDN → access matrix; confirm with GSC crawl stats/logs                                                                            | Real responses; CDN 403s found; crawler confirmation    | Weekly + after deploys       | S                    | Collector                     | Crawler docs; SEO Jesus Cloudflare alert            |
| A05 | HTML size and render → flag pages whose essential content or schema sits past 2 MB                                                                                                               | Fetch-size check                                        | Weekly                       | S                    | Collector                     | Googlebot 2 MB post                                 |
| A06 | GSC (web + AI + multimodal where supported) + BWT citations + GBP Performance + GA4 AI channel + CRM outcomes → baseline and deltas with evidence states                                         | Totals reconcile; no subset double-counting             | Weekly                       | S                    | Collector → Analyst           | GSC/GA4/BWT posts                                   |
| A07 | Completed, consented jobs → neutral review invitations (no gating, no incentives, **no suggested words**) and drafted replies → approval queue                                                   | Moderation state read back; complaints logged           | Daily                        | S                    | Editor → Executor             | Maps policy; ACCC                                   |
| A08 | Real job photos/footage + customer questions → evidence-led service and case pages; watch pages with VideoObject → expert review (safety/insurance claims)                                       | Claims checked; schema matches visible content; indexed | Monthly                      | S                    | Editor → Executor             | Video structured-data doc; helpful-content guidance |
| A09 | Frozen geo-grid (keyword, coordinates, spacing, device, local time) → share of local voice before/after one approved change vs a matched untreated location; window sized from baseline variance | Same config; pre-registered stop rule                   | Weekly                       | S                    | Analyst                       | Local Falcon method (L2)                            |
| A10 | Frozen Australian prompt panel → citation and mention rate per engine                                                                                                                            | Raw answers stored; variance reported                   | Fortnightly                  | S                    | Collector → Analyst           | Bing AI Performance; vendor studies                 |
| A11 | Relevant editorial opportunities + real case studies → substantiated pitch drafts                                                                                                                | Earned coverage and referral quality                    | Later                        | C (correlation only) | Editor                        | Ahrefs correlation study                            |
| A12 | Changed/deleted URLs → approved IndexNow submission → receipt log                                                                                                                                | Later crawl/index state, not just HTTP 200              | On publish                   | S                    | Executor                      | IndexNow docs                                       |
| A13 | FAQPage schema only where visible Q&A exists; no "rich result" promises                                                                                                                          | Schema matches page                                     | On publish                   | S                    | Editor                        | FAQ rich results retired                            |

## 9. Agent roster

Three roles share typed adapters and the evidence trail. Deterministic fetches need no LLM.

| Role                             | Capabilities                                                                                                                      | Writes                | Phase             |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ----------------- |
| **Collector** (deterministic)    | Sentinel feed (**built**); GSC/BWT/GBP/GA4 pulls with evidence states; crawl-access and page-size checks; entity consistency diff | None                  | 1 (Sentinel), 2–3 |
| **Analyst / Experiment Steward** | Weekly decision packet; hypotheses; pre-registration; outcome review; atom promotion and retirement                               | None                  | 3                 |
| **Evidence Editor**              | Drafts of pages, profile corrections, review invitations and replies, from real evidence and the owned photo library              | Drafts only           | 5                 |
| **Executor** (deterministic)     | Runs only approved payloads; idempotency keys; reconciles uncertain writes; read-back                                             | Approved actions only | 5                 |

**Deferred until justified:**

- citation-panel provider (Phase 6);
- media/video editor;
- paid-search analyst;
- reputation as a separate agent (it is Editor + Executor).

**Process owners:**

- The Senior PM (`.claude/agents/senior-pm.md`) turns approved phases into measurable one-to-three-day UNI work orders.
- Orchestrator v2 enforces its caps: under 200 LOC per dispatch, no secrets, no unapproved schema work, and a stop after three consecutive failures of one step.

## 10. Durable substrate

`[INFERENCE from L4 + L5]`:

- **Today:** today's crons (`maxDuration` 30–300 s `[VERIFIED: app/api/cron/*]`) and the in-request queue cannot carry multi-day approval waits. The generic workflow engine has unbooted workers and no next-step dispatch.
- **Candidates:** **Vercel Workflow** is the first candidate (`'use workflow'` / `'use step'`; persisted steps, retries, long waits; billed per event `[VERIFIED: vercel.com/docs/workflows]`). **Inngest** is the comparator (step results persist; run lifetime 30/90/366 days by plan `[VERIFIED: Inngest limits doc]`).
- **No vendor is selected here.** The founder approves the dependency and cost before the spike.

**Falsifiable selection.** Run an identical workload on each candidate. Required result: zero duplicate effects on the test target and no lost approvals.

1. Crash after the provider accepts a write but before the receipt is saved.
2. Early, duplicate, revoked and expired approvals.
3. Cancellation mid-run.
4. Revoked credentials.
5. HTTP 429 back-off.
6. A redeploy or version change during a real multi-day wait.

Also compare retention and export, region, data ownership, and total cost in AUD (orchestration, execution, history, API units, models, monitoring).

**Business record.** Postgres holds the business record, mapped first to existing models: `ApprovalRequest`, `AuditLog`, `WorkflowExecution`/`StepExecution`. If they cannot enforce immutable approvals, operation uniqueness and reconciliation, that needs a founder-approved schema change. The legacy queue is not rebuilt in parallel.

## 11. Phased plan

Each phase gets its own locked Done contract before code is written. No phase starts before the previous definition of done is met and the founder approves.

| Phase                                                  | Scope                                                                                                                                                                                                                                                                                                                                                                                            | Definition of done                                                                                                        |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| **1 — Honest Observe** (built, this branch)            | Sentinel reads Google's Search Status Dashboard live (6 h throttle); fallback list replaced with the 18 official updates since March 2024; 5 invented ids hidden; `/api/sentinel/updates` reports `feed` status; this spec                                                                                                                                                                       | Done criteria C1–C9 pass on the exact commit; independent review PASS; GitHub checks green on the pushed SHA; human merge |
| **2 — Honesty, access and baselines**                  | Evidence-state type; GEO-readiness without random history; citation aggregate reports `UNAVAILABLE`, not 0; AI Overview adapter shown as "not connected"; FAQ/schema copy without "rich results"; retired-client paths in the pilot's way disabled or repaired; tenant-scoping fixes (L4 gap 8). Account/rights matrix and outcome contracts per pilot brand; frozen baselines (exports allowed) | Tests prove every failure state is labelled; two-org isolation tests pass; pilot baselines recorded with evidence states  |
| **3 — Read-only pilot**                                | Collector + Analyst weekly decision packet for DR + one approved brand; versioned evals for unsupported claims, conflicting evidence, prompt injection and tenant leakage                                                                                                                                                                                                                        | Four consecutive weekly packets; zero external writes; eval thresholds met                                                |
| **4 — Durability spike** (founder-approved dependency) | Both candidates on the identical workload; all six failure tests                                                                                                                                                                                                                                                                                                                                 | Zero duplicate effects; no lost approvals; AUD cost per run measured; founder picks or rejects                            |
| **5 — Gated interventions**                            | Evidence Editor + Executor; at most one approved change per independent test unit                                                                                                                                                                                                                                                                                                                | Payload-bound approval, receipt, read-back and scheduled outcome review for every change                                  |
| **6 — Justified expansion**                            | Further brands and clients; citation-panel provider; media; paid search, each with a fresh case                                                                                                                                                                                                                                                                                                  | Expansion gate in that brand's outcome contract met                                                                       |

## 12. Data model

- **Phase 1:** no schema change. It reuses `algorithm_updates`.
  - Live rows keep the `seed-<name>` id so existing review links stay attached.
  - Non-ranking incidents use `gssd-<incident id>`.
- **Later phases:** map to existing models first (`ApprovalRequest`, `AuditLog`, `WorkflowExecution`/`StepExecution`, `SiteHealthSnapshot`).
- **Candidate tables** (CEO approval, `apply_migration` only): `ReeExperiment`, `ReeReading` (evidence-state readings), `PlaybookAtom`.
- **Retention:** raw provider evidence follows each source's terms (for example, the GBP API caching limits). Only permitted derivatives and provenance are kept long term. Private client content is never pooled across tenants.

## 13. Security & cost guardrails

**Approvals.** An approval binds:

- tenant;
- authorised actor;
- target account;
- canonical payload hash;
- asset IDs;
- budget;
- expiry;
- policy version.

Any change invalidates it. The Executor re-checks the approval immediately before acting.

**What is gated.** Every review reply, review invitation, IndexNow submission, profile edit, publication, outreach and spend. There is no "non-sensitive" exception.

**Uncertain writes.** An interrupted write is uncertain until reconciled, and is never blindly retried. Receipts and public or moderation read-backs are kept. Google's edits are never auto-reverted `[VERIFIED: GBP API policy]`.

**Restrictions live outside prompts.** Tool, destination and tenant restrictions are enforced in code. Retrieved web content is data, never instructions.

**Paid capacity.** None without founder approval:

- Semrush units;
- SERP or AI providers;
- workflow events.

Each pilot has an AUD ceiling that covers review labour, data, models, execution and storage. Ahrefs is used through its public API only; its hosted MCP server forbids custom programmatic use `[UNCONFIRMED: L5]`.

**Consent and rights.**

- Express GBP consent per business.
- Customer consent before any invitation.
- Private addresses are never published.
- Photo rights come from the owned library (`real-images-only`).
- Safety, mould and insurance claims need expert review.

**Kill switches** (from the Board):

| Trigger                                                                                     | Response                                                        |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Unauthorised write, tenant leak, duplicate effect, fabricated evidence or prohibited tactic | Disable the Executor; incident review; founder-approved restart |
| Missing or revoked consent, stale approval, disputed rights, uncertain external state       | Quarantine; no blind retry                                      |
| AUD cap reached, or unbounded retries or fan-out                                            | Stop paid calls and new runs                                    |
| Three consecutive failures of one step, a regression, or absent release evidence            | Stop the lane and escalate                                      |

## 14. Risk & assumption register

| Risk / assumption                                                                                                                                                                                                           | Tag                                                                                                      | Handling                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Recurring differences between winners and us are causes                                                                                                                                                                     | [UNCONFIRMED] — riskiest assumption                                                                      | Matched non-winners, controls, pre-registration, replication; keep negative results                                     |
| Creators' ranking claims ("#1 in 7 hours", "5,000% improvement")                                                                                                                                                            | [UNCONFIRMED]                                                                                            | Adopt the method, not the claim                                                                                         |
| Asking customers to put services, areas or keywords in reviews (a Zanet tip)                                                                                                                                                | [VERIFIED] breach: the Maps policy says merchants should not "request that specific content be included" | PROHIBITED as a prompt; neutral invitations only                                                                        |
| Parasite publishing to exploit a host site's ranking; mass automated or paid ranking links; buying expired domains to host low-value content; fake GBP listings; fake or gated reviews; cloaking; scaled low-value AI pages | [VERIFIED] breaches of Google's spam policies and Maps policy                                            | PROHIBITED. Legitimate third-party publishing and genuine domain acquisitions are not banned; their manipulative use is |
| Brand mentions cause AI citations                                                                                                                                                                                           | [UNCONFIRMED] — correlation only                                                                         | A11 stays CAUTION and later                                                                                             |
| Australian availability of AI Mode ads, LSA categories, some GBP features                                                                                                                                                   | [UNCONFIRMED]                                                                                            | Check in the live account first                                                                                         |
| GSC AI-report and BWT API parity                                                                                                                                                                                            | [UNCONFIRMED]                                                                                            | Exports until the API is documented                                                                                     |
| Pilot accounts lack lawful data or an outcome baseline                                                                                                                                                                      | [UNCONFIRMED]                                                                                            | Narrow to manual factual audits                                                                                         |
| Production rows with the 5 invented ids                                                                                                                                                                                     | [VERIFIED] still stored; Phase 1 hides them                                                              | Cleanup SQL in §16; founder decides                                                                                     |
| Dashboard feed format changes                                                                                                                                                                                               | [INFERENCE]                                                                                              | Sync fails closed to `unavailable`; fallback list still loads; tests pin the mapping                                    |
| Engine cost at scale                                                                                                                                                                                                        | [UNCONFIRMED]                                                                                            | Phase 4 measures it before rollout                                                                                      |

## 15. Open questions

1. **Pilot brands and owners.** DR plus which contrasting brand? Who owns each outcome metric, and what AUD ceiling applies? `.claude/memory/ceo-foundation.md` names five front doors: CCW, CARSI, RestoreAssist, DR and NRPG. CleanExpo is the group and expo brand. Does CleanExpo get its own outcome contract?
2. **Observation provider.** Semrush AI toolkit, a SERP/AI API, or official reports and exports only? The AI Overview adapter stays "not connected" until this is decided.
3. **Access and rights matrix.** Does Synthex hold GSC, GBP, Bing Webmaster (OAuth) and GA4 access, consent and retention rights for the pilot sites?
4. **Durability spike.** Approve Vercel Workflow and Inngest as spike candidates (a new dependency and cost), or keep manual operation?
5. **Five invented production rows.** Hide only (Phase 1 does this), or delete with the SQL in §16?

## 16. Verification plan

**Phase 1** is checked by the locked Done contract (`.claude/done/`), run with `donectl verify` on the exact commit:

- **C1:** the fallback list equals Google's live dashboard history: 18/18 entries, exact UTC times, no invented entries.
- **C2:** `npx jest --config config/jest/jest.worktree.cjs tests/unit/lib/sentinel` passes: mapping, honest failure, throttle, retraction.
- **C3:** `LIVE_SENTINEL=1 … -t 'live dashboard'` passes: the real feed maps the September 2026 spam update exactly.
- **C4–C6:** `npm run type-check`, `npm run lint` and the full Jest suite pass.
- **C7–C9:** this spec's sections exist; no dependency, schema, cron or env change; the diff stays in scope.

Then:

1. Independent review of the exact SHA by a different vendor.
2. GitHub checks green on the pushed SHA.
3. Draft PR.
4. Human merge.

**After merge (observed, not assumed):**

1. Call `GET /api/sentinel/updates?days=60` on synthex.social. Expect `feed.status: "live"` and the September 2026 spam update sourced from `status.search.google.com/incidents/XhUDXP7A67iHCD2kmbVu`.
2. Optional cleanup, **only with founder approval**:

```sql
-- Preview:
SELECT id, name, "announcedAt", reviewed, "linearIssueId" FROM algorithm_updates
WHERE id IN ('seed-june-2025-spam-update','seed-august-2025-core-update','seed-november-2025-core-update',
             'seed-december-2025-link-spam-update','seed-february-2026-helpful-content-update');
-- Delete (irreversible; Phase 1 already hides these rows):
-- DELETE FROM algorithm_updates WHERE id IN (...same list...);
```

**Phases 2–6** use the same pattern:

- the definition of done becomes locked criteria;
- versioned evals are required;
- integration tests are made blocking;
- the required checks are verified on GitHub;
- review is independent and bound to the final SHA;
- merge is by a human.

Persona debate never counts as review.

## 17. Board review

**`[INFERENCE]` — persona synthesis, not fact.**

The Board met on 16/10/2026 on a different vendor (Codex, gpt-6-astra) from the builder. It ran the nine-persona `ceo-board` format, plus the owner's requested lenses:

- first-principles (Musk style);
- brand dominance (Trump style);
- Claude Code builder (Cherny style);
- OpenAI agents and evals engineer;
- Senior PM;
- Orchestrator v2.

These are simulated reasoning styles, not statements by those people.

**Decision: REVISE BEFORE PHASE 2.** The Board kept the shared loop and the truth-first policy, and rejected the original sequencing and roster size. It required seven changes; v1.1 applies all of them.

| Board change                                                                                                          | Where applied       |
| --------------------------------------------------------------------------------------------------------------------- | ------------------- |
| 1. Define winning and scope; reconcile CleanExpo vs CCW; outcome contracts                                            | §1, §3, §11, §15    |
| 2. Honest evidence end to end (states, metadata, diagnostics labelled)                                                | §6, §8, §12, §14    |
| 3. Experimental design earlier; the calendar never clears confounds; variance-sized windows; non-winners; replication | §6, §8 A09–A10, §11 |
| 4. Shrink to three roles plus an Executor; reorder phases                                                             | §2, §9, §11         |
| 5. Approval binding and gating of every write, including replies and IndexNow                                         | §8, §9, §13         |
| 6. Falsifiable engine selection; founder approves before the spike                                                    | §10, §11, §15       |
| 7. Acceptance and ownership: UNI work orders, evals, blocking tests, independent review                               | §9, §11, §16        |

Full deliberation: [`BOARD-MEMO.md`](BOARD-MEMO.md).
