---
name: brandprint
description: >-
  Multi-brand branding enforcer for every client-facing or branded output —
  invoices, reports, proposals, documents, PDFs, dashboards, canvases, decks,
  emails, letterheads, web pages — even when the request never says the word
  "brand". Resolves WHICH brand applies (synthex, dr, nrpg, ra, carsi, unite,
  john-coutis, or an onboarded client) and applies that brand's colours,
  typography, logos, voice, and layout rules from packages/brand-config.
  NEVER invent hex codes, fonts, or logos; never mix two brands in one output.
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

Exactly one brand per output. Resolution order (first match wins):

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

## Step 2 — Read the brandprint

Load both files for the resolved `<slug>`:

| File                                                | Gives you                                                                                                                         |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `packages/brand-config/src/brands/<slug>.design.md` | Design tokens (colours, typography scale, spacing, radii), components, layout rules, do's and don'ts. Google DESIGN.md v1 format. |
| `packages/brand-config/src/brands/<slug>.ts`        | Voice (tone, forbidden words, cadence), logo paths + `safeAreaPx`, motion, audience, the binding `doNot` list.                    |

`.claude/DESIGN.md` is the Synthex projection of the same data plus the
founder's non-negotiable rules — read it when the brand is `synthex`.

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
  `public/brands/<slug>/`, `public/synthex-logo.*`, or the paths in the
  brand's `logo` block. Generating, redrawing, or approximating a logo
  violates the Real Images Only rule (`.claude/rules/real-images-only.md`).
- **All imagery defers to `grounded-visuals`** — owned reference library via
  `lib/services/ai/image-generation.ts`, no exceptions.
- **One brand per output.** Never blend palettes, fonts, or logos across
  brands, including "Synthex plus client" hybrids, unless the user explicitly
  asks for a co-branded artefact.
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

- Name the resolved brand slug and cite the two files read.
- Confirm every colour/font/logo traces to brand-config (`[VERIFIED]`) or is
  flagged.
- For HTML/CSS outputs, optionally run the deterministic slop gate:
  `npx impeccable detect <files>` (59 rules, JSON output, CI exit codes).
- Banned: "should look right", "probably on brand". Show the values used.
