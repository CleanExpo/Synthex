# Brand rules layer: design spec

**Status:** proposal (22/10/2026), not approved for build
**Client metric:** both — RestoreAssist trial sign-up posts and CARSI enrolment posts can only be produced at autonomous volume once a blocking, deterministic check stops a wrong trial claim or an implied IICRC endorsement before a human or the publish queue ever sees it.
**Rests on:** synthex-intel-07-advantages-and-proposals (proposal 6, plus "Compliance built into the approval gate"), synthex-intel-03-ai-marketing-platforms (build-buy-call row "Brand knowledge and rules per business — Replicate"; Typeface Arc Graph and Jasper IQ notes), synthex-intel-02-agency-groups (WPP/Monks "Brand (compliance) Agent" pattern) and repo evidence in `packages/brand-config`, `lib/aeo`, `lib/agency`, `lib/marketing-agency`, `prisma/schema.prisma`
**Relation to the fleet programme:** extends P8 "Content, claims and image quality" and gap M9 by supplying the per-brand source of truth that the planned JEV families J5 (content quality) and J6 (claims register) need; it does not duplicate P8's judge or ledger work, and, like P8, it leaves brand voice and image taste to the human rank-and-reject loop [VERIFIED docs/superpowers/specs/2026-10-17-vibe-to-leader-design.md:492] [VERIFIED docs/superpowers/specs/2026-10-17-vibe-to-leader-design.md:342-343]

## Finish line

For each portfolio business that has a claims register (RestoreAssist `ra`, CARSI `carsi`, Disaster Recovery `dr`), there is one machine-readable rule set (banned words, banned claims, the approved-claims register with expiry, Australian spelling, and IICRC and insurance term rules) inside `packages/brand-config`. Every text draft that passes through the existing mechanical gate `enforceBrandVoice` is checked against it, and the result can block. A draft for RestoreAssist that says "guaranteed claim approval", a CARSI draft that implies IICRC endorsement, a draft that uses "color" or "organize", or a draft that quotes an expired approved claim fails with a rule ID and the matching text. A draft with no brand resolved still goes to a human, as it does today. Marketing-agency campaigns enforce the `forbiddenClaims` they already accept. `npm run brand:rules:check` exits 0 on main and exits 1 when a planted bad register or bad draft is added. Whether the voice is right and whether an image is good stay human judgements. No result from this layer says otherwise.

## Decision up front

**Build, in place.** Do not add a new store or a new table. Synthex already has the pieces of a brand rules layer, but they are spread across five places that do not talk to each other. The plan is to make the existing `packages/brand-config` package (the typed `BrandConfig` and the `<slug>.claims.md` sidecars) the one source per business, and to add four deterministic rules (R10 to R13) to the existing R1–R9 gate in `lib/aeo/rules.ts`. Rule logic is written in-house in TypeScript, with no LLM. Vale's rule types are used as a design pattern. The only possible dependency is `harper.js` for Australian spelling (Apache-2.0), and only after a supply-chain review and a bundle-size check. Visual-identity token standards (W3C DTCG, Style Dictionary) are deferred because they do not move either client metric in the next 30 days.

**Founder-decision line (needs Phill's yes):** *Machine-checkable, and allowed to block:* banned words and phrases, banned claims, numbers or certification, insurance and endorsement wording that is not in the approved-claims register, approved claims past their expiry, Australian spelling, the canonical IICRC term forms (for example, never dropping "aligned" from a standards claim), reading level, length, and required qualifications inside a claim. *Human judgement only, and never reported as a pass by a machine:* whether the copy sounds like the brand, whether an image is tasteful or on-brand, whether a new claim is true enough to approve, and brand strategy. The existing Haiku voice score in HERMES stays advisory. This is the same line the fleet spec draws for P8.

**Disposition test:** this passes for RestoreAssist and CARSI only, the two FD-10 businesses. Both already have founder-curated claims registers that no code reads. Turning those registers into a blocking check is what lets autonomous drafting run at volume without every post needing a human claims read. For DR the rule set is seeded but not prioritised. CCW, NRPG, Unite, John Coutis and managed-service clients are **deferred** (see Approach, slice 4). The visual-token work is **cut** from this spec.

## Goals & non-goals

**Goals**

- One source per business for voice rules, approved claims, banned claims, compliance terms and visual tokens: `packages/brand-config/src/brands/<slug>.ts` plus `<slug>.claims.md` [VERIFIED packages/brand-config/src/types.ts:101-126] [VERIFIED packages/brand-config/src/brands/ra.claims.md:1-22].
- A blocking deterministic check of claims, terms and spelling on every path that already calls `enforceBrandVoice`: workflow steps, the autonomous executor and FAQ schema [VERIFIED lib/agency/brand-voice-gate.ts:71] [VERIFIED lib/workflow/step-types/brand-voice-gate.ts:55-58].
- The marketing-agency campaign generator enforces the `forbiddenClaims` it already accepts in its API schema.
- A register health check: every approved claim has a source URL and a verified date, and none is past its expiry.
- Seed data that cannot contradict the register. Today the Disaster Recovery seed voice carries "Insurance-approved restoration, coordinated fast." as a sample phrase [VERIFIED lib/agency/portfolio-brand-configs.ts:51], and no approved claim in `dr.claims.md` supports "insurance-approved" [VERIFIED command: grep -n -i "insur" on the three claims files finds only the "$1M+ coverage" and "54% insured Australians" rows, 22/10/2026].

**Non-goals**

- Judging brand voice or image taste by machine (founder line above).
- A new brand database table, a brand UI or a brand-extraction-from-URL feature. Extraction (dembrandt and similar, already on the radar) is a different gap.
- Changing image generation. The real-images-only rule and its sole entry point `generateImage()` stay as they are [VERIFIED .claude/rules/real-images-only.md:11-20] [VERIFIED lib/services/ai/image-generation.ts:1489].
- Persona org-scoping. That is the separate, founder-gated `.planning/BRAND-ISOLATION-MEDIA-PERSONA-PLAN.md`, and `Persona` still has no `organizationId` on main [VERIFIED prisma/schema.prisma:1396-1430] [VERIFIED .planning/BRAND-ISOLATION-MEDIA-PERSONA-PLAN.md:3].
- The Spam Act unsubscribe check and AI-ad disclosure. Both belong in the approval gate (intel-07 compliance list). This layer only supplies the per-brand terms they need.
- Any launch, pricing or customer-readiness framing. Synthex is internal.

### What already exists (the five scattered pieces)

| # | Piece | What it holds | Who reads it | Gap |
|---|---|---|---|---|
| 1 | `packages/brand-config` `BrandConfig` per slug | voice tone, `forbiddenWords`, `doNot`, reading level, colour, type, logo, motion, voiceover locale, `tokenStatus` [VERIFIED packages/brand-config/src/types.ts:77-126] | `enforceBrandVoice` R1–R5 [VERIFIED lib/aeo/rules.ts:16-88] | No `ccw` slug [VERIFIED packages/brand-config/src/types.ts:1-8]; no claims |
| 2 | `<slug>.claims.md` sidecars (ra, carsi, dr) | `facts_approved` with `source_url`, `verified_on`, `expires_on`; standing prohibitions in prose [VERIFIED packages/brand-config/src/brands/ra.claims.md:8-22] [VERIFIED packages/brand-config/src/brands/carsi.claims.md:120-143] | Only the synthex-design skill and design-run manifests [VERIFIED packages/brand-config/src/brands/ra.claims.md:5]. No runtime code (grep for `claims.md` over `.ts/.mjs/.cjs/.json` finds only test fixtures and docs, 22/10/2026) | Not machine-enforced |
| 3 | DB per organisation: `BrandDNA.brandVoice`, `ClientProfile.antiPatterns` / `vocabularyBank.banned` / `constraints.legal`, `BrandOperatingSystem.rules`, `BrandPreset` colours | voice and vocabulary for managed-service clients [VERIFIED prisma/schema.prisma:5210-5240] [VERIFIED prisma/schema.prisma:5294-5335] [VERIFIED prisma/schema.prisma:7958-7976] | prompt builder (`antiPatterns` goes into the prompt) [VERIFIED lib/ai/prompt-layer-builder.ts:94]; render brand kit for colour [VERIFIED lib/brand/render-brand-kit.ts:71-97] | Guidance only, never checked after generation |
| 4 | Marketing-agency fixtures and API | `forbiddenClaims`, `blockedClaims`, `voiceRules` [VERIFIED lib/marketing-agency/fixtures/restoreassist.ts:19-24] [VERIFIED lib/marketing-agency/types.ts:13-37] | accepted by the API schema [VERIFIED app/api/marketing-agency/campaigns/route.ts:37] | Declared at `lib/marketing-agency/full-campaign-generator.ts:49` and never compared with output (grep for `forbidden` in that file finds only line 49, 22/10/2026) [VERIFIED lib/marketing-agency/full-campaign-generator.ts:49] |
| 5 | Ad-hoc checks | Australian-spelling list in the Vision Board stub (RA only) [VERIFIED lib/vision-board/voice-enforce.ts:25-33]; HERMES Haiku voice score, log-only [VERIFIED lib/hermes/voice/gate.ts:1-24]; campaign gate checks declared claims have evidence refs [VERIFIED lib/marketing-agency/campaign-quality-gate.ts:371-380]; public-site claims tripwire for Synthex's own landing copy [VERIFIED scripts/copy-audit.ts:1-14] | various | Spelling not in the main gate; the campaign gate cannot see an undeclared claim in the copy [INFERENCE] |

The brand kit merged in #1038 is piece 3 applied to video. It resolves only a primary colour per organisation and fails open to unbranded [VERIFIED lib/brand/render-brand-kit.ts:1-12]. It is a visual-identity consumer, not a rules layer, and this spec leaves it unchanged.

## Approach

**Slice 1: RestoreAssist banned claims block (thinnest vertical slice).**
1. Extend the `ra.claims.md` frontmatter with two machine-readable keys: `banned_claims` (list of `{pattern, reason, source}`, seeded from the fixture's `forbiddenClaims` and `blockedClaims`, for example "guaranteed claim approval") and `gated_terms` (words that may appear only inside an approved claim: `guarantee*`, `insurance-approved`, `certified`, `endorsed`, `IICRC`, `S500`, any `$` figure, any `%` figure).
2. Add `lib/brand/claims-register.ts`. It parses the YAML frontmatter at build time into a typed object and fails the build on a schema error. A runtime read failure is an error and never an empty register.
3. Add rule **R10 (banned claim)** and rule **R11 (gated term outside an approved claim)** to `lib/aeo/rules.ts`, and call them from `enforceBrandVoice` after R9. R11 passes a sentence only if the gated term sits inside an exact `facts_approved[].claim` string that has not expired. Otherwise it fails with `R11: gated term "<t>" not inside an approved claim`.
4. Tests: a fixture draft with "guaranteed claim approval" fails for `ra`; the approved trial claim passes verbatim; the same claim with its "your own Anthropic or OpenAI key" qualification removed fails, because the qualification must stay inside the string [VERIFIED packages/brand-config/src/brands/ra.claims.md:17-41].

**Slice 2: CARSI, then Australian English and IICRC terms.**
5. Repeat step 1 for `carsi.claims.md`. Turn the standing prohibitions (not an RTO, no implied IICRC endorsement, no CEC hours) into `banned_claims` patterns [VERIFIED packages/brand-config/src/brands/carsi.claims.md:128-136].
6. Add rule **R12 (Australian spelling)**. Build a shared `US→AU` substitution list (Vale's `substitution` check shape) seeded from the Vision Board list, and make the stub import it so there is one list. In this slice, consider `harper.js` with `Dialect::Australian` [VERIFIED gh api repos/Automattic/harper] as the broader spell-check, behind a supply-chain review.
7. Add rule **R13 (canonical industry terms)**: per-brand `term_forms` such as `IICRC S500` (never "S-500"), and a standards claim must never drop the word "aligned". The RA design template already states this rule in prose [VERIFIED docs/marketing-agency/design-runs/templates/ra/sweep.tokens.json:78], and R13 makes it machine-checked.

**Slice 3: close the side doors.**
8. The marketing-agency generator runs R10 against each channel draft using the request's `forbiddenClaims`, and a hit raises a quality-gate blocker (`quality_forbidden_claim:<id>`). This uses the `publishing-handoff` code registry, not a new mechanism.
9. Add a seed-consistency test: every `samplePhrases` entry in `lib/agency/portfolio-brand-configs.ts` must pass its own brand's gate. It is **expected red on today's main** because of the DR "Insurance-approved" phrase. The fix is either to change the seed or to have the founder approve a claim. The agent must not pick one.
10. Add the register health script `scripts/brand/check-claims-registers.mjs` (`npm run brand:rules:check`). It checks each `facts_approved` entry for a source URL, a DD/MM/YYYY `verified_on` and an expiry that has not passed, and checks that no `banned_claims` pattern matches an approved claim.

**Slice 4: deferred, each needs its own yes.**
- DR rules: seeded by slice 2's mechanism. No FD-10 priority.
- CCW: there is no `ccw` BrandSlug, and CCW is a documented carve-out needing an explicit CEO flag [VERIFIED lib/agency/portfolio-brand-configs.ts:31-32]. Founder-only.
- Managed-service clients (orgs with no BrandSlug): make R1 and R10 also read `ClientProfile.vocabularyBank.banned` and `antiPatterns` for that organisation. Today an unresolved brand already goes to human approval, which is the right fail-closed default [VERIFIED lib/workflow/step-types/brand-voice-gate.ts:39-52].
- JEV J5/J6 families read the same register. `tests/eval/jev/families.json` is a protected path.
- Visual-identity export to the DTCG format. Cut until a consumer exists.

## Open-source candidates

| Project | Licence | Stars | pushed_at | What it gives us | Decision | Evidence |
|---|---|---|---|---|---|---|
| [errata-ai/vale](https://github.com/errata-ai/vale) | MIT | 6272 | 2026-10-16 | Markup-aware prose linter: existence, substitution and occurrence checks, `accept.txt`/`reject.txt` vocabularies, Hunspell dictionaries (so en_AU is possible). It is a Go binary and not a fit for the Vercel Node runtime | study-pattern | [VERIFIED gh api repos/errata-ai/vale] [VERIFIED https://vale.sh/docs/checks/spelling fetched 22/10/2026] [VERIFIED https://vale.sh/docs/keys/vocab fetched 22/10/2026] |
| [Automattic/harper](https://github.com/Automattic/harper) | Apache-2.0 | 16946 | 2026-10-21 | Offline grammar and spell checker with an explicit `Dialect::Australian`, shipped to Node as `harper.js` (WASM) | depend (slice 2 only, after supply-chain review and a bundle-size check) | [VERIFIED gh api repos/Automattic/harper]; dialect seen in `harper-core/src/linting/spell_check.rs` tests via gh api contents, 22/10/2026 |
| [textlint/textlint](https://github.com/textlint/textlint) | MIT | 3202 | 2026-10-18 | Pluggable natural-language linter in Node, so it is runtime-compatible. A fallback if Harper fails review | study-pattern | [VERIFIED gh api repos/textlint/textlint] |
| [languagetool-org/languagetool](https://github.com/languagetool-org/languagetool) | LGPL-2.1 | 15173 | 2026-10-21 | Grammar and style checker with en-AU. LGPL is not on the depend/vendor list, and it needs a Java server | reject | [VERIFIED gh api repos/languagetool-org/languagetool] |
| [design-tokens/community-group](https://github.com/design-tokens/community-group) | NOASSERTION (LICENSE.md: W3C Software and Document License for reports; W3C 3-clause BSD for software) | 2152 | 2026-10-21 | The W3C DTCG token format. Its README lists 2025.10 as Stable. It would standardise colour and type tokens, but does not move FD-10 | study-pattern (deferred) | [VERIFIED gh api repos/design-tokens/community-group]; LICENSE.md and README read via gh api contents, 22/10/2026 |
| [style-dictionary/style-dictionary](https://github.com/style-dictionary/style-dictionary) | Apache-2.0 | 4868 | 2026-10-20 | Token build system with DTCG conversion (`lib/utils/convertToDTCG.js`) | reject (for now; revisit if a DTCG consumer appears) | [VERIFIED gh api repos/style-dictionary/style-dictionary] |
| [google-labs-code/design.md](https://github.com/google-labs-code/design.md) | Apache-2.0 | 28450 | 2026-10-16 | Format spec for a visual identity read by agents. The repo's `<slug>.design.md` files already use a matching frontmatter shape (`version: alpha`, `name`, `colors`) [INFERENCE] | study-pattern | [VERIFIED gh api repos/google-labs-code/design.md] |
| [SCTY-Inc/agentcy-cli](https://github.com/SCTY-Inc/agentcy-cli) | MIT | 386 | 2026-09-30 | "Brand, Voice, and Visual foundations as explicit protocol artifacts". The closest thing found to an open brand-voice artifact. It is prompt and skill material, not a calibrated evaluator | study-pattern | [VERIFIED gh api repos/SCTY-Inc/agentcy-cli] |

- **Vale.** Its rule types (existence, substitution, occurrence, vocab accept/reject) map onto R1, R10, R12 and R5, so the YAML shape for `banned_claims`, `gated_terms` and `term_forms` should follow Vale's. If CI linting of committed copy is wanted later, Vale can run as a separate CI binary over files generated from the same register (call-as-service in CI). The runtime gate stays TypeScript, because Synthex functions run on Vercel Node and the gate must also run inside `enforceBrandVoice`. Packages such as errata-ai/Microsoft and errata-ai/Google (both MIT) are style references only, because they are US-English developer-doc guides [VERIFIED gh api repos/errata-ai/Microsoft] [VERIFIED gh api repos/errata-ai/Google].
- **Harper.** This is the only maintained, permissively licensed checker found with a native Australian dialect. Risks are WASM cold start and bundle size in a serverless function. Slice 2 measures both before deciding. If either is too high, R12 stays the curated substitution list.
- **DTCG / Style Dictionary.** `BrandConfig.colour` and `typography` are already typed. A DTCG export only helps an outside tool such as Canva or Figma, and none consumes it today, so it is deferred.
- **Brand-voice evaluators.** `gh search repos "brand voice"` (top 15 by stars, 22/10/2026) returned skills, plugins and generators (agentcy-cli; TribeAI/claude-cowork-brand-voice-plugin, MIT, last pushed 2026-06-01 [VERIFIED gh api repos/TribeAI/claude-cowork-brand-voice-plugin]; gr8monk3ys/blog-AI, AGPL-3.0). None publishes calibration data, which supports keeping voice human. This search covered GitHub only and was not exhaustive. get-alex/alex (MIT) was last pushed 2024-11-27, so it is stale and rejected [VERIFIED gh api repos/get-alex/alex]. amperser/proselint (BSD-3-Clause) is study-only [VERIFIED gh api repos/amperser/proselint].

Nothing is installed by this spec. A supply-chain review (eng-supply-chain seat) runs before any dependency lands.

## Data model

**None for slices 1–3.** Rules live in version-controlled files in `packages/brand-config`, keyed by `BrandSlug`. Changing a claim then goes through a reviewed PR and keeps the claims sidecar's "legal cadence, not code cadence" design [VERIFIED packages/brand-config/src/brands/carsi.claims.md:7-10]. Brand isolation comes from the slug: `enforceBrandVoice` throws on an unknown brand and never falls back to another [VERIFIED lib/aeo/brand-voice-enforce.ts:72-75]. The organisation-to-brand map stays `ORG_SLUG_TO_BRAND` [VERIFIED lib/agency/brand-voice-gate.ts:27-36].

**Slice 4 (deferred):** for managed-service clients, reuse the org-unique columns `ClientProfile.vocabularyBank` and `antiPatterns`. No new table and no migration. If a structured per-org claims register is ever needed, it would be an additive table with an `organization_id` and would follow the Supabase migration rule, which puts it under protected `prisma/migrations/**` or a founder-applied `supabase/migrations` file.

## Security & cost guardrails

- **Model spend: none.** R10–R13 are pure functions, so no model call and no budget line are added. The existing HERMES Haiku score is unchanged and stays advisory.
- **Fail closed.** If the register fails to parse, the build fails. If it is missing at runtime, the gate fails with `register_unavailable`, never pass-with-empty-rules. An unresolved brand still means `requiresApproval: true`.
- **Who may change claims.** `claim_review_owner: founder` is already written in each register [VERIFIED packages/brand-config/src/brands/ra.claims.md:53]. Recommendation: add `packages/brand-config/src/brands/*.claims.md` to `protected_paths` in `scripts/fleet/policy.json`. That file is itself protected, so the change **needs a declared fleet commit or the founder's `human-required` label**. Until then, an agent can approve its own claim by editing the file.
- **Protected paths this spec would touch:** `scripts/fleet/policy.json` (above), `tests/eval/jev/families.json` (slice 4), and `.claude/rules/**` if a "brand rules" always-on rule is added. Each needs a declared fleet commit or `human-required`. Slices 1–3 touch none of them.
- **Supply chain.** `harper.js` lands only after review, with its version pinned, and with a bundle-size budget recorded in the PR.
- **No secrets.** Fixtures use only real public claims already in the registers. There are no keys or customer data.

## Risk & assumption register

| ID | Risk or assumption | L | I | Mitigation | Owner |
|---|---|---|---|---|---|
| B1 | R11 (gated terms) false-fails useful copy, and drafts pile up for human review | M | M | Start with a short gated-term list; measure the false-fail rate on the last 30 days of RA and CARSI drafts before blocking; warn-only for one week | Fleet |
| B2 | A regex claim check misses a paraphrased banned claim ("approval is assured") | H | M | R11 catches the gated words, not only exact phrases. Paraphrase detection is a P8 model-judge job and stays advisory | Fleet / P8 |
| B3 | Someone reads a green R10–R13 as "on-brand" | M | H | Gate output names the checks it ran and states "voice and taste not assessed" | Fleet |
| B4 | Agents edit `*.claims.md` to make their own copy pass | M | H | Protected path (needs founder label); register check diffs `facts_approved` against base | Founder |
| B5 | Harper WASM is too heavy for a serverless function | M | L | Measure in slice 2; fall back to the curated substitution list | Fleet |
| B6 | Assumption: the claims sidecars are current and complete for RA and CARSI | M | H | `expires_on` is enforced; the founder reviews candidates awaiting sign-off [VERIFIED packages/brand-config/src/brands/carsi.claims.md:96] | Founder |
| B7 | Seed-consistency test exposes existing seeded phrases (DR "Insurance-approved") and turns CI red | H | L | Land the test with a named known-gap entry, not a skip, and the founder picks the fix | Founder |
| B8 | Assumption: every text path to publish goes through `enforceBrandVoice` or the campaign gate | M | H | [UNVERIFIED] for HERMES drafts, the studio tools and the content generator. Slice 3 includes a grep audit of publish-queue writers | Fleet |

## Open questions

1. **(Founder only)** Do you accept the machine/human line in "Decision up front": claims, terms, spelling and compliance can block, and voice and image taste stay with you?
2. **(Founder only)** DR seed phrase "Insurance-approved restoration, coordinated fast.": remove it, or approve a substantiated claim with a source?
3. **(Founder only)** Make `*.claims.md` a protected path (label on a `scripts/fleet/policy.json` change)?
4. **(Founder only)** CCW: does the carve-out stay, or does CCW get a `ccw` BrandSlug and a claims register?
5. Should R11 block from day one or run warn-only for a week (B1)? Recommendation: warn-only for 7 days, then block.
6. Is `harper.js` worth its bundle cost over a curated list of about 200 US→AU words? Slice 2 answers this with a measurement.

## Verification plan

Each check below is written so it can go red, and each comes with a planted failure.

```bash
# Slice 1 — banned claim blocks for RestoreAssist
npx vitest run tests/unit/brand/claims-register.test.ts
#   expect: exit 0; includes cases
#   - ra draft "RestoreAssist means guaranteed claim approval" -> pass:false, reason starts "R10:"
#   - ra draft = facts_approved[0].claim verbatim -> pass:true
#   - same claim minus "your own Anthropic or OpenAI key" -> pass:false, reason starts "R11:"
#   red control: delete the R10 call from enforceBrandVoice -> first case fails (watch it fail before merging)

# Slice 2 — CARSI prohibitions, AU spelling, IICRC terms
npx vitest run tests/unit/brand/claims-register.test.ts -t "carsi|R12|R13"
#   expect: "CARSI is IICRC-endorsed" -> R10; "color" -> R12 with suggestion "colour"; "S-500" -> R13
#   red control: remove "color" from the substitution list -> R12 case fails

# Slice 3 — side doors
npx vitest run tests/unit/marketing-agency/full-campaign-generator.test.ts -t "forbiddenClaims"
#   expect: a generated draft containing a forbiddenClaims entry yields blocker quality_forbidden_claim
npx vitest run tests/unit/brand/seed-consistency.test.ts
#   expect TODAY: exit 1 naming lib/agency/portfolio-brand-configs.ts DR "Insurance-approved" (known gap until the founder decides)

# Register health
npm run brand:rules:check
#   expect: exit 0 on main
#   red control: set ra facts_approved[1].expires_on to 01/01/2026 in a scratch copy -> exit 1 "expired"

# Existing guards must stay green
npx vitest run tests/unit/ai/no-direct-image-apis.test.ts      # expect exit 0
npx vitest run __tests__/aeo/brand-voice-enforce.test.ts       # expect exit 0 (R1–R9 unchanged)
grep -rn "forbidden" lib/marketing-agency/full-campaign-generator.ts | wc -l
#   expect after slice 3: > 1 (today: 1, the type declaration only)
```

The P8 boundary holds when none of these commands, and no gate output, reports anything about brand voice or image taste. A reviewer can check this by grepping the gate result strings for "voice" and "taste" outside the "not assessed" notice.
