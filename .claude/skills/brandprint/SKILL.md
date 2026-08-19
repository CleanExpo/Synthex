---
name: brandprint
description: >-
  Multi-brand branding enforcer for every client-facing or branded output —
  invoices, reports, proposals, documents, PDFs, dashboards, canvases, decks,
  emails, letterheads, web pages — even when the request never says the word
  "brand". Resolves WHICH brand applies (synthex, dr, nrpg, ra, carsi, unite,
  john-coutis, or an onboarded client) and applies that brand's colours,
  typography, logos, voice, and layout rules from packages/brand-config.
  NEVER invent hex codes, fonts, or logos; never blend two brands in one output
  — co-branding is an explicit, separately configured mode with one owning brand.
metadata:
  author: synthex
  version: '1.0'
  engine: synthex-ai-agency
  type: capability-uplift-brand
  triggers:
    - invoice
    - report
    - proposal
    - deliverable
    - branded
    - brand
    - client output
    - document
    - pdf
    - deck
    - presentation
    - slides
    - email template
    - letterhead
    - one-pager
    - client dashboard
  requires:
    - grounded-visuals
context: fork
---

# Brandprint

## Purpose

Kill the generic-AI look (grey boxes, purple accents, stock fonts) on every
output this repo produces. Any artefact a human will see — for Synthex itself,
a portfolio brand, or a client — carries the correct brand automatically. The
user should never have to say "make it branded".

Unlike a single-brand brandprint, this skill holds **no brand data of its
own**. The single source of truth is `packages/brand-config` (typed `.ts` +
agent-readable `.design.md` per brand). This skill teaches you to resolve,
read, and apply it.

## Step 1 — Resolve the brand

Exactly one **owning** brand per output. Resolution order (first match wins):

1. **Explicit mention** — the request names a brand, client, or organisation.
2. **Organisation context** — org-scoped work (an org's report, invoice,
   deliverable) uses that organisation's brand.
3. **Project context** — work inside a portfolio project uses that project's
   brand (e.g. Disaster Recovery work → `dr`).
4. **Default** — `synthex`.

Known slugs live in the `BrandSlug` union in
`packages/brand-config/src/types.ts` and the registry in
`packages/brand-config/src/brands/index.ts`. Current: `synthex`, `dr`,
`nrpg`, `ra`, `carsi`, `unite`, `john-coutis`.

**Unknown brand ⇒ STOP.** If the resolved brand has no brand-config entry, do
not improvise a palette. Either ask which existing brand applies, or onboard
the brand properly via [references/audit-recipe.md](references/audit-recipe.md)
then [references/build-recipe.md](references/build-recipe.md).

### Co-brand mode — the only way two brands share an artefact

Two brands in one output is a **separate mode, never a blend**. Enter it only
when all three preconditions hold; if any is missing, ask. Never invent a
hybrid to resolve ambiguity.

1. **An explicit request.** The user asks for a co-branded artefact and both
   brands are identifiable. An implied pairing — "put the client's logo on our
   report somewhere" — is not a request for co-branding. Ask.
2. **A resolved owner.** One brand is the **owner** and the other the
   **guest**. The owner is whichever brand Step 1's resolution order returns:
   a deliverable produced _for_ a client is owned by that client; Synthex's
   own collateral that credits a partner is owned by `synthex`. If the order
   returns both or neither cleanly, ownership is ambiguous ⇒ ask.
3. **Both brands in brand-config.** _Unknown brand ⇒ STOP_ applies to the
   guest as well. No brand-config entry, no guest slot — onboard it first.

Once those hold, the split is fixed. It is not renegotiated per artefact:

| Element                                                       | Comes from                                              |
| ------------------------------------------------------------- | ------------------------------------------------------- |
| Palette — primary, secondary, accent, neutral ramp, semantics | **Owner only.** The guest contributes no colour.        |
| Typography — display, body, mono                              | **Owner only.**                                         |
| Layout, spacing, radii, components, motion                    | **Owner only.**                                         |
| Voice — tones, `forbiddenWords`, `requiredCadence`            | **Owner only.**                                         |
| Logo                                                          | **Both**, and only inside the lock-up below.            |
| `doNot` lists                                                 | **Both** — the union binds, and the stricter rule wins. |

The guest's entire presence is its logo plus its `doNot` list. Nothing else
crosses the line: no guest accent colour "for balance", no guest display font
on the headings, no guest tone of voice.

**Lock-up rules**

- **Order:** owner's mark first — left of the guest horizontally, above it
  vertically. Right-to-left locales mirror the axis, not the precedence.
- **Separation:** a hairline divider or plain whitespace between the marks.
  Never overlap, interlock, or merge them, and never set them on a shared
  coloured plate belonging to neither brand.
- **Clear space:** the **larger** of the two brands' `safeAreaPx`, applied both
  around the whole lock-up and between the two marks. When one brand's rules
  are stricter, they govern the lock-up.
- **Variants:** choose primary vs inverted per brand against the actual
  background, following each brand's own logo rules. The two variants need not
  match.
- **Scale:** optically match the marks' visual weight. Never stretch, crop,
  recolour, or regenerate either mark to make it fit — logos are files
  (see [Hard boundaries](#hard-boundaries)).
- **Placement:** one lock-up per artefact, in the masthead or the footer. Not
  repeated per page, per slide, or per section.

Anything the two brands' rules cannot settle between them is `[MISSING]` —
ask, per the evidence discipline in Step 2.

## Step 2 — Read the brandprint

Load both files for the resolved `<slug>`:

| File                                                | Gives you                                                                                                                         |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `packages/brand-config/src/brands/<slug>.design.md` | Design tokens (colours, typography scale, spacing, radii), components, layout rules, do's and don'ts. Google DESIGN.md v1 format. |
| `packages/brand-config/src/brands/<slug>.ts`        | Voice (tone, forbidden words, cadence), logo paths + `safeAreaPx`, motion, audience, the binding `doNot` list.                    |

When the brand is `synthex`, read `.claude/DESIGN.md` **as well** — it is a
third source, not a substitute for either file above. Its own header states it
is the agent-readable projection of `packages/brand-config/src/brands/synthex.ts`
plus the founder's non-negotiable rules, and it records known divergences
elsewhere in the repo. So Synthex takes three files; every other brand takes
two. Cite whichever you actually read (see [Verification](#verification)).

**Evidence discipline** (per `.claude/rules/fabel-evidence-standard.md`):
values read from brand-config are `[VERIFIED]`. Anything you deduce beyond it
(a tint, a pairing, a layout choice the spec doesn't cover) is `[INFERRED]`
and must be flagged in your summary. A value the brand needs but the config
lacks is `[MISSING]` — ask, never invent. No made-up hex codes, no
substituted fonts, no "close enough" logos.

## Step 3 — Apply per surface

| Surface                                   | Application                                                                                                                                                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Documents / PDFs / invoices / letterheads | Logo (primary or inverted per background) at stated `safeAreaPx` clear space; display font for headings, body font for text; `primary` for emphasis and totals, `neutral` ramp for structure; AUD currency, DD/MM/YYYY dates, Australian English. |
| Dashboards / canvases / data viz          | Brand canvas colour (`secondary`/surface per design.md); semantic colours (`success`/`warning`/`danger`) only for their meanings; mono font for literal values where the brand defines one.                                                       |
| Decks / slides                            | Layout, spacing, and outer margins from design.md; one brand, one palette, no per-slide drift; component styles (`cta-primary`, `card`, etc.) where defined.                                                                                      |
| Emails                                    | Body font with web-safe fallback stack; logo from asset path; brand voice and forbidden-words list on copy.                                                                                                                                       |
| Web pages / app UI / components           | Route through the **impeccable** skill (below).                                                                                                                                                                                                   |

Copy in any surface obeys the brand's `voice` block: tones, `forbiddenWords`,
`requiredCadence`, and the `doNot` list. For strategic voice decisions defer
to `brand-strategist`; mechanical gating is `brand-voice-enforce`.

### Web/UI surfaces — hand off to impeccable

For web pages, app UI, and components, apply the brand **through** the
`impeccable` skill (installed at `~/.claude/skills/impeccable/`). The brand's
`<slug>.design.md` is already in the Google DESIGN.md format impeccable
consumes — point it at that file (or `.claude/DESIGN.md` for Synthex) so it
inherits the brand's tokens instead of inventing its own. Impeccable's
absolute bans (gradient text, AI-beige, eyebrow kickers, identical card
grids, side-stripe borders) are the anti-slop gate for branded UI.

## Hard boundaries

- **Logos are files, never generated.** Use only repo asset paths:
  `public/logos/<slug>/{primary,inverted,icon}.svg`, `public/synthex-logo.*`,
  or the paths in the brand's `logo` block. Generating, redrawing, or
  approximating a logo violates the Real Images Only rule
  (`.claude/rules/real-images-only.md`). `public/brands/<name>/` is a legacy
  scheme keyed by full brand name — read from it where existing code already
  does, never write new brand assets there (SYN-1133).
- **No brand's declared logo files exist yet.** All 21 paths in the seven
  brands' `logo` blocks are absent from disk, tracked in
  `brand-logo-baseline.json` (SYN-1133); `public/logos/` holds neither scheme
  today. Nothing reads the field at runtime, which is why the gap never threw.
  So for any brand but `synthex` — whose marks are at `public/synthex-logo.*` —
  a logo is `[MISSING]`: say so and ask for the artwork. Do not substitute
  another brand's mark, a flat customer logo, or a generated one.
- **All imagery defers to `grounded-visuals`** — owned reference library via
  `lib/services/ai/image-generation.ts`, no exceptions.
- **One brand owns each output.** Never blend palettes, fonts, or logos across
  brands, including "Synthex plus client" hybrids. A genuine co-branded
  artefact is not a blend: it runs
  [Co-brand mode](#co-brand-mode--the-only-way-two-brands-share-an-artefact),
  where the owner supplies every token and the guest appears only in the
  lock-up. No explicit request, or no clear owner ⇒ ask.
- **Australian English** in all product copy: colour, organise, recognise,
  licence (noun), authorise.

## Onboarding a new client brand

Three steps, in order — skipping the audit is how brands come out "a little
bit off":

1. **Audit** — [references/audit-recipe.md](references/audit-recipe.md):
   inventory the client's assets, extract the spec, tag every value
   `[VERIFIED]` / `[INFERRED]` / `[MISSING]`.
2. **Resolve flags** — the founder/client answers the audit's question list.
   Answering those questions is the whole game; do not build on unconfirmed
   values.
3. **Build** — [references/build-recipe.md](references/build-recipe.md):
   turn the corrected audit into a first-class brand-config entry, then
   verify with the real commands.

## Verification

Before claiming a branded output done:

- Name the resolved brand slug and **cite every file you actually read, by
  path** — not a count. That is `<slug>.design.md` + `<slug>.ts` for any brand,
  plus `.claude/DESIGN.md` when the brand is `synthex` (three files), plus the
  guest's two files in co-brand mode. A file you read and did not cite is an
  untraceable claim.
- Confirm every colour/font/logo traces to brand-config (`[VERIFIED]`) or is
  flagged.
- Never restate token values in this skill or any other document as though they
  were the source. Quote them from brand-config at the point of use, so a token
  correction lands in one place.
- **Co-brand mode also requires:** naming which brand is the owner and which is
  the guest and why; confirming the guest appears only in the lock-up; stating
  the `safeAreaPx` used and which brand it came from; and listing the union of
  both `doNot` lists you checked against.
- For HTML/CSS outputs, optionally run the deterministic slop gate — the
  detector bundled with the installed impeccable skill, over local files:

  ```bash
  node ~/.claude/skills/impeccable/scripts/detect.mjs --json <files>
  ```

  **Never `npx impeccable`.** `impeccable` is not a dependency of this repo —
  it is absent from `package.json` and `node_modules/.bin` — so `npx` would
  resolve the bare name against the public registry and execute whatever it
  found there. The bundled detector is version-pinned by installation
  (v3.9.1, `pbakaus/impeccable` @ `f2049c2`, per the source line at the foot of
  `~/.claude/skills/impeccable/SKILL.md`), reads local files with no network,
  prints JSON, and exits `2` when it finds anything and `0` when clean. Its
  rules live in
  `~/.claude/skills/impeccable/scripts/detector/registry/antipatterns.mjs`.

- Banned: "should look right", "probably on brand". Show the values used.
