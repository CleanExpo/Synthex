---
name: synthex-design
description: >-
  The Synthex marketing creative engine. Generates N radically different,
  client-ready marketing art-boards — Instagram posts, carousels, stories,
  LinkedIn posts, ad banners, OG images, email headers — for a Unite-Group
  portfolio brand, then renders them, LOOKS at them, has them scored by an
  independent-context critic, and hands over a machine-readable DRAFT manifest.
  Activate on any request for a social post, ad creative, campaign visual,
  mockup, art-board, or "N versions of" anything visual for a BRAND. This is
  marketing creative, NOT product UI — for app components, styling, and the
  Synthex glass design system use the `design` skill instead. All output is
  DRAFT; this skill never publishes.
metadata:
  author: synthex
  version: '2.0'
  engine: synthex-ai-agency
  type: capability-uplift-creative
  triggers:
    - instagram post
    - social creative
    - ad creative
    - campaign visual
    - art board
    - artboard
    - mockup
    - carousel
    - og image
    - email header
    - brand exploration
    - design variations
  requires:
    - brandprint
    - grounded-visuals
    - anti-ai-slop
context: fork
---

# Synthex Design Engine v2

Act as the design lead of a small studio known for giving every brand a visual
identity that could not be mistaken for anyone else's. Produce N radically
different, production-ready variations; **render them and look at them**; have
them scored by a critic that never saw the build; recommend one; hand
everything over in machine-readable form.

Pipeline:
BRAND → BRIEF → DIRECTIONS → COPY → BUILD → RENDER → SEE →
CRITIQUE (self + independent-context) → SHIP DRAFT → LOCK → TEMPLATE

> **Scope boundary.** This skill governs marketing art-boards only. The
> anti-slop bans in §10 deliberately contradict the product design system —
> `.claude/DESIGN.md` and the `design` skill _require_ Space Grotesk,
> glassmorphism and `#FF6B35` for app UI. Never cite §10 in a product-UI
> review. This skill never writes to `app/`, `components/`, or `lib/`.

---

## 1. Inputs — fill the slots

Parse from the invocation. If SUBJECT is missing, ask **once**, then proceed.
Everything else defaults — never stall on an optional slot.

| Slot       | Required | Default                                                                                                                                            |
| ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| ASSET      | no       | `instagram_post` — one of: instagram_post, instagram_carousel, story, linkedin_post, landing_page, hero_section, email_header, og_image, ad_banner |
| SUBJECT    | **yes**  | what it is and does, in 1–2 true sentences                                                                                                         |
| BRAND      | no       | `synthex` — **must** be a `BrandSlug`: `dr`, `nrpg`, `ra`, `carsi`, `synthex`, `unite`, `john-coutis`                                              |
| AUDIENCE   | no       | the brand's `audience.primary` from its config                                                                                                     |
| GOAL / CTA | no       | generate qualified interest / "Learn more"                                                                                                         |
| FACTS      | no       | empty — read from the brand's claims sidecar (§2). **Only these may appear as claims.**                                                            |
| IMAGERY    | no       | `none` — **the only value accepted in v1** (§6)                                                                                                    |
| SERIES     | no       | empty — name of a locked template to reuse (fast lane, §13)                                                                                        |
| N          | no       | 3                                                                                                                                                  |

**Unknown BRAND ⇒ STOP.** `BrandSlug` is a closed union in
`packages/brand-config/src/types.ts`. Onboarding a new brand is a `brandprint`
job (its `references/audit-recipe.md` → `build-recipe.md`), not this skill's.
Never invent tokens for a brand that has no config entry.

---

## 2. Load brand context before designing

Read all three, and cite each by path in the run summary:

1. `packages/brand-config/src/brands/<BRAND>.design.md` — the design-token
   source: palette (including `on-primary` / `surface` aliases), the type scale
   (`display-xl` … `caption`), spacing, radii, components, Do's and Don'ts.
   This is what the board is built from.
2. `packages/brand-config/src/brands/<BRAND>.ts` — voice (`tone`,
   `forbiddenWords`, `requiredCadence`), the binding `doNot` list, `audience`,
   `logo.safeAreaPx`, and `tokenStatus`.
   **`tokenStatus: 'proposal'` ⇒ STOP.** Those values are unapproved; putting
   them in front of anyone is the exact failure SYN-1113 exists to prevent.
   (`john-coutis` is currently proposal-only.)
3. `packages/brand-config/src/brands/<BRAND>.claims.md` — the approved FACTS
   list and `anti_references`. Missing or empty ⇒ FACTS is empty, and every
   claim renders `[NEEDS APPROVAL: …]`. That is the safe default, not a blocker.

Then read both taste files. Every line in either is binding:

- `docs/marketing-agency/design-runs/taste/PRINCIPLES.md` — cross-brand rules
  learned from past runs, applying to **every** brand. Read it even for a brand
  that has never been run.
- `docs/marketing-agency/design-runs/taste/<BRAND>.md` — this brand's own
  "locked because…" / "rejected because…" decisions, if it exists.

Where they conflict, the brand's own log wins: it is a judgement about this
brand specifically, and `PRINCIPLES.md` is a generalisation from others.

**There is no learning store.** No `design_runs` table is applied and no
outcome rows exist anywhere. All N variations are exploratory. **Do not
describe this engine as self-learning**, and do not claim an explore/exploit
bias it does not have.

---

## 3. Pre-flight: differentiate or die (60 seconds, no more)

State in one line what the category default looks like for this audience —
from the claims sidecar's `anti_references`, or one quick look at the space.
Then: **no variation may be the category default.** Write that line into
`manifest.category_default_avoided` so the constraint is auditable.

---

## 4. Choose N maximally distant directions

Hard rule: chosen directions must differ on **every axis the brand's palette
permits**, and on **at least three** of the four — typeface class, colour
strategy, layout system, cultural reference. Commit fully to each; never average
two directions into a safe middle. Spend each variation's boldness in **one**
signature element.

**The typeface axis is usually the constrained one.** Only `synthex` declares
three families (Space Grotesk · Inter · JetBrains Mono); `carsi` (Lora · Inter)
and `ra` (Inter · JetBrains Mono) declare two; `dr`, `nrpg` and `unite` declare
Inter alone. A brand cannot vary typeface class across three directions if it
has not got three classes, and `brandprint` forbids inventing a face the brand
has not declared. Where an axis is blocked:

- Vary the constrained axis by _role and treatment_ instead — display-dominant
  vs numeral-as-graphic vs near-absent is real variation within one family.
- Record `axis_constraint` in the manifest, naming the axis and why it is
  blocked (e.g. _"carsi.ts declares only Lora + Inter, so typeface class cannot
  vary"_).
- Pass that `axis_constraint` string to the critic at §9 stage 2. Its collision
  check is evaluated **with the constraint stated**, so it flags genuine
  sameness rather than the brand's own type palette.

A run that silently ships three directions sharing an axis, with no
`axis_constraint`, has failed §4. A run that names the constraint has not.

The twelve-direction library is at `references/directions.md`. Ground at least
one variation in the SUBJECT's own world — the materials, instruments and
vernacular of the industry (restoration: moisture maps, thermal imaging, site
tape, scope sheets). Name each direction in the manifest.

---

## 5. Copy before pixels

- On-canvas: hook ≤ 7 words, support ≤ 18 words, CTA 2–4 words, active voice.
- **3-second test**: the message must land from a thumbnail.
- Off-canvas (always produced for social assets): a caption whose first line
  works before the "…more" truncation, 5–10 relevant hashtags, and alt text
  ≤ 125 characters.
- **Claims come only from FACTS.** Never invent statistics, testimonials,
  awards, review counts, prices, or "#1" claims — Australian Consumer Law
  applies. A wanted-but-unapproved claim renders literally as
  `[NEEDS APPROVAL: claim]`.
- **`voice.forbiddenWords` is mechanical.** Every portfolio brand forbids the
  pronouns we / our / i / us / my. That materially constrains hooks — write
  around it rather than fighting it.
- Honour the brand's `doNot` list and its `.design.md` "Do's and Don'ts".
  A brand that says "never sensationalise" outranks the punchy-hook instinct
  in this section every time.
- Australian English. Plain verbs, sentence case, no filler. Run the
  `anti-ai-slop` quick scan over the copy before it goes on canvas.
- Tag every factual line `[VERIFIED]` / `[INFERENCE]` / `[UNCONFIRMED]` per
  `.claude/rules/fabel-evidence-standard.md` while drafting. Only `[VERIFIED]`
  material reaches the canvas.

---

## 6. Imagery layer

**`IMAGERY` has exactly one permitted value in v1: `none`.**

- **`none`** — a pure typographic/graphic art-board. This is the v1 contract,
  not a fallback, and it is a legitimately strong choice for type-led
  directions. Do not pad with decoration.

- **`generate`** — **blocked in v1.** `public/reference-library/manifest.json`
  covers three industries (carpet-cleaning, upholstery-cleaning,
  water-damage-restoration) and has zero corporate, training, office or B2B
  subjects, so any CARSI / Unite / Synthex prompt returns `blocked: true` with
  `NO_REFERENCES_BLOCK_ERROR`. That is correct behaviour under
  `.claude/rules/real-images-only.md`, not an error to route around. Record
  `missing-reference-coverage:<subject>` in `manifest.gaps` and continue
  type-only. The fix is adding real photos, never bypassing.

  If it is ever unblocked, the **only** entry points are `generateImage()` /
  `generateBatch()` from `lib/services/ai/image-generation.ts` with a
  `GenerationContext` (`organizationId`, `traceId`, `autonomyLevel`), or the
  **Synthex** studio `generate_image` MCP tool
  (`lib/services/ai/studio-tools/index.ts:246`).
  **Not** the identically-named Higgsfield `generate_image` MCP tool.
  **Not** any provider SDK. `grounded-visuals` wins every conflict here.

  > The static guard `tests/unit/ai/no-direct-image-apis.test.ts` scans only
  > `lib/`, `app/` and `scripts/` for provider literals. It cannot catch a
  > skill instructing an agent to call a provider tool. CI does not have your
  > back on this one — the rule above is the whole mechanism.

- **`supplied`** — **also blocked in v1.** The contract in §1 accepts `none` and
  nothing else; an invocation asking for `supplied` is refused with the reason,
  not silently reinterpreted. The rules below are the v2 contract, recorded now
  so the gap is legible:

  Brand-owned assets under `public/` only. Never the web,
  stock sites, or another brand's folder. Note `public/logos/` **does not
  exist**: all 21 declared brand logo paths are absent
  (`config/brand-logo-baseline.json`, SYN-1133). Every run therefore records
  `missing-logo:<BRAND>` and composes without a logo. Do **not** add a baseline
  entry, and do **not** set a wordmark in type and call it the logo.
  Commission the asset.

---

## 7. Build the art-boards

- One fixed-size HTML/CSS file per variation at the exact §11 dimensions,
  design tokens declared first as CSS custom properties, then layout.
  Start from `references/board-scaffold.html`.
- **Fonts: local files only, no network at render time.** `@font-face` must
  point at `file://` paths under `public/fonts/<BRAND>/`, matching the `src`
  values already declared in the brand's `typography` block. A font that fails
  to load silently ruins a design and you would never know why quality varied.
  A remote `@import` or Google Fonts link is a hard error, not a silent fallback:
  the renderer's request guard aborts remote schemes (`http(s):`) and fails
  the run.
- **What the guard does not reach.** Chromium resolves `data:` and `file:`
  subresources internally, so they never hit the guard. An inlined base64 face
  therefore bypasses the self-hosting contract **without tripping anything** —
  that one is on you to catch when you read the board. Do not inline a face to
  dodge the rule.
- A face that fails to load **fails the render** (exit 1). `document.fonts.ready`
  resolves even when a face errored, so the renderer checks each `FontFace`'s
  status and reports `fontsLoaded` / `fontsFailed` in its receipt. A green
  receipt now means the design's own type actually drew.
- No font file on disk ⇒ record `missing-font:<BRAND>/<family>` in
  `manifest.gaps`, use the nearest system-safe stack, and **say so in the run
  summary**. A CARSI board that silently falls back from Lora to a system serif
  has lost the thing that defines the brand.

---

## 8. Render and SEE — mandatory

Never judge an art-board from its code. For each variation:

```bash
node scripts/design/render-board.mjs \
  .artifacts/design-runs/<run-id>/v1/board.html \
  .artifacts/design-runs/<run-id>/v1/post.png \
  1080x1440
```

Then **read the rendered PNG back into context** with the Read tool and inspect
it. A picture is worth a thousand tokens; code that "looks right" routinely
renders wrong. **A run that critiques without reading the PNGs has skipped this
step and is invalid** — say so and re-do it rather than scoring from HTML.

**Fluid assets render twice.** `landing_page` and `hero_section` have no fixed
canvas — §11 requires them to hold at 1440 wide _and_ at 390. Render both and
read both PNGs back; a hero judged only at desktop width is not judged. Every
other asset in the §11 table has one fixed size and renders once.

```bash
node scripts/design/render-board.mjs <run>/v1/board.html <run>/v1/desktop.png 1440x1024
node scripts/design/render-board.mjs <run>/v1/board.html <run>/v1/mobile.png  390x844
```

Exit codes: `0` ok · `1` render failure, a blocked network request, **or a font
that failed to load** · `2` bad args. On `1` with `blocked > 0` the board violated §7 — fix the board, do
not retry. One-time per machine: `npx playwright install chromium` (playwright
is already a repo dependency; only the browser binary may be missing).

---

## 9. Critique — two stages, one rework

**Stage 1 — self-critique from the rendered PNGs.** Score each variation 1–5
on: distinctive · hierarchy · 3-second clarity · contrast/legibility ·
platform-native feel · CTA visibility · spacing discipline · direction
fidelity · copy quality · would-a-client-pay.

**Stage 2 — independent-context review.** Dispatch the `design-critic`
subagent (`.claude/agents/design-critic.md`) with a fresh context containing
exactly these, and nothing else: the brief block, the approved FACTS list, the
asset dimensions, the absolute paths to the rendered PNGs, and — only when §4
recorded one — the `axis_constraint` string. Without that last one the critic
fails the collision check on a brand whose type palette cannot vary, which is
the brand's constraint rather than the run's fault. It holds `Read` only,
so it cannot reach the boards' source, the run folder, or this skill. It
returns the strict JSON defined in `references/critic-rubric.md`.

> **This is context isolation, not vendor independence.** Same model, same
> account. It removes the builder's self-justification bias — the critic never
> saw why a choice was made, so it cannot defend it — but it shares model
> priors, so it will under-detect the failure modes this model is
> systematically blind to. **Never describe it as cross-vendor, second-vendor,
> or third-party review**, in the manifest or in anything client-facing.

Merge both score sets. Fix the three lowest-scoring issues per variation.
**One** rework pass, re-render, done — no infinite polishing loops.

If the `impeccable` detector is installed, the only sanctioned invocation is
`node ~/.claude/skills/impeccable/scripts/detect.mjs --json <files>` (exit 2 =
findings, 0 = clean). **Never `npx impeccable`** — it is not a repo dependency,
so npx would resolve the bare name against the public registry and run whatever
it found. It is not installed here, so this step is a documented no-op.

---

## 10. Hard bans — the anti-slop list

Never, unless the brief explicitly asks (marketing art-boards only — see the
scope boundary at the top):

- The three AI-default looks: cream + high-contrast serif + terracotta accent ·
  near-black + single acid accent · broadsheet hairlines everywhere.
  Legitimate styles, but defaults, not choices.
- Inter/Roboto/Arial as display type **where the engine is the one choosing** ·
  purple-to-blue gradients · glassmorphism · cards nested in cards · icon-tile
  above every heading · 01/02/03 markers where order carries no meaning.

  This ban is aimed at reaching for Inter _because it is the default_. It does
  **not** override a brand's own `typography.display`: `dr`, `nrpg`, `ra` and
  `unite` deliberately declare Inter as their display face with verified
  tokens, and `brandprint`'s law is that brand-config wins. Setting display in
  the brand's declared family is always correct, Inter included; inventing a
  face the brand has not declared, to dodge this line, is the actual defect.

- Emoji as decoration · lorem ipsum · centred-everything · more than two type
  families per variation.
- Third-party logos, characters, celebrity likenesses, competitor trade dress,
  licensed sports/film/music imagery.
- Stock clichés: handshakes, lightbulbs, generic laptops.

---

## 11. Production specs (2026)

| ASSET               | Canvas (px)     | Notes                                                                                                |
| ------------------- | --------------- | ---------------------------------------------------------------------------------------------------- |
| instagram_post      | **1080 × 1440** | 3:4 — uncropped in feed AND profile grid. 1080 × 1350 (4:5) acceptable; loses ~7% top/bottom on grid |
| instagram_carousel  | 1080 × 1350     | all slides same ratio (first slide locks it); ≤ 20 slides; hook → problem → solution → proof → CTA   |
| story               | 1080 × 1920     | all text inside the centre 1080 × 1610 safe zone                                                     |
| linkedin_post       | 1200 × 627      |                                                                                                      |
| og_image            | 1200 × 630      |                                                                                                      |
| ad_banner           | 1080 × 1080     | keep on-image text light for paid delivery                                                           |
| email_header        | 1200 × 400      | design at 2×, export 2400 × 800                                                                      |
| landing_page / hero | fluid           | design at 1440 wide; must hold at 390                                                                |

> **Documented divergence.** `getOptimalDimensions()` in
> `lib/services/ai/image-generation.ts:1730` returns 1080 × 1080 for
> `instagram_feed`. That constant governs _generated images_; this table
> governs _art-boards_ for organic feed. Two jobs, two numbers — not a bug,
> but do not silently reconcile them.

Legibility floor (social): smallest text ≥ 44px, hook ≥ 88px on a 1080-wide
canvas · contrast ≥ 4.5:1 · nothing critical within the brand's
`logo.safeAreaPx` of an edge · CTA first or second in the visual hierarchy.
Web quality floor: responsive to mobile, visible keyboard focus, reduced motion
respected.

---

## 12. Output contract

**Tier 1 — working set (every run).** Writes to gitignored `.artifacts/`, so
throwaway explorations never touch the repo:

```
.artifacts/design-runs/<BRAND>-<subject-slug>-<yyyy-mm-dd>-<nn>/
  v1/ v2/ v3/   board.html · post.png · tokens.json · copy.md · caption.md
  manifest.json · critique.json
```

**Tier 2 — promoted record (on `/lock`, or an explicit "keep this run").**

```
docs/marketing-agency/design-runs/<run-id>/
  README.md · manifest.json · critique.json · <winner>/board.html · <winner>/tokens.json · copy.md
public/marketing-agency/design-runs/<run-id>/
  <winner>.png
```

`<nn>` is a two-digit sequence starting at `01`: check `.artifacts/design-runs/`
for existing directories on the same date stem and take the next free number. Two
runs of the same brief on one day would otherwise land in the same directory, and
the second would overwrite the first's boards, manifest and critique.

**Check every output path is trackable before writing to it.** `.gitignore`
swallows two of this skill's own targets, and both failed silently — the write
succeeds, the file exists on disk, and nothing is committed:

- `*.png` is blanket-ignored, allowlisting only `public/**`, `components/**`
  and `app/**`. A PNG written under `docs/` disappears. That is why rendered
  boards go under `public/`.
- A bare `templates/` pattern matched a directory of that name **at any depth**,
  including `docs/marketing-agency/design-runs/templates/<brand>/` — the exact
  path §13 writes locked themes to. Fixed by a narrow negation, but the class
  recurs whenever someone adds an unanchored directory pattern.

`__tests__/design/lock-paths-not-ignored.test.ts` asserts these paths stay
trackable and fails CI if one starts being ignored again. If you add a new
output path, add it to that test. `git check-ignore -v <path>` answers the
question directly — but read the output, since a matched line beginning `!` is
a **negation**, meaning the path is _not_ ignored.

Never promote a board still carrying a `[NEEDS APPROVAL: …]` claim.

`manifest.json`:

```json
{
  "subject": "...",
  "asset": "instagram_post",
  "dims": "1080x1440",
  "brand": "carsi",
  "status": "DRAFT",
  "category_default_avoided": "one line from §3",
  "sources_read": ["packages/brand-config/src/brands/carsi.design.md", "..."],
  "axis_constraint": "omit unless §4 blocked an axis; names the axis and why",
  "gaps": ["missing-logo:carsi"],
  "variations": [
    {
      "name": "...",
      "direction": "Swiss / International",
      "files": ["v1/post.png"],
      "hook": "...",
      "cta": "...",
      "imagery": { "mode": "none" },
      "tokens": { "palette": {}, "type": {}, "signature": "..." },
      "scores": { "self": {}, "critic": {} },
      "recommended": true,
      "why": "one line"
    }
  ]
}
```

`gaps` uses a closed vocabulary: `missing-logo`, `missing-reference-coverage`,
`missing-font`, `missing-facts`, `missing-consumer`. This array is what someone
greps to decide what to commission — recording the gap is how the type-only
constraint stays honest instead of quietly degrading.

Exactly one variation carries `recommended: true`. Keep all N — losers are A/B
material.

**A manifest with no consumer is a defect.** End every run by appending one row
to the index table in `docs/marketing-agency/design-runs/README.md`. If nothing
else is wired, print this verbatim in the run summary:

> No `design_runs` table is applied and no Linear task was created (Linear MCP
> not authorised). The committed index row at
> `docs/marketing-agency/design-runs/README.md` is the only consumer of this
> manifest.

**Everything is DRAFT.** This skill never publishes, posts, schedules, or calls
a platform API.

---

## 13. Lock → template → suite

On `/lock <run-id> <variation>`:

1. Freeze its `tokens.json` as the campaign theme at
   `docs/marketing-agency/design-runs/templates/<BRAND>/<name>.tokens.json`.
2. Save its board as a parameterised template — slots `{{HOOK}}`,
   `{{SUPPORT}}`, `{{CTA}}`, `{{IMAGE}}` — at
   `docs/marketing-agency/design-runs/templates/<BRAND>/<name>.html`. Future
   SERIES runs fill the template instead of designing fresh.
3. Generate the matching funnel set **from the same tokens**: landing hero,
   3 follow-up posts, 1 story, og_image, email header. One aesthetic decision
   propagating through the whole funnel is the product.

   **Render every one of them and look at them before trusting the template.**
   A board designed at 1080×1440 does not automatically survive 1200×400: a
   signature built on a fixed grid degenerates when its box shortens — nine
   rows of tally marks became a 2px smudge on the email header before the field
   was made to derive its grid from its own measured box. Whatever the
   signature is, it needs a rule for what it does when its box is much shorter
   or much wider, including hiding itself. Then re-render the winner and
   confirm it is still byte-identical (`cmp`) to the locked board — a fix to
   the template must not move the thing that was locked.

4. Append one line to `docs/marketing-agency/design-runs/taste/<BRAND>.md`:
   what was locked and the stated reason. Rejections get a line too. This is
   how taste accumulates — a decision log, **not** a performance loop.

   Then ask one question: **would this reason have changed a decision on a
   different brand?** If yes, append it to
   `docs/marketing-agency/design-runs/taste/PRINCIPLES.md` as well, naming this
   run as its source. §2 reads that file for every brand, so a general lesson
   left only in one brand's log is a lesson the next brand pays for again.
   Most lines are brand-specific and stay put; promote sparingly.

5. Promote the record and winner PNG per §12 tier 2. **Before promoting, prove
   each target path is trackable, not merely writable** — see §12. A `/lock`
   that reports success while git silently ignored everything it wrote is the
   failure mode this step exists to prevent.

---

## 14. Compliance

- **Claims: FACTS-only (§5).** ACL applies; misleading claims are the client's
  legal risk and Synthex's reputation risk. Portfolio-level claim status lives
  in `.claude/memory/verification-gates.md` — a claim whose VG row is
  `[verification needed]` or `[placeholder]` is **not publishable in any form**.
- **AI imagery**: platforms enforce disclosure of AI-generated visual subjects
  (especially photorealistic people/scenes) in ads; AI-assisted edits like
  colour grading are exempt. Pure typographic boards are not the trigger, so v1
  never needs the label — but if imagery is ever unblocked, set
  `ai_disclosure: required` in the manifest so the publish gate ticks the
  platform control. When unsure, disclose.
- **Ads must not assert or imply personal attributes of the viewer** (health,
  financial distress, insurance status). A live trap for restoration marketing:
  "Flooded? Struggling with your insurer?" targets by distress and gets
  rejected. Address the situation, not the person.
- Alt text always. Fonts OFL or licensed, self-hosted. No real personal data in
  mockups; placeholder names only. Per-brand isolation — never reuse one
  brand's tokens, assets, or claims for another. CCW is a **client**, outside
  the Nexus, with a data carve-out; never blend it with portfolio brands.
- No testimonials, images, likenesses, or customer stories without consent
  evidence (`docs/marketing-agency/CONSENT-AND-STORY-EVIDENCE-POLICY.md`).
