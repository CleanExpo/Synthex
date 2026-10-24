# Model registry and retirement guard: design spec

**Status:** proposal (22/10/2026), not approved for build
**Client metric:** none: internal plumbing — it moves no enrolment or sign-up directly; it prevents the class of failure where a CARSI or RestoreAssist campaign stops mid-run because a generator calls a model the vendor has shut down.
**Rests on:** synthex-intel-07-advantages-and-proposals (proposals 2 and 11), synthex-intel-05-llm-vendor-docs-2026-10 (deprecation tables and the "stale ID" checklist), Sketches/synthex-intel-refresh-2026-10-22 (Loop 1) and repo evidence in `lib/ai/model-registry.ts`, `lib/ai/governor/model.ts`, `lib/services/ai/image/registry.ts`, `lib/services/ai/video/registry.ts` and `scripts/audit-governor-model-strings.mjs`
**Relation to the fleet programme:** extends P5 (the Governor and quote mode resolve the model before any spend, so the lifecycle data lands where P5 already reads) and the K12 risk row ("vendor, lane or beta change under the fleet") in `2026-10-17-vibe-to-leader-design.md`. No phase owns retire dates or a retired-ID CI check today, so this does not duplicate a phase.

## Finish line

Every model ID Synthex can call (text, image, video, embedding, audio) has exactly one catalogue entry carrying provider, capability, retire date, replacement and sampling rule, and its status (active, deprecated, retired) is computed from that date rather than typed by hand. `node scripts/audit-governor-model-strings.mjs --lifecycle --scope . --as-of <date>` exits 1 and prints file and line for any model ID in code or config outside `tests/` and fixtures that is retired or retires within 60 days of `<date>`; it exits 0 on the fixed tree; and its `--selftest` proves a planted retired ID turns it red. A weekly watcher writes a dated change list of vendor deprecation pages into the vault 05 page and a list of affected Synthex file:line findings, and it never edits Synthex code.

## Decision up front

Build, small, inside what exists. The brief says "extend the image registry", but the repo has three catalogues, not one: text in `lib/ai/model-registry.ts`, which the AI Governor already resolves every governed call against [VERIFIED lib/ai/governor/model.ts:22-27], image in `lib/services/ai/image/registry.ts` (boolean `deprecated`) and video in `lib/services/ai/video/registry.ts` (no lifecycle field at all). This spec therefore deviates from the brief's wording on purpose: the spine is the text registry the Governor uses, and the image and video catalogues keep their own pricing and tier logic but adopt one shared `Lifecycle` type and feed one read-only lookup. That is one registry contract across three data files, not a fourth registry. The CI check extends the existing parser-based audit script rather than adding a second scanner. The watcher reuses the vault's `academy-weekly-llm-monitor` output path and log convention and adds a page-diff step; no hosted watcher service and no paid data feed are bought. External catalogues (models.dev, LiteLLM's JSON, OpenRouter's models endpoint) are read only as cross-checks, because none of them carries reliable retire dates and vendor pages always win.

Disposition test: it does not move O1-O7 or the client metric for a single-location business, CARSI or RestoreAssist. It is still recommended because the live default for campaign concept images is a shut-down model (see Approach, slice 0) and the guard costs hours, not weeks. If the founder wants only metric-moving work in FD-10, cut to slice 0 and slice 1 and defer the rest.

## Goals & non-goals

**Goals**

- G1. One lifecycle contract for every model ID: `retireDate`, `replacement`, `announcedOn`, `source` URL, `sampling` rule, `capability` (text, image, video, embedding, audio).
- G2. Status computed at check time from `retireDate` and an `asOf` date, never stored, so it cannot go stale the way a typed enum does.
- G3. A CI check that fails on a retired or within-60-days model ID outside tests and fixtures, with a positive control.
- G4. Tombstones: IDs removed from a catalogue (for example `claude-3-opus-20240229`, `dall-e-3`, Veo 3.1) stay findable as retired, so deleting an entry does not make its leftover references invisible.
- G5. The sampling-parameter rule (omit `temperature`, `top_p`, `top_k` where the model rejects them) comes from the registry, not from one provider's regex.
- G6. A weekly watcher that refreshes retire dates from vendor deprecation pages and reports, never edits.

**Non-goals**

- NG1. Automatic model switching. The Model Scout cron already "does not auto-switch models — surfaces signals only" [VERIFIED app/api/cron/model-scout/route.ts:10]; this keeps that rule.
- NG2. Moving the registry into the database. The Governor header says the registry stays a file in git so a model change is a reviewable PR [VERIFIED lib/ai/governor/model.ts:4-10].
- NG3. Choosing replacement models for quality. This spec records the vendor-named replacement; picking the best model per task stays with evals and P8.
- NG4. Any change to billing, pricing or customer surfaces. None exist in scope.
- NG5. Upgrading to Anthropic API version `2026-10-21`. The spec makes that upgrade safe later; it does not do it.

## Approach

**Slice 0 — fix the live breakages found by hand (one PR, no new machinery).**

- `lib/services/campaign-concept-studio.ts:23` defaults the image model to `dall-e-3` [VERIFIED lib/services/campaign-concept-studio.ts:23], and `.env.example` sets `CAMPAIGN_CONCEPT_IMAGE_MODEL=dall-e-3` [VERIFIED .env.example:82]. OpenAI's deprecations page lists DALL-E as shut down on 12/05/2026 [UNVERIFIED in this run: the wiki coordinator note says it opened the page; this run confirmed only the `gpt-image-1` row, below]. Route this default through `selectImageModel` instead of a literal.
- The text registry lists `gpt-4-turbo` as not deprecated [VERIFIED lib/ai/model-registry.ts:68,79]; OpenAI shuts it down on 23/10/2026 per the wiki table [INFERENCE from synthex-intel-05 line 124]. It lists `gemini-2-0-flash` and `google/gemini-2.0-flash` as not deprecated [VERIFIED lib/ai/model-registry.ts:324,342] [VERIFIED lib/ai/model-registry.ts:504,515], though Google shut Gemini 2.0 Flash on 01/06/2026 [INFERENCE from synthex-intel-05 line 169].
- `prisma/schema.prisma` defaults `targetModel` to `claude-3-5-haiku-20241022` [VERIFIED prisma/schema.prisma:4797], retired 19/02/2026 per the wiki. Changing a column default needs a migration, and `prisma/migrations/**` is a protected path [VERIFIED scripts/fleet/policy.json:75]: declared fleet commit or the founder's `human-required` label.
- Honest scope note: most of the "21 `claude-3-opus` references" sit in `config/openrouter_settings.json` and `config/platform-master-config.json`. `git grep -F openrouter_settings` outside `docs/` found no reader, and the two files that import `platform-master-config.json` contain none of its model keys (`reasoning_model`, `primary_model`, `complex_tasks`) [INFERENCE from git grep over app, lib, scripts, components on 22/10/2026]. They look like dead config: delete or leave to proposal 5's removal list, but they are not live outages.

**Slice 1 — the lifecycle contract and the CI check (thinnest guard).**

1. Add `lib/ai/model-lifecycle.ts` exporting:
   ```ts
   export type ModelCapability =
     | 'text'
     | 'image'
     | 'video'
     | 'embedding'
     | 'audio';
   export interface Lifecycle {
     retireDate?: string; // YYYY-MM-DD from the vendor page; absent = no date announced
     announcedOn?: string;
     replacement?: string; // vendor-named replacement ID, or 'none' (e.g. Sora)
     source: string; // vendor deprecation/models URL the date came from
     verifiedOn: string; // date a human or the watcher last matched it to source
   }
   export type ModelStatus = 'active' | 'deprecated' | 'retired';
   export function statusOf(
     l: Lifecycle,
     asOf: Date,
     warnDays = 60
   ): ModelStatus;
   export const TOMBSTONES: Array<
     { id: string; provider: string; capability: ModelCapability } & Lifecycle
   >;
   ```
   `statusOf`: no `retireDate` gives active; a `retireDate` after `asOf` gives deprecated; `retireDate <= asOf` gives retired. A separate `daysToRetire(l, asOf)` feeds the CI rule, which fails on retired, or on deprecated with `daysToRetire <= warnDays`.
2. Add an optional `lifecycle?: Lifecycle` and `sampling?: 'accepts' | 'omit'` to `ModelConfig` (text, keeping `isDeprecated` as a derived compatibility field until callers move), `ImageModel` (keeping `deprecated` likewise) and `VideoModelSpec`. Existing `isModelAvailable` [VERIFIED lib/ai/model-registry.ts:649-654] and `selectImageModel` [VERIFIED lib/services/ai/image/registry.ts:433-459] then read `statusOf(...) !== 'retired'`, so the Governor's `model_deprecated` refusal [VERIFIED lib/ai/governor/model.ts:67-72] starts honouring dates with no Governor code change.
3. Add `lib/ai/model-catalogue.ts`: a read-only view that imports the three arrays plus `TOMBSTONES` and exposes `lookup(id)` and `allIds()`. It holds no data of its own.
4. Extend `scripts/audit-governor-model-strings.mjs` with `--lifecycle` and `--as-of YYYY-MM-DD`. It already parses TS/JS with the TypeScript compiler, matches model-ID shapes and has a `--selftest` positive control [VERIFIED scripts/audit-governor-model-strings.mjs:88-96] [VERIFIED scripts/audit-governor-model-strings.mjs:67-71]. In lifecycle mode each literal is looked up in the catalogue: retired or within 60 days exits 1; an ID shape not in the catalogue is reported as `unregistered` (warning in slice 1, error once the baseline is clean). Add a plain exact-ID scan for `.json`, `.prisma` and `.env.example`, because the hits above live there and the parser path reads code only. Exclusions are exactly `tests/**`, `**/__tests__/**`, `**/*.test.*`, `**/*.spec.*`, `**/fixtures/**` and `docs/**`, and the selftest asserts that a planted ID in `lib/` is still caught. Exit 2 when the catalogue cannot be imported, so a broken import never reads as clean.
5. Wire it: `package.json` script `audit:models` (not protected). The CI step in `.github/workflows/ci.yml` touches `.github/**`, a protected path [VERIFIED scripts/fleet/policy.json:61]: declared fleet commit or `human-required` label. Today the script is wired to nothing: no hit in `package.json` or `.github/workflows/` [INFERENCE from grep on 22/10/2026].
6. Note the check is date-dependent by design: a green commit can turn red as a retire date approaches. That is the purpose. `--as-of` keeps tests reproducible.

**Slice 2 — the sampling rule from the registry.**

- Today `anthropicOmitsSampling` matches `claude-(sonnet|opus|haiku)-[5-9]` and `claude-opus-4-[6-9]` [VERIFIED lib/ai/providers/anthropic-provider.ts:27-31]. It does not match `claude-fable-*` (Fable 5, Fable 5.1), so a temperature on a Fable call would pass through [INFERENCE from the regex text; whether Fable rejects it is UNVERIFIED]. models.dev marks `claude-opus-4-7`, `claude-opus-4-8` and `claude-sonnet-5` as `temperature = false` and `claude-sonnet-4-6`, `claude-opus-4-6` and `claude-haiku-4-5-20251001` as `temperature = true` [VERIFIED gh api repos/anomalyco/models.dev], so the regex agrees with it today on the IDs both cover (it omits for `opus-4-6` too, which is safe). OpenRouter's `supported_parameters` omits `temperature` for `anthropic/claude-opus-4.8` and `anthropic/claude-sonnet-5` [VERIFIED https://openrouter.ai/api/v1/models fetched 22/10/2026].
- Change: `anthropicOmitsSampling(id)` returns the registry's `sampling === 'omit'` when the ID is registered, and falls back to the regex plus `claude-fable-` for unknown IDs. Unknown Claude IDs default to omit (fail safe: a missing temperature never 400s).
- Other call sites that set temperature (searched `app/` and `lib/`, 124 lines in 60+ files mention `temperature`; the ones below were opened):
  - `lib/ai/openrouter.ts` defaults `temperature = 0.7` for every OpenRouter model [VERIFIED lib/ai/openrouter.ts:34] and `lib/ai/openrouter-client.ts` spreads the request straight into the body [VERIFIED lib/ai/openrouter-client.ts:99-100]. When the model is `anthropic/claude-opus-4.8` or `-sonnet-5`, the parameter is unsupported upstream; whether OpenRouter drops it silently or errors is [UNVERIFIED]. Apply the same registry rule in the OpenRouter client.
  - `lib/ai/content-generator.ts` sets `temperature: 0.8` [VERIFIED lib/ai/content-generator.ts:744]; it goes through a provider, so the provider rule covers it once the provider consults the registry [INFERENCE].
  - `app/api/demo/caption/route.ts` sets temperature on its Gemini (`:63`), OpenRouter Llama (`:109`) and OpenAI (`:175`) paths [VERIFIED app/api/demo/caption/route.ts:109] [VERIFIED app/api/demo/caption/route.ts:175]; its direct Anthropic path sends `anthropic-version: 2023-06-01` [VERIFIED app/api/demo/caption/route.ts:131]. No Claude call site in this file sets temperature in the lines opened.
  - Direct Anthropic fetch sites `lib/ai/content-evaluator.ts`, `lib/authority/source-connectors/claude-web-search.ts`, `lib/videos/generateCaseStudyScript.ts`, `lib/ai/structured-output.ts` and `app/api/ask-synthex/route.ts` had no `temperature` match on 22/10/2026 [INFERENCE from git grep of those five files]. `claude-web-search.ts` pins `claude-opus-4-5` [VERIFIED lib/authority/source-connectors/claude-web-search.ts:52], which the wiki flags as retiring not sooner than 24/11/2026: the slice 1 check will flag it once a date is entered.
- Add a lint rule to the audit: a `temperature`/`top_p`/`top_k` key in an object literal that also contains a literal Claude ID is a finding.

**Slice 3 — the weekly watcher (reuse, do not rebuild).**

- The vault's `academy-weekly-llm-monitor` already sweeps Anthropic, OpenAI and Google changelogs weekly and writes into `knowledge/ai-llm`; its last logged run is 06/09/2026 [VERIFIED /Users/phill-mac/2nd Brain/Wiki/log.md:150]. Its definition and scheduler were not found in `~/2nd Brain`, `~/.claude/scheduled-tasks` or `~/Library/LaunchAgents` [UNVERIFIED where it is defined or why it stopped]. Before building, find and restart it; if it cannot be found, recreate it under the same name, output path and log format.
- Add a diff step: fetch the three deprecation pages (Anthropic, OpenAI, Google), which return HTTP 200 as static HTML containing the rows (`claude-sonnet-4-5-20250929` with "November 30, 2026"; `gpt-image-1` with "October 23, 2026"; `gemini-2.5-flash-image` with "March 15, 2027") [VERIFIED https://platform.claude.com/docs/en/about-claude/model-deprecations fetched 22/10/2026] [VERIFIED https://developers.openai.com/api/docs/deprecations fetched 22/10/2026] [VERIFIED https://ai.google.dev/gemini-api/docs/deprecations fetched 22/10/2026]. No headless browser is needed. Extract `(id, retire date, replacement)` rows, diff against last week's snapshot, write the changes under a dated heading in synthex-intel-05 and a `proposed-lifecycle.json` patch.
- Run the slice 1 check against the patch with `--as-of today` and list Synthex file:line hits as backlog findings.
- Cross-check only: compare against LiteLLM `deprecation_date` and OpenRouter `expiration_date`; a disagreement is flagged for a human, never auto-applied (see the Gemini 2.5 case below).
- It never edits Synthex code (sketch no-go). A human or a gated build agent turns `proposed-lifecycle.json` into a registry PR.

## Open-source candidates

| Project                                                                                                     | Licence                                               | Stars | pushed_at  | What it gives us                                                                                                                                                                                                                                                                                                                                                                                                                               | Decision                                                                                            | Evidence                                                     |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| [anomalyco/models.dev](https://github.com/anomalyco/models.dev) (the `sst/models.dev` call redirected here) | MIT                                                   | 7336  | 2026-10-21 | Open catalogue of providers and models in TOML, served as `https://models.dev/api.json`. Per-model `temperature` boolean, modalities, limits, cost. `status` is only `alpha`/`beta`/`deprecated` with no date, and `claude-sonnet-4-5-20250929` carries no status despite its 30/11/2026 retirement                                                                                                                                            | call-as-service (read `api.json` as a cross-check for sampling flags and new IDs)                   | [VERIFIED gh api repos/anomalyco/models.dev]                 |
| [BerriAI/litellm](https://github.com/BerriAI/litellm)                                                       | NOASSERTION (LICENSE file: MIT outside `enterprise/`) | 61751 | 2026-10-21 | `model_prices_and_context_window.json`: 4,245 entries, 867 with `deprecation_date`. Has `gpt-image-1` 2026-10-23, `o4-mini` 2026-10-23, `claude-sonnet-4-5-20250929` 2026-11-30. Missing `claude-3-opus-20240229` and `dall-e-3` outright (retired models are dropped, so absence is not "unknown"), no date on `gpt-4o` (OpenAI: 14/01/2027), and a Vertex date of 2026-10-20 on `gemini-2.5-flash` that Google's Gemini API page contradicts | call-as-service (read raw JSON as a second cross-check; never the source of truth)                  | [VERIFIED gh api repos/BerriAI/litellm]                      |
| [vercel/ai](https://github.com/vercel/ai)                                                                   | NOASSERTION (LICENSE file: Apache-2.0)                | 27436 | 2026-10-21 | Already a dependency (`ai` ^6.0.277, `@ai-sdk/anthropic`). `createProviderRegistry` resolves `provider:model` strings to provider instances; the only "deprecated" markers in `provider-registry.ts` are on API methods, not models. No lifecycle data                                                                                                                                                                                         | study-pattern (the `provider:model` ID shape for `model-catalogue.ts`; no new install)              | [VERIFIED gh api repos/vercel/ai]                            |
| [OpenRouterTeam/ai-sdk-provider](https://github.com/OpenRouterTeam/ai-sdk-provider)                         | Apache-2.0                                            | 691   | 2026-10-21 | The repo is OpenRouter's AI SDK provider; the useful part is the hosted `GET /api/v1/models` (no key needed): 468 models, `expiration_date` set on only 11, none of them the IDs Synthex uses; `supported_parameters` shows which models accept `temperature`                                                                                                                                                                                  | call-as-service (the endpoint, as a sampling cross-check for OpenRouter-routed IDs)                 | [VERIFIED gh api repos/OpenRouterTeam/ai-sdk-provider]       |
| [dgtlmoon/changedetection.io](https://github.com/dgtlmoon/changedetection.io)                               | Apache-2.0                                            | 35185 | 2026-10-19 | Self-hosted page-change watcher with notifications. It can watch the three vendor deprecation pages, but they are static HTML, so a fetch-and-diff step in the existing monitor does the same job without a new always-on service                                                                                                                                                                                                              | study-pattern (revisit as call-as-service only if a vendor page moves behind client-side rendering) | [VERIFIED gh api repos/dgtlmoon/changedetection.io]          |
| [agentstation/starmap](https://github.com/agentstation/starmap)                                             | AGPL-3.0                                              | 4     | 2026-10-20 | Auto-updating model catalogue CLI/server. AGPL and very low adoption                                                                                                                                                                                                                                                                                                                                                                           | reject                                                                                              | [VERIFIED gh api repos/agentstation/starmap]                 |
| [techdevsynergy/llm-model-deprecation](https://github.com/techdevsynergy/llm-model-deprecation)             | none (no licence)                                     | 0     | 2026-03-09 | Deprecation-status checker; stale (over 6 months since push), unlicensed, no users                                                                                                                                                                                                                                                                                                                                                             | reject                                                                                              | [VERIFIED gh api repos/techdevsynergy/llm-model-deprecation] |

**Answers to the OSS questions.**

- _Does an existing model-catalogue dataset cover this?_ Partly, and none is safe as the source. models.dev has the best sampling metadata (`temperature`) but no retire dates. LiteLLM has dates on about a fifth of entries, drops retired models and mixes Vertex and Gemini-API dates; for `gemini-2.5-flash` its Vertex row says 2026-10-20 while Google's Gemini API page says the 2.5 models "are not deprecated" and access is limited to past users [VERIFIED https://ai.google.dev/gemini-api/docs/deprecations fetched 22/10/2026]. OpenRouter dates almost nothing. The Vercel AI SDK registry is an alias resolver with no lifecycle. So: vendor pages are the source; models.dev, LiteLLM and OpenRouter are cross-checks that raise a flag when they disagree.
- _Can a page-change watcher watch vendor deprecation pages?_ Yes: changedetection.io (Apache-2.0, active) could, and the pages are fetchable as plain HTML. It is not needed: the existing monitor plus a diff step covers it without another service to host.
- Nothing is installed by this spec. If a later slice adds any package, a supply-chain review runs before it lands.

## Data model

None in the database. The registry stays versioned config in git, per the Governor's design [VERIFIED lib/ai/governor/model.ts:4-10]. Changes are TypeScript types and data: the `Lifecycle` type, `TOMBSTONES`, and optional `lifecycle`/`sampling` fields on the three catalogue entry types. Model choice is not org-scoped data today and stays global; per-org spend is already handled by the Governor and metering.

One protected follow-up: the `targetModel` default of `claude-3-5-haiku-20241022` [VERIFIED prisma/schema.prisma:4797] needs a migration under `prisma/migrations/**` (protected). Existing rows keep their stored value; a backfill to the registry's current Haiku is a separate, founder-labelled step.

The watcher's snapshot and `proposed-lifecycle.json` live in the vault, not in the Synthex repo or database.

## Security & cost guardrails

- The watcher fetches public pages only; it needs no API key. Any future cross-check that needs a key resolves it through the documented credential resolver and never writes it to the vault.
- The watcher never edits Synthex code, never opens a PR on its own and never changes a model; it writes findings (sketch no-go list).
- Cost: page fetches and diffs need no model. If the monitor summarises with a model, it uses the cheapest current Haiku with a hard per-run cap; the Governor's existing caps apply to anything run inside Synthex.
- Fail closed: an unpriced image model already refuses generation (`UnpricedModelError`) [VERIFIED lib/services/ai/image/registry.ts:287-301]; a retired model is refused by `resolveModel`; the audit exits 2 when it cannot load the catalogue. A failed vendor fetch is reported as "not checked", never as "no changes".
- Protected paths touched by follow-ups: `.github/**` (CI wiring) and `prisma/migrations/**` (column default). Both need a declared fleet commit or the founder's `human-required` label. Slices 0 to 2 otherwise touch only unprotected `lib/`, `app/`, `scripts/` (outside the protected `scripts/fleet|jev|release|gate|truth/**`) and `package.json`.

## Risk & assumption register

| #   | Risk or assumption                                                                                     | Likelihood       | Impact                       | Mitigation                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------ | ---------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Date-based CI turns `main` red with no code change as a retire date nears                              | High (by design) | Medium: blocks unrelated PRs | 60-day warning window gives two months; findings name the replacement; `--as-of` for tests. Founder decides whether red blocks merges or only warns in the first month (Q2) |
| R2  | Vendor page layout changes and the parser extracts nothing                                             | Medium           | High: silent staleness       | Zero extracted rows on a page that had rows last week is an error, reported as "not checked"                                                                                |
| R3  | Cross-check sources disagree with vendor pages (LiteLLM Vertex date vs Gemini API)                     | Observed         | Medium                       | Vendor page wins; disagreement is a human flag, never auto-applied                                                                                                          |
| R4  | IDs built at runtime (concatenation, env vars) escape the static check                                 | Certain for some | Medium                       | The audit already documents this hole; the runtime Governor refusal is the boundary. Env defaults like `process.env.X \|\| 'dall-e-3'` are literals and are caught          |
| R5  | Alias IDs (`claude-sonnet-5`) and dated snapshots (`claude-haiku-4-5-20251001`) are tracked separately | Medium           | Low                          | `model-catalogue.ts` records alias-to-snapshot pairs; a retire date on a snapshot applies to its alias only if the vendor page says so                                      |
| R6  | The vault monitor has not run since 06/09/2026 and its definition was not found                        | Observed         | Medium: slice 3 has no host  | Find or recreate it first (Q3)                                                                                                                                              |
| R7  | OpenRouter silently drops or rejects `temperature` for Claude 4.7+                                     | Unknown          | Low to medium                | Apply the registry sampling rule in the OpenRouter client regardless                                                                                                        |
| R8  | A dead config file is actually read by a path git grep did not cover                                   | Low              | Medium                       | The audit scans config JSON anyway; deletion goes through a normal reviewed PR                                                                                              |

## Open questions

1. **(Founder)** May the CI step be added to `.github/workflows/ci.yml` (protected), via a declared fleet commit or your `human-required` label?
2. **(Founder)** Should a within-60-days finding block merges from day one, or warn for the first 30 days and block after?
3. **(Founder)** Where does `academy-weekly-llm-monitor` run, and may it be restarted and extended with the diff step? It has not logged since 06/09/2026.
4. **(Founder)** May the `prisma` `targetModel` default migration go ahead under the `human-required` label?
5. Should `config/openrouter_settings.json` and the `ai`/automation model keys in `config/platform-master-config.json` be deleted now, or left to proposal 5's removal list?
6. Which replacement should `gpt-4o-mini` defaults in `lib/ai/providers/openai-provider.ts:34-39` move to before the 14/01/2027 shutdown? An eval question for P8, not for this spec.
7. Does OpenRouter drop or reject `temperature` for Anthropic models that do not support it? One test call answers it.

## Verification plan

Run from the worktree root after slices 1 and 2. Each check must have been seen red before it counts.

```bash
# 1. Existing positive control still holds (plants a violation, must catch it)
node scripts/audit-governor-model-strings.mjs --selftest
# expect: exit 0 (selftest passed: planted violation was caught)

# 2. Red today: the live dall-e-3 default and the retired Prisma default are found
node scripts/audit-governor-model-strings.mjs --lifecycle --scope . --as-of 2026-10-22
# expect BEFORE slice 0: exit 1, output includes
#   lib/services/campaign-concept-studio.ts:23 dall-e-3 retired
#   prisma/schema.prisma:4797 claude-3-5-haiku-20241022 retired
# expect AFTER slice 0 (and the labelled migration): exit 0

# 3. Planted retired ID in live code turns it red; removing it turns it green
printf "export const m = 'claude-3-opus-20240229';\n" > lib/__lifecycle_probe.ts
node scripts/audit-governor-model-strings.mjs --lifecycle --scope lib --as-of 2026-10-22   # expect exit 1, names lib/__lifecycle_probe.ts:1
rm lib/__lifecycle_probe.ts
node scripts/audit-governor-model-strings.mjs --lifecycle --scope lib --as-of 2026-10-22   # expect exit 0

# 4. The 60-day boundary (claude-sonnet-4-5-20250929 retires 2026-11-30)
printf "export const m = 'claude-sonnet-4-5-20250929';\n" > lib/__lifecycle_probe.ts
node scripts/audit-governor-model-strings.mjs --lifecycle --scope lib --as-of 2026-10-01   # 60 days out: expect exit 1
node scripts/audit-governor-model-strings.mjs --lifecycle --scope lib --as-of 2026-09-30   # 61 days out: expect exit 0
rm lib/__lifecycle_probe.ts

# 5. Exclusions are exactly tests and fixtures, not wider
printf "export const m = 'dall-e-3';\n" > tests/unit/__lifecycle_probe.test.ts
node scripts/audit-governor-model-strings.mjs --lifecycle --scope . --as-of 2026-10-22     # expect: probe NOT listed
rm tests/unit/__lifecycle_probe.test.ts

# 6. Broken catalogue import never reads as clean
#    (selftest case: point the loader at a missing module) expect exit 2

# 7. Unit tests
npx vitest run tests/unit/ai/model-lifecycle.test.ts
# expect: statusOf() cases pass (no date -> active; 2026-11-30 as of 2026-10-22 -> deprecated;
#         2026-05-12 as of 2026-10-22 -> retired); every catalogue ID is unique across
#         text, image, video and TOMBSTONES; every entry with a retireDate has a source URL
npx vitest run tests/unit/ai/governor/governor-model-registry.test.ts
# expect: a pinned call to a TOMBSTONES id is refused with model_deprecated / not-in-registry

# 8. Sampling rule
npx vitest run tests/unit/ai/providers/anthropic-sampling.test.ts
# expect: for every registry entry with sampling 'omit', anthropicSamplingParams(id, {temperature: 0.8}) === {};
#         'claude-fable-5-1' and an unknown 'claude-opus-9-9' also return {} (fail safe);
#         FAILS on today's code for claude-fable-5-1 (regex gap), passes after slice 2

# 9. Watcher (slice 3), against saved page copies with one planted row
#    expect: the planted (id, date) appears in the dated change list and as a file:line finding;
#            a page with zero extracted rows reports "not checked", never "no changes"
```
