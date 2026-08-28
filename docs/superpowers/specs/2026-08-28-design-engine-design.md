# Synthex Design Engine v2 — integration design

> **Status:** implemented (PR 1). **Upstream:** `synthex-design@2.0.0`, a Claude
> Code plugin produced in an earlier session and handed over as a zip.
> **Companion rules:** `.claude/rules/real-images-only.md`,
> `.claude/rules/fabel-evidence-standard.md`,
> `.claude/rules/database/supabase-migrations.md`.

## Why

Synthex could generate marketing copy and grounded photography, but had no way
to produce a _designed_ asset — and no way to judge one. Every existing visual
skill either enforces the product design system (`design`, `ui-review`) or
briefs an image generator (`visual-content-brief`, `grounded-visuals`). Nothing
built an art-board, and nothing looked at the result.

The uploaded plugin's highest-value idea is its §8: **render the board and read
the PNG back before critiquing it**. No skill in this repo did that — every
screenshot path here points at a live URL. Code that "looks right" renders
wrong often enough that judging design from HTML is judging blind.

## What was adopted, and what was rewritten

The engine's _thinking_ transferred; its _plumbing_ assumed a greenfield repo.

| Upstream                                                                                          | Disposition                                                                                   |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| §3–§5, §10, §11, §14 (differentiation, directions, copy discipline, anti-slop, specs, compliance) | Near-verbatim — the strongest material in the upload                                          |
| §1 input slots                                                                                    | `CLIENT` → `BRAND`, constrained to the `BrandSlug` closed union                               |
| §2 brand loading                                                                                  | Rewritten: `packages/brand-config`, not a parallel `clients/<slug>/brand.json`                |
| §6 imagery                                                                                        | **Rewritten** — see Defects below                                                             |
| §9 critique stage 2                                                                               | **Rewritten** — see Defects below                                                             |
| §12/§13 paths                                                                                     | Rewritten to the two-tier convention below                                                    |
| §15 compute/routing                                                                               | Dropped — the "estate routing law" does not describe this repo                                |
| `render.mjs`                                                                                      | Adopted with four fixes (mkdir, network-block enforcement, `waitUntil: 'load'`, JSON receipt) |
| `critic-rubric.md`                                                                                | Adopted; "blind cross-vendor" reframed as independent-context                                 |
| `synthex-brand-intake/SKILL.md`                                                                   | **Dropped** — duplicated `brandprint` + `business-dna`                                        |
| `design_runs.sql`                                                                                 | **Deferred** — see Learning loop                                                              |
| `plugin.json`, `marketplace.json`, `README.md`, gap map                                           | Dropped — packaging decision is in-repo skills                                                |

## Key decisions

**Brand is `packages/brand-config`, not a new store.** The engine reads
`<slug>.design.md` (token source), `<slug>.ts` (voice, `doNot`, `safeAreaPx`,
`tokenStatus`) and a new `<slug>.claims.md` sidecar. `brandprint`'s law —
unknown brand ⇒ STOP — carries over, and `tokenStatus: 'proposal'` refusal
(SYN-1113) comes free.

**Claims live in a sidecar, not in `BrandConfig`.** `BrandConfig` is compiled by
tsup and shipped to the browser; an approved-claims register is record data with
sources, verified dates and expiry that changes on a legal cadence, not a code
one. Every claim edit would otherwise force a package rebuild and a typed-const
diff. The `.claims.md` sidecar follows the existing `ra.motion.md` /
`ra.scene.md` precedent, and each entry carries the `vg_ref` of its row in
`.claude/memory/verification-gates.md` rather than forking a third claims store
beside that registry and `MarketingAgencyClaim`.

**Outputs are two-tier.** Working set in gitignored `.artifacts/design-runs/`;
promoted record in `docs/marketing-agency/design-runs/<run-id>/` with the PNG
in `public/marketing-agency/design-runs/<run-id>/`. PNGs must sit under
`public/` because `.gitignore:192` is a blanket `*.png` allowlisting only
`public/**`, `components/**`, `app/**`. This needed no `.gitignore` change and
matches the existing campaign convention.

**The critic is context-isolated, not cross-vendor.** Codex is not installed
here. The `design-critic` subagent holds `tools: Read` only, so it mechanically
cannot reach the boards' source or the skill — but it is the same model and
account, and the skill says so in those words. Mislabelled review is worse than
no review.

## Defects found in the uploaded material

1. **§6 named Higgsfield `generate_image`** — a direct violation of
   `.claude/rules/real-images-only.md`, compounded by a name collision (the
   Synthex studio tool is _also_ called `generate_image`). The static guard
   `tests/unit/ai/no-direct-image-apis.test.ts` scans only `lib/`, `app/`,
   `scripts/` for provider literals and could never catch a skill instruction —
   so the fix had to be the prose, and the skill says so explicitly.
2. **§9 "cross-vendor / Codex on the OpenAI lane"** — not achievable here, and
   a claim that would have ended up in client-facing copy.
3. **`clients/<slug>/brand.json` and `clients/<slug>/DESIGN.md`** — a second,
   drifting brand store, and a conflation of declarative tokens with a
   chronological taste log.
4. **`outputs/` paths** — neither that directory nor `clients/` exists, and
   PNGs written outside `public/` are silently swallowed by git. "A manifest
   with no consumer is a defect" — so is a PNG git never sees.
5. **`npx impeccable install`** — `impeccable` is not a repo dependency, so npx
   resolves the bare name against the public registry. `brandprint` already
   bans this; only the version-pinned bundled detector is sanctioned.
6. **`npm i playwright`** — already a dependency (`^1.54.2`). Only the browser
   binary may be missing.
7. **`design_runs.sql`** — no `organization_id` (every table here is org-scoped;
   `ImageGeneration.organizationId` was tightened to NOT NULL for exactly this
   reason), no RLS, no `updated_at`, `design_outcomes_client_idx` misnamed
   (indexes `run_id`), view lacks `security_invoker`. Would not survive
   `sql-hardener`.
8. **`render.mjs`** — did not create its output directory, so it failed on
   every first run; and had no mechanism enforcing its own skill's
   "no network at render time" rule.
9. **"MANIFEST and index rows in the same commit"** — no skills MANIFEST exists
   in this repo. `.claude/agents/index.md` is the closest analogue and now
   carries the `design-critic` row.
10. **Fonts** — §7 demands self-hosted OFL fonts and §11 sets an 88px hook
    floor, but the repo has zero `.woff2` files outside `node_modules`,
    including the ones `carsi.ts` already declares. The upload's most emphatic
    quality rule had no assets behind it.

## Learning loop — deferred, deliberately

`design_runs` / `design_outcomes` are not created. Production DDL is
founder-gated (`.claude/rules/database/supabase-migrations.md`, subordination
ruling 2026-08-04: an agent authors and stops), the tables would be empty for
months, and `image_generations.batchGroupId` already carries
`kept` / `rank` / `feedbackAt` as the estate's quality signal with spend
accounted in `media_spend_events`.

The day-one substitute is the taste log plus the run index — file-based, which
is fake self-learning for _outcome_ data but perfectly sound for _judgement_
data, and git does not get wiped by deploys. The skill states in those words
that it is not self-learning.

If it is ever warranted (after ≥1 real published post): **one** table, not two.
A `DesignRun` model with `organizationId`, RLS, and a `runId` unique key;
approvals reuse `ApprovalRequest` with `contentType: 'design_run'` (the
polymorphic precedent already supports other types); outcomes join through
existing publishing receipts rather than a new table. Author, validate, and
stop.

## Known limits on day one

1. No AI imagery — the reference library has 143 subjects across three
   cleaning/restoration industries and zero corporate or training coverage, so
   `generate` returns `blocked: true` by design.
2. No logos on any board — `public/logos/` does not exist; all 21 declared
   paths are baselined absent in `config/brand-logo-baseline.json` (SYN-1133).
3. No learning bias — no outcome rows exist.
4. Not cross-vendor review — same model, isolated context.
5. No new client onboarding — `BrandSlug` is a closed union.
6. `carsi.claims.md` ships with an empty `facts_approved`, so pilot boards are
   deliberately claim-free.
7. No Linear task as manifest consumer — Linear MCP is unauthorised; the
   committed index row is the only consumer, and the skill must say so.
8. No `impeccable` pass — not installed.
9. `SERIES` / template fast lane does nothing until the first `/lock`.
