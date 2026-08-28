# Design runs — index and conventions

Records produced by the `synthex-design` skill (`/design`). **This index table
is the consumer of every run's manifest.** A run that produces files nothing
reads is a defect, so every run appends a row here.

## Two tiers

| Tier            | Where                                           | When                                                                                                    |
| --------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Working set     | `.artifacts/design-runs/<run-id>/` (gitignored) | Every run. Boards, PNGs, manifest, critique. Throwaway explorations never touch the repo.               |
| Promoted record | `docs/marketing-agency/design-runs/<run-id>/`   | On `/lock`, or an explicit "keep this run". The manifest, the critique, and the winning board's source. |
| Promoted assets | `public/marketing-agency/design-runs/<run-id>/` | The winner PNG (plus losers kept as A/B material).                                                      |

PNGs live under `public/` because `.gitignore:192` is a blanket `*.png` that
allowlists only `public/**`, `components/**` and `app/**`. A PNG written under
`docs/` is silently swallowed by git — the same class of failure as a manifest
with no consumer. This split also matches the existing campaign convention
(`docs/marketing-agency/full-authority-campaigns/…` for the record,
`public/marketing-agency/…/assets/` for the bytes).

Anything under `public/` is served at a guessable URL on synthex.social. Never
promote a board still carrying a `[NEEDS APPROVAL: …]` claim.

`run-id` is `<brand>-<subject-slug>-<yyyy-mm-dd>`.

## Related files

- Taste logs (append-only lock/reject decisions): `taste/<brand>.md`
- Locked themes and templates: `templates/<brand>/`
- Approved claims per brand: `packages/brand-config/src/brands/<brand>.claims.md`
- The engine: `.claude/skills/synthex-design/SKILL.md`

## Run index

| Date            | Brand | Asset | Subject | Recommended | Status | Gaps | Record |
| --------------- | ----- | ----- | ------- | ----------- | ------ | ---- | ------ |
| _(no runs yet)_ |       |       |         |             |        |      |        |
