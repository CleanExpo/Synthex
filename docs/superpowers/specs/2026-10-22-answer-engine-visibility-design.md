# Answer-engine visibility for CARSI and RestoreAssist: design spec

**Status:** proposal (22/10/2026), not approved for build
**Client metric:** both. It measures how often ChatGPT and Gemini, with live web search, name CARSI or RestoreAssist when an Australian buyer asks a category question. It also tags trial sign-ups and enrolments that arrive from an AI engine, so any later fixing work can be judged on sign-ups rather than on mentions.
**Rests on:** synthex-intel-07-advantages-and-proposals (proposal 8), synthex-intel-03-ai-marketing-platforms (§4 and the build/buy/call table), synthex-intel-06-trends-and-signals (§1.3), ai-tools-radar-2026-10-22 (§4). Repo evidence: `lib/geo-citation/*`, `lib/prompts/*`, `prisma/schema.prisma` (`GeoCitationEvent`, `PromptTracker`, `PromptResult`, `Lead`), `lib/ai/governor/budget.ts`.
**Relation to the fleet programme:** extends outcome **O6** of `2026-10-17-vibe-to-leader-design.md`. O6 is listed in the client outcome ledger, but no phase P-1 to P9 closes it. This spec does not add a phase. It feeds the AI-referrer tag into the **P6** outcome path and runs its metered calls under the **P5** quote and cap. It is a different kind of gap from **M13** (local rank grid, deferred), as the disposition test below explains.

## Finish line

For each of CARSI and RestoreAssist, a weekly run asks a fixed, versioned set of 40 real Australian buyer questions. Each question goes to two answer engines with live web search and an Australian user location, five times. The run stores every raw answer, the cited URLs and the engine's model version against the organisation. The admin view at `/dashboard/admin/geo-citations` then shows **share of appearance** for each brand: the proportion of runs that name the brand or cite its domain, with a 95% interval, per question, per engine and in total. It never shows a rank. A run that could not reach an engine shows `NOT_MEASURED` with the reason, never 0%. Any lead or enrolment whose referrer is an AI engine carries an `ai:<engine>` source tag in `Lead.source`. Weekly spend is quoted before the run and refused above the cap. The fixing work (content, schema, citations) is not part of the finish line. It is gated by a named trigger (see Decision up front).

## Decision up front

**Build the meter now, narrowly, and defer the fixing actuator behind a trigger.** The fleet spec's rule is "no actuator without a meter" [VERIFIED docs/superpowers/specs/2026-10-17-vibe-to-leader-design.md:127], and O6 asks for "a provider behind the adapter after a founder decision, or an explicit DISABLED state" [VERIFIED docs/superpowers/specs/2026-10-17-vibe-to-leader-design.md:140]. **Call** the engines' own grounded APIs: OpenAI Responses `web_search` with `user_location` country `AU`, and Gemini `google_search`. Do not buy Profound, Ahrefs Brand Radar or the Semrush AI toolkit, and do not self-host elmo. All four would breach D4 (zero new dependencies and zero new SaaS) [VERIFIED docs/superpowers/specs/2026-10-17-vibe-to-leader-design.md:34]. **Build** on the code Synthex already has: the geo-citation cron, admin view and event table, plus the `PromptTracker` question list. **Rent** only the question discovery, through the Semrush connector this account already has. The fixing work (proposal 8's "Synthex does the fixing") starts only when the trigger fires: either AI-tagged sign-ups or enrolments are above zero in 2 of 4 consecutive weeks, or a brand's share of appearance is below a competitor's on at least 10 of its 40 questions. The founder sets or confirms those numbers.

**Disposition test.** M13 was deferred because a map-pack rank grid needs a data vendor and a spend decision, and the pilot's binding metric was not shown to be map-pack rank [VERIFIED docs/superpowers/specs/2026-10-17-vibe-to-leader-design.md:325]. AI-answer presence is different in kind for the FD-10 brands, for three reasons:

- RestoreAssist sells software to restoration businesses nationally, and CARSI sells courses nationally. Their buyers ask category questions such as "IICRC water damage course Australia" or "restoration job documentation software", not "near me" questions. A map-pack grid would not cover those [INFERENCE].
- Answer engines answer category questions by naming providers. AI recommendation lists are unstable, so share of appearance is the right measure [VERIFIED https://www.searchenginejournal.com/ai-recommendations-change-with-nearly-every-query-sparktoro/566242/ fetched 22/10/2026].
- The plumbing exists, and no data vendor is needed.

The link to sign-ups and enrolments is **unproven**. No AI-referral volume for either brand has been observed [UNVERIFIED], and the 68.01% zero-click figure is US data, not Australian [VERIFIED https://www.techwyse.com/news/reports-data/google-zero-click-searches-68-percent-2026 fetched 22/10/2026]. The disposition is therefore **Narrow**: the meter and the referrer tag are built, and the actuator is deferred with the trigger above.

Proposal 8's example, "water damage restoration Brisbane", is a Disaster Recovery (local service) question, not a CARSI or RestoreAssist one. For a single-location tradie it falls under the M13 deferral and stays deferred [INFERENCE].

## Goals & non-goals

**Goals**

- G1. Share of appearance for CARSI and RestoreAssist across 40 questions each, two grounded engines, five repeats, weekly, with intervals and `NOT_MEASURED` states.
- G2. Every metered call is quoted, capped and ledgered under the governor, and the run refuses when no budget row exists.
- G3. AI-engine referrers are tagged on `Lead.source` so P6 attribution can count sign-ups and enrolments by engine.
- G4. Fix the defects in the existing meter that would make its numbers wrong (see Approach slice 1).
- G5. A cited-URL report: which domains the engines trust for each question. This is the input a later fixing phase needs.

**Non-goals**

- An "AI rank" or position score. The SparkToro study found a repeated brand list in under 1 in 100 runs, across 12 prompts run 60 to 100 times each (same SEJ source). Position is not reported.
- Panel-scale tracking. Ahrefs reports 30M prompts per platform (wiki 03 §4, single source), and Synthex cannot and need not match that.
- Scraping consumer ChatGPT, AI Overviews or AI Mode pages. That breaks terms and is fragile. Google AI Overviews stays behind the founder-gated adapter [VERIFIED lib/geo-citation/ai-overview-adapter.ts:4-14].
- Local map-pack and suburb grids (M13 stays deferred). Disaster Recovery and other local brands are out of scope for this slice.
- Automatic content, schema or citation changes. These are deferred to the trigger, and when built they go through the AT-003 copy gate and P7 delegated publish.
- Any client-facing report. The admin view is the only surface.

## Approach

**Slice 0: read before you build (zero spend).**

1. Read RestoreAssist's and CARSI's analytics for referrers from `chatgpt.com`, `perplexity.ai`, `gemini.google.com` and `copilot.microsoft.com` over the last 90 days. Record the count, including zero, as the baseline. If the analytics cannot be read, record that as `NOT_MEASURED` [UNVERIFIED: which analytics each site runs].
2. Pull candidate questions from Search Console (`KeywordRankSnapshot`) and from the Semrush connector's `phrase_questions` and `phrase_these` reports with database `au`. The connector exposes domain, keyword, organic and position-tracking reports. It exposes no AI-visibility report, so it supplies questions and volumes, not AI mentions [VERIFIED command: Semrush MCP discovery calls domain_overview, position_tracking, organic_research and keyword_research list no AI-visibility or AI Overview report, 22/10/2026].
3. A person or an agent picks 40 questions per brand and stores them as `PromptTracker` rows with a `questionSetVersion`. Illustrative CARSI questions: "IICRC WRT course Australia", "online mould remediation course Australia". Illustrative RestoreAssist questions: "water damage job documentation app Australia", "IICRC S500 moisture mapping software" [INFERENCE: illustrative, not yet validated against volume].

**Slice 1: make the existing meter correct (no new engine yet).**

- The weekly monitor loops over **users**, not organisations [VERIFIED lib/geo-citation/run-weekly-monitor.ts:147-154] [VERIFIED lib/geo-citation/run-weekly-monitor.ts:186-204]. An organisation with three users therefore triggers three copies of every query. Change the loop to one pass per organisation.
- Brand detection is a single lowercase substring match on the organisation name [VERIFIED lib/geo-citation/run-weekly-monitor.ts:81-101]. Replace it with per-brand aliases plus a domain match on cited URLs. "CARSI" is a short acronym, so it needs word boundaries and a list of known false positives.
- Queries come from the GBP category plus suburb [VERIFIED lib/geo-citation/query-generator.ts:69-77]. That suits local tradies but not national brands. Read the organisation's `PromptTracker` rows instead, and keep the GBP generator as a fallback.
- The cost ledger write is withheld whenever estimated cost is above zero [VERIFIED lib/geo-citation/run-weekly-monitor.ts:256-271]. Route it through the governor instead (slice 2).
- `PromptTracker.targetModel` defaults to `claude-3-5-haiku-20241022` [VERIFIED prisma/schema.prisma:4797]. Replace that retired-looking ID with the engine identifiers in this spec [UNVERIFIED: the retirement status of that ID was not checked against vendor docs today].

**Slice 2: one grounded engine, one brand, canary.**

- Implement an `AnswerEngineFetcher` with the same contract as the adapter: `configured`, `rawText`, `errorReason`, `statusCode` [VERIFIED lib/geo-citation/ai-overview-adapter.ts:21-37]. Add `citedUrls` and `modelVersion`.
- First engine: OpenAI Responses API with the `web_search` tool and `user_location: { country: 'AU' }`. It returns `url_citation` annotations [VERIFIED https://developers.openai.com/api/docs/guides/tools-web-search fetched 22/10/2026].
- Every call goes through `checkBudget` first [VERIFIED lib/ai/governor/budget.ts:131]. An organisation with no `OrgBudgetPolicy` row is refused [VERIFIED lib/ai/governor/budget.ts:22-24].
- Canary: 10 RestoreAssist questions, 5 repeats, one run, on the founder's go.

**Slice 3: second engine and both brands.**

- Add Gemini with the `google_search` tool, which returns the queries it ran and `url_citation` annotations. Gemini 3 and newer models get 5,000 free search requests a month, then US$14 per 1,000 [VERIFIED https://ai.google.dev/gemini-api/docs/google-search fetched 22/10/2026].
- Then run the full weekly set: 2 brands × 40 questions × 2 engines × 5 repeats = 800 calls a week, about 3,470 a month [INFERENCE].
- Gemini may run more than one search per call, so the free 5,000 searches could run out [INFERENCE]. The quote must count searches, not calls.
- Perplexity (`perplexity/sonar`, US$0.25 in and US$2.50 out per 1M tokens) [VERIFIED https://docs.perplexity.ai/getting-started/models fetched 22/10/2026] is a third engine. It is added only if the founder approves a third metered line.
- Claude with web search is excluded. A-18 puts Anthropic work on the Max plan through child threads, and a production cron is not such a thread [VERIFIED DECISIONS.md:35].

**Slice 4: report and referrer tag.**

- The admin view shows share of appearance with Wilson intervals, the cited-domain table, and `NOT_MEASURED` cells.
- The lead intake maps AI referrers to `Lead.source = 'ai:<engine>'`. `Lead.source` already exists [VERIFIED prisma/schema.prisma:7281], so no schema change is needed for the tag. This lands inside P6's attribution work, not beside it.

**Deferred slice 5: fixing (only when the trigger fires).**

- Use the cited-domain table to choose the work: answer-first pages and FAQ schema through the existing gate. `lib/aeo/faq-schema.ts` emits FAQPage schema only where visible Q&A passes brand-voice-enforce [VERIFIED lib/aeo/faq-schema.ts:1-11].
- `lib/geo` already scores citability and schema [VERIFIED lib/geo/schema-enhancer.ts:12-22].
- The vault "AEO 6-pack" briefs are Disaster Recovery-style restoration content. They are a starting library, not CARSI or RestoreAssist briefs [INFERENCE from the sketch headings].
- All publishing goes through the AT-003 gate and P7.

**Existing code not reused as the meter.** `lib/prompts/prompt-tester.ts` sends one ungrounded completion to Claude Haiku through OpenRouter at temperature 0.7, with no web-search tool [VERIFIED lib/prompts/prompt-tester.ts:17] [VERIFIED lib/prompts/prompt-tester.ts:79-102]. It measures what the model remembers, not what an answer engine says today. It stays as a cheap content check, and its results are never reported as O6.

## Open-source candidates

| Project                                                                                                                                                       | Licence     | Stars | pushed_at  | What it gives us                                                                                                                                                                             | Decision                                                   | Evidence                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [elmohq/elmo](https://github.com/elmohq/elmo)                                                                                                                 | MIT         | 479   | 2026-10-21 | Self-hostable AI-visibility tracker. Measures visibility as the share of runs, matches brand by aliases and domains, stores raw output and cited URLs in Postgres, and records query fan-out | study-pattern                                              | [VERIFIED gh api repos/elmohq/elmo]                                                         |
| [Auriti-Labs/geo-optimizer-skill](https://github.com/Auriti-Labs/geo-optimizer-skill)                                                                         | MIT         | 1144  | 2026-10-21 | GEO/AEO audit, optimisation and citation tracking. CLI, Python, MCP                                                                                                                          | study-pattern                                              | [VERIFIED gh api repos/Auriti-Labs/geo-optimizer-skill]                                     |
| [onvoyage-ai/gtm-engineer-skills](https://github.com/onvoyage-ai/gtm-engineer-skills)                                                                         | MIT         | 1330  | 2026-10-11 | Claude skill with 16 AEO/GEO checks and framework-specific fixes. A checklist to compare with `lib/geo` and `lib/aeo`                                                                        | study-pattern                                              | [VERIFIED gh api repos/onvoyage-ai/gtm-engineer-skills]                                     |
| [google/schema-dts](https://github.com/google/schema-dts)                                                                                                     | Apache-2.0  | 1251  | 2026-10-02 | TypeScript types for schema.org JSON-LD, used at compile time only. Not in `package.json` today                                                                                              | depend (only after a D4 exception and supply-chain review) | [VERIFIED gh api repos/google/schema-dts]                                                   |
| [adobe/structured-data-validator](https://github.com/adobe/structured-data-validator)                                                                         | Apache-2.0  | 17    | 2026-10-20 | Validates JSON-LD against schema.org and Google Rich Results rules. Low adoption                                                                                                             | study-pattern                                              | [VERIFIED gh api repos/adobe/structured-data-validator]                                     |
| [yaojingang/GEORank](https://github.com/yaojingang/GEORank)                                                                                                   | Apache-2.0  | 506   | 2026-10-21 | GEO ranking platform. Its rank framing conflicts with the share-of-appearance rule                                                                                                           | study-pattern                                              | [VERIFIED gh api repos/yaojingang/GEORank]                                                  |
| [cxcscmu/AutoGEO](https://github.com/cxcscmu/AutoGEO)                                                                                                         | MIT         | 231   | 2026-06-14 | ICLR'26 research that learns engine preferences and rewrites content. Stale (pushed over 4 months ago, near the 6-month line), research code                                                 | study-pattern                                              | [VERIFIED gh api repos/cxcscmu/AutoGEO]                                                     |
| [ai-search-guru/getcito-worlds-first-open-source-aio-aeo-or-geo-tool](https://github.com/ai-search-guru/getcito-worlds-first-open-source-aio-aeo-or-geo-tool) | NOASSERTION | 496   | 2026-09-28 | AI-visibility tracker. Its licence is unresolved                                                                                                                                             | reject                                                     | [VERIFIED gh api repos/ai-search-guru/getcito-worlds-first-open-source-aio-aeo-or-geo-tool] |
| [AI2HU/gego](https://github.com/AI2HU/gego)                                                                                                                   | GPL-3.0     | 106   | 2026-07-23 | GEO tracking across LLMs. Copyleft, and duplicates elmo                                                                                                                                      | reject                                                     | [VERIFIED gh api repos/AI2HU/gego]                                                          |
| [abhij1306/CiteLadder](https://github.com/abhij1306/CiteLadder)                                                                                               | AGPL-3.0    | 4     | 2026-10-18 | AI-search visibility tracker. AGPL with negligible adoption                                                                                                                                  | reject                                                     | [VERIFIED gh api repos/abhij1306/CiteLadder]                                                |

- **elmohq/elmo.** This is the closest open-source match to the design and the one to read first.
  - Its README states the method this spec adopts: visibility is "the share of runs that mention your brand", brand matching uses names, aliases and domains, and raw engine output is kept so any metric can be re-derived [VERIFIED gh api repos/elmohq/elmo/readme].
  - It separates scraped consumer surfaces from direct model APIs with web search. That is the same line this spec draws: call the APIs, do not scrape.
  - Self-hosting it would be a new service and its own Postgres, which D4 rules out without a founder exception. Its sentiment step uses a third party, Jev (same README).
  - Decision: copy the method, not the code.
- **Auriti-Labs/geo-optimizer-skill and onvoyage-ai/gtm-engineer-skills.** These are MIT checklists for the deferred fixing slice. Compare their checks with `lib/geo` (citability, schema, platform weights) and `lib/aeo` (FAQ schema, brand voice) before writing any new rule.
- **google/schema-dts.** This is the only candidate worth a package. Its types are compile-time only, so they add no runtime code [INFERENCE], and they would let the deferred schema work type-check FAQPage, Course and SoftwareApplication JSON-LD. It still needs a D4 exception and a supply-chain review. Until then, hand-written Zod schemas do the job.
- **Schema validation at run time.** `adobe/structured-data-validator` is current but has little adoption, and `structured-data/linter` (Unlicense, 90★, pushed 2026-04-17) [VERIFIED gh api repos/structured-data/linter] is stale. `digitalbazaar/jsonld.js` reports NOASSERTION [VERIFIED gh api repos/digitalbazaar/jsonld.js], so its licence must be read before any use. Use Google's Rich Results Test by hand in the deferred slice. Do not add a validator.

Nothing is installed by this spec. A supply-chain review runs before any dependency lands. A GitHub search for "llm brand visibility" returned only repos with 0 or 1 star, and "brand mentions chatgpt perplexity" returned nothing [VERIFIED command: gh search repos, 22/10/2026]. That is a finding about those queries, not proof that no other tracker exists.

## Data model

All changes are org-scoped. Migrations go under `prisma/migrations/**`, which is a protected path [VERIFIED scripts/fleet/policy.json protected_paths], so they need a declared fleet commit or the founder's `human-required` label.

- **`GeoCitationEvent`** (table `geo_citation_events`) has `userId` but no organisation column [VERIFIED prisma/schema.prisma:5497-5516]. Add these fields:
  - `organizationId` (required on new rows, nullable for legacy rows), indexed with `queryDate`
  - `runId` (uuid)
  - `promptTrackerId` (nullable, foreign key to `PromptTracker`)
  - `repeatIndex` (Int, 0 to 4)
  - `citedUrls` (Json array of `{url, domain, position}`)
  - `citedOwnDomain` (Boolean)
  - `modelVersion` (String)
  - `questionSetVersion` (String)

  Widen the `searchEngine` values to `openai_web_search` and `gemini_google_search`. The schema comment lists `chatgpt` and `perplexity` [VERIFIED prisma/schema.prisma:5501]. If a database CHECK constraint enforces those values, it must be widened in the same migration [UNVERIFIED: whether the CHECK exists].

- **`PromptTracker`** already has `orgId`, `promptText` and `promptCategory` [VERIFIED prisma/schema.prisma:4789-4813]. Add these fields:
  - `questionSetVersion` (String)
  - `brandAliases` (Json)
  - `brandDomains` (Json)
  - `active` (Boolean)

  Change the `targetModel` default (slice 1).

- **`Lead`**: no change. Use the existing `source` field with an `ai:<engine>` convention.
- **Reads.** Share of appearance is computed when read, from event rows that carry no `errorReason`. It is never stored as a number that could outlive its rows.

## Security & cost guardrails

- **Fail closed on budget.** Every engine call goes through `checkBudget`. No `OrgBudgetPolicy` row means refused (governor doctrine, `budget.ts:22-24`).
  - OpenAI and Gemini calls are metered, so they fall under the $5 daily metered ceiling [VERIFIED DECISIONS.md:35].
  - The weekly quote counts searches as well as tokens, and the run refuses if the quote exceeds the cap. The first full run needs the founder's go.
- **Known overshoot.** The governor's check reads and then decides, so concurrent callers can overshoot by one call each [VERIFIED lib/ai/governor/budget.ts:26-33]. The monitor runs calls serially, one organisation at a time, which removes that race for this job [INFERENCE].
- **Honest states.** A not-configured, rate-limited or failed call is stored with its `errorReason` and excluded from the share. The admin view shows `NOT_MEASURED`, never 0%. This keeps the existing rule that the monitor "NEVER fabricates a citation result" [VERIFIED lib/geo-citation/ai-overview-adapter.ts:12-13].
- **Secrets.** Engine keys are read from the environment through the existing credential path and never logged. No key is added by this spec. Obtaining an OpenAI or Gemini key is a founder step (see Open questions).
- **No scraping, no consumer accounts.** Only the documented APIs are called.
- **Schedule.** Changing the cron schedule touches `vercel.json`, which is protected. Keep the existing Saturday 17:00 UTC entry [VERIFIED vercel.json:85-86] and change only the code it calls.
- **Privacy.** Questions and answers contain no personal information. Raw answers are kept for 90 days, then reduced to cited URLs and the mention flag [INFERENCE: proposed retention].
- **Cost alert.** The existing alert email to contact@unite-group.in at more than AUD 5 a week [VERIFIED lib/geo-citation/run-weekly-monitor.ts:40-42] is replaced by the governor's ceiling, which halts the run instead of only reporting.

## Risk & assumption register

| ID  | Risk or assumption                                                                                          | Likelihood | Impact | Mitigation                                                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| R1  | Grounded API answers differ from what consumers see in the ChatGPT app or AI Overviews                      | H          | M      | Label the metric "API with web search, AU location", never "what ChatGPT shows". The AI Overview adapter stays founder-gated |
| R2  | Five repeats are too few for a stable share                                                                 | M          | M      | Report Wilson intervals. Widen repeats only for questions whose interval spans the competitor's                              |
| R3  | "CARSI" matches unrelated entities                                                                          | M          | M      | Word-boundary match, alias list, known false-positive list, and a domain match on citations                                  |
| R4  | AI referrals to the RestoreAssist trial and CARSI enrolment pages are near zero, so the meter moves nothing | M          | H      | Slice 0 measures this first. If it is zero, the fixing slice stays deferred and the meter runs at canary scale only          |
| R5  | Gemini search fan-out exhausts the 5,000 free searches a month                                              | M          | L      | Quote counts searches, and the cap halts the run                                                                             |
| R6  | Question set drifts, so week-on-week figures are not comparable                                             | M          | M      | `questionSetVersion` on every row, and changes take effect at a version bump only                                            |
| R7  | Scope creep into a white-label AEO product                                                                  | L          | H      | Admin view only. M14 stays cut. Synthex is internal                                                                          |
| R8  | The OpenAI or Gemini key is not available under A-18 (Max plan only)                                        | H          | H      | Engines stay `configured: false` and the report shows `NOT_MEASURED`. Nothing is fabricated                                  |
| A1  | Category questions, not "near me" questions, drive CARSI and RestoreAssist discovery                        | —          | —      | [INFERENCE]. Checked against Search Console queries in slice 0                                                               |
| A2  | Engine APIs keep `url_citation` annotations in their current form                                           | —          | —      | Adapter contract tests with recorded fixtures                                                                                |

## Open questions

- **Q1 (founder only).** May Synthex hold one metered OpenAI key and one Gemini key for this monitor, under the $5 daily ceiling? A-18 says nothing waits on an API key, so the default is no, and the meter reports `NOT_MEASURED`.
- **Q2 (founder only).** What weekly cap applies to O6? The proposal is AUD 5 a week across both brands, with a 10-question canary first.
- **Q3 (founder only).** Confirm the fixing trigger: AI-tagged sign-ups or enrolments above zero in 2 of 4 weeks, or the brand below a competitor on at least 10 of 40 questions.
- **Q4 (founder only).** Ahrefs Brand Radar or the Semrush AI Visibility Toolkit would add breadth, and both are paid add-ons. The default is no: the Semrush connector already available supplies questions only.
- **Q5.** Which analytics tool records referrers on the RestoreAssist trial page and the CARSI enrolment page, and can Synthex read it?
- **Q6.** What are CARSI's canonical domain and aliases? The brand config gives the display name "CARSI" but no domain [VERIFIED packages/brand-config/src/brands/carsi.ts:7-8]. RestoreAssist's domain is `restoreassist.app` [VERIFIED packages/brand-config/src/brands/ra.claims.md:18].
- **Q7.** Which competitors are tracked per brand? Proposed: 3 to 5 each, chosen from the slice-2 canary's most-named names.

## Verification plan

Each check below fails on the defect it guards against. Plant the defect first and watch the check go red before trusting it.

| #   | Command                                                                                                                                | Expected result                                                                                                                                                              | Red-first control                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| V1  | `npx jest tests/unit/geo-citation/run-weekly-monitor.test.ts -t "never mentions when not configured"`                                  | Passes: a fetcher returning `configured:false` with a text containing the brand still writes `brandMentioned:false` and a non-null `errorReason`                             | Temporarily let detection run on unconfigured results, and the test fails                                                  |
| V2  | `npx jest -t "one pass per organisation"`                                                                                              | A synthetic organisation with 2 users, 3 questions, 2 engines and 5 repeats makes exactly 30 fetcher calls                                                                   | The current per-user loop makes 60 calls, so the test is red at HEAD [VERIFIED lib/geo-citation/run-weekly-monitor.ts:186] |
| V3  | `npx jest -t "refuses without budget"`                                                                                                 | No `OrgBudgetPolicy` row gives zero fetcher calls and a `refused_budget_unconfigured` summary                                                                                | Stub `checkBudget` to allow, and the test fails                                                                            |
| V4  | `npx jest -t "share of appearance excludes errors"`                                                                                    | 10 rows, of which 4 mention the brand, 2 are errors and 4 do not mention it, give 4/8 = 0.5 with an interval. All-error rows give `NOT_MEASURED`, not 0                      | Count error rows as non-mentions, and the test fails                                                                       |
| V5  | `npx jest -t "brand detection"`                                                                                                        | "CARSI course" with a citation of `<carsi domain>` is a match. "Carsington" is not. A citation of `restoreassist.app` with no name in the text is a match through the domain | Revert to the plain substring match, and "Carsington" matches, so the test fails                                           |
| V6  | `npx jest -t "ai referrer tag"`                                                                                                        | Referrers `https://chatgpt.com/` gives `ai:chatgpt`, `https://gemini.google.com/app` gives `ai:gemini`, and `https://www.google.com/` gives no tag                           | Map the google.com referrer to an AI tag, and the test fails                                                               |
| V7  | `psql "$DATABASE_URL" -c "select count(*) from geo_citation_events where brand_mentioned and error_reason is not null"`                | `0`                                                                                                                                                                          | Insert one such row in a branch database, and the count reads 1                                                            |
| V8  | `psql "$DATABASE_URL" -c "select count(*) from geo_citation_events where created_at > '<migration date>' and organization_id is null"` | `0`                                                                                                                                                                          | Write one row with no organisation in a test, and the count reads 1                                                        |
| V9  | `grep -rn "claude-3-5-haiku-20241022" prisma/schema.prisma lib/prompts`                                                                | No output after slice 1                                                                                                                                                      | Today it prints `prisma/schema.prisma:4797`                                                                                |
| V10 | `npm run type-check && npm run lint && npm test`                                                                                       | Exit 0                                                                                                                                                                       | —                                                                                                                          |

A green run of V1 to V10 is "local checks pass". It is not O6 measured. O6 is measured only when a production run writes rows with no `errorReason` for both brands and the admin view shows them. Until then, the report reads `NOT_MEASURED`.
