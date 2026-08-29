# CARSI — IICRC continuing-education courses

**Run** `carsi-iicrc-cec-courses-2026-08-29-01` · **Status** DRAFT ·
**Locked** 2026-08-29 · **Winner** `calibration-field`

The first `/lock` in this repo, and the first end-to-end exercise of the
`synthex-design` engine.

## What is here

| Path                                                      | What                                             |
| --------------------------------------------------------- | ------------------------------------------------ |
| `manifest.json`                                           | Full run record, including the losing variations |
| `calibration-field/board.html` · `tokens.json`            | The locked winner                                |
| `funnel/*.html`                                           | Seven funnel assets from the same tokens         |
| `copy.md`                                                 | Every line of copy, with the voice check         |
| `public/marketing-agency/design-runs/<run-id>/`           | The rendered PNGs                                |
| `../templates/carsi/calibration-field.{html,tokens.json}` | The reusable template and frozen theme           |

## Why this one won

Three directions were rendered and reviewed. The engine recommended
`course-record` (data-led, coffee ground); the founder chose `calibration-field`.

The reason is worth keeping: `course-record`'s signature was the CEC-hours
numeral set large in Lora, working as a graphic. With `facts_approved` empty
that numeral rendered `[NEEDS APPROVAL]`, so the direction lost its hero
element and left a void where its whole idea had been. `calibration-field`'s
central idea is a graphic rather than a fact, so it survives an empty claims
register intact.

**The general lesson:** for a brand whose claims are not yet substantiated,
prefer a direction whose signature is compositional over one whose signature is
a figure. The claims register is a design constraint, not just a legal gate.

## The claim that was dropped

The winner initially carried `[NEEDS APPROVAL: hours per course]`. It was not
approved — the founder confirmed CEC hours are an **internal number only**, so
the element was removed and a standing prohibition recorded in
`packages/brand-config/src/brands/carsi.claims.md`. It will never move to
`facts_approved`; a future design wanting an hours figure should be redesigned.

## Known gaps

- `missing-logo:carsi` — no logo exists on disk for any of the 21 declared brand
  logo paths (`config/brand-logo-baseline.json`). Every board is type-only.

## What was NOT written

No `design_runs` table is applied and no Linear task was created (Linear MCP not
authorised in the session that produced this run). The index row in
`docs/marketing-agency/design-runs/README.md` is the only consumer of this
manifest. Nothing was published, posted or scheduled — the engine has no
publish path.
