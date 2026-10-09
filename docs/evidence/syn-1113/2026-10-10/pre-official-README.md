# SYN-1113 offline continuation — 10 October 2026

Software and configuration debt is repaired locally. Recovery reduced the initial **24 missing assets to 11**: ten missing logos and all three missing fonts were restored. Three identity/consent requirements remain. Synthex itself has no missing declared visual assets; portfolio readiness remains false.

Current main base: `ec96cdc4ba498d36e00c0be62f2d039019212efe`. Changes are uncommitted. Audited source/asset fingerprint: `9727d0a9fe2657083f12b6c3bfdaf57eecd3c2ce173a6b281089cfcdf3525dcb`. `current.json` records exact paths and SHA-256 values, including all 310 reference images. HEAD alone does not identify this dirty tree. Fingerprint excludes evidence documents, dependency installs and the preserved unrelated social-pipeline edit.

July 24 baseline: `d06377e9c7da091102943abfc35ff74548278b26` (23:19:19 Brisbane), reproduced from committed Git objects. July 25 head `bf3e16a645a27c7c55b90e85296f24d9bd896e6c` has the same preflight blob `96e6974634b644699f8e852d0899362549e5c9f1`. Historical output: 48 entries = 37 missing assets, 9 comment/proposal markers, missing CCW and unmapped John. Current audit uses actual configs and explicit approvals; categories differ. The absent Documents checkout was replaced with current main at the user's direction.

## Final counts

| Category                                             | Remaining |
| ---------------------------------------------------- | --------: |
| Detected code/config/registry/manifest/mapping debt  |         0 |
| Missing logo files                                   |        11 |
| Missing font files                                   |         0 |
| Identity/voice approval requirements                 |         3 |
| Present references under existing owned declarations |       310 |
| Reference industries / subjects                      |   3 / 143 |

The guarded command intentionally exits **1** for the remaining assets and permissions. Existing reference ownership declarations were preserved; this audit does not independently establish legal title. Per-brand readiness describes declared asset and approval coverage, not release authorization.

## Completed repairs and research

- Restored read-only `npm run visual:preflight`, with HTTP/fetch/TCP refusal and no provider, database, rendering or deployment entrypoints.
- Reconciled canonical identity mappings, publishing-copy mappings, logo baseline, reference manifest validation and DR video colour with its existing canonical navy token.
- Reused matching existing fonts, installed the three absent fonts from official Google Fonts sources, retained OFL licence files, and corrected the invalid Bebas Neue Bold declaration to the available Regular 400. John remains unapproved.
- Restored ten declared logo files from visually checked existing brand artwork or the current app SVG. Paths use actual file formats; no generated substitutes. The same existing transparent Synthex mark is used on both surfaces, without invented inverse colours.
- Recovered an additional original CCW company logo as intake material. CCW remains gated: that file and recorded public-reference permission do not establish an approved video identity.
- Rejected placeholders, legacy DR marks and unrelated Unite-Hub/EMPIRE product marks. Source paths, hashes and reasons are in `logo-recovery.json`, `font-recovery.json` and `research-findings.json`.
- Prepared `approval-action-sheet.md` with concrete closing inputs and draft requests. Nothing was sent. John's local kickoff record explicitly pauses work and prohibits synthetic speech; that prohibition remains in place.
- Narrowed the broad `Synthex/` Git ignore to root-only `/Synthex/`, preventing it from hiding the recovered Synthex assets on this case-insensitive filesystem. All changed source and asset files are visible to Git.
- Rebuilt the brand package so local compiled consumers receive the repaired paths. No production renderer was run.

## Exact remaining files

Paths relative to `/Users/phill-mac/pi-seo-workspace/Synthex`:

- `public/logos/carsi/icon.svg`
- `public/logos/carsi/inverted.svg`
- `public/logos/dr/icon.svg`
- `public/logos/dr/inverted.svg`
- `public/logos/john-coutis/icon.svg`
- `public/logos/john-coutis/inverted.svg`
- `public/logos/john-coutis/primary.svg`
- `public/logos/nrpg/inverted.svg`
- `public/logos/ra/inverted.svg`
- `public/logos/unite/icon.svg`
- `public/logos/unite/inverted.svg`

## Exact approval intake locations

- `config/brand-identity-gaps.json#/ccw` — approved colour, typography, logo and motion identity.
- `config/brand-identity-gaps.json#/john-coutis` — visual token approval by John.
- `config/brand-identity-gaps.json#/john-coutis` — consented original recordings, or explicit synthetic-speech permission and a licensed voice asset.

These are open requirements, not receipts. Do not delete them or promote proposals to obtain a green result. For John, consented original recordings close the spoken-content input without inventing synthetic-speech permission; any synthetic route requires an explicit change to the existing rule. The paused engagement must also be cleared before external work or release.

## Validation and limits

- Four targeted Jest suites: **97 tests passed** on the final source and approval intake.
- Brand package build passed for ESM, CJS and TypeScript declarations.
- All 15 changed TypeScript files passed ESLint with zero warnings; scripts are excluded by repository config. Offline guard passed Node syntax and network rejection checks.
- Recovered file hashes, WOFF2 headers, retained font licences and SVG safety checks passed.
- Final guarded `npm run visual:preflight`: 0 code debt / 11 missing logos / 0 missing fonts / 3 approval requirements, expected exit 1.
- `git diff --check` passed; audited source and asset hashes checked after validation.
- No full application build or production rendering verification is claimed. No generation provider calls, spend, deploys, production writes, publication, migrations or Git push. Public font retrieval was read-only research.

## Files reviewed and changed

Raw final output is retained in `test-output.txt` and `preflight-output.txt`. `current.json` lists every reviewed source/asset path, changed source/asset path and SHA-256. Evidence documents in this directory are additional changes. The pre-existing `docs/marketing/synthex-social-pipeline.md` edit was preserved untouched. `initial-current.json` and `initial-README.md` preserve the first 24-gap checkpoint; `july-24-baseline.json` preserves the historical reproduction.

## Remaining completion boundary

All detected software/configuration blockers in this scoped preflight are repaired. The remaining inputs are the 11 exact artwork files above and three approved identity/consent inputs detailed in `approval-action-sheet.md`. Import original matching artwork and approval receipts, implement CCW only from approved tokens, then rerun the guarded preflight. Provider activation, deployment and production writes stay disabled.
