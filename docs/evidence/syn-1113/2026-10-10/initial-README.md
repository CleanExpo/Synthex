# SYN-1113 offline continuation — 10 October 2026

Current main base: `ec96cdc4ba498d36e00c0be62f2d039019212efe`. Local changes are uncommitted. Source fingerprint: `7b4889196c90741388716fafcfd138cc29849794133dcf1af39ee848abe97582`. `current.json` records per-file SHA-256 values; a HEAD by itself does not identify this dirty tree.

July 24 baseline: `d06377e9c7da091102943abfc35ff74548278b26` (23:19:19 Brisbane). Reproduced from committed Git objects, not an original receipt packet. The later July 25 head `bf3e16a645a27c7c55b90e85296f24d9bd896e6c` contains the identical preflight blob `96e6974634b644699f8e852d0899362549e5c9f1`. The old requested `/Users/phill-mac/Documents/Synthex` checkout is absent; the user selected current main in this checkout.

Historical output: 48 entries = 37 declared missing assets, 9 source comment/proposal markers, missing CCW and unmapped John Coutis. Current output uses actual registered configs, explicit approval intake, deployable public paths and present owned references. Counts have different categories; no approval was obtained or rights promoted to reduce them.

## Result

| Category                                             |   Count |
| ---------------------------------------------------- | ------: |
| Code/config/registry/manifest/mapping debt           |       0 |
| Missing logo files                                   |      21 |
| Missing font files                                   |       3 |
| Identity/voice approval requirements                 |       3 |
| Present references under existing owned declarations |     310 |
| Reference industries / subjects                      | 3 / 143 |

Readiness remains **false**. Exit **1** is required until the genuine asset and approval gaps are resolved. Pending CCW identity intake is not a renderable BrandConfig, and John remains a proposal.

## Changes

- Restored a read-only `npm run visual:preflight`, with a network guard and no provider, database, rendering or deployment entrypoints.
- Audit canonical source configs rather than incidental unregistered TypeScript files or comment keywords; audit the existing logo baseline and reference file paths, ownership declarations, dimensions and source metadata.
- Reused existing Inter Regular, Inter ExtraBold and JetBrains Mono Medium font paths at matching family/weight; retained genuinely absent Space Grotesk, Inter Bold and Bebas Neue variants.
- Split canonical identity resolution from publishing-copy mappings, so John resolves without inventing promotional copy.
- Record CCW identity approval intake and reject its aliases before any job/provider creation. No visual tokens were fabricated.
- Align DR video colour to its existing navy canonical token and existing prohibition on primary red. No production output was rendered or changed.

## Exact remaining files

All paths below are relative to this repository root.

- `public/fonts/john-coutis/BebasNeue-Bold.woff2`
- `public/fonts/synthex/SpaceGrotesk-SemiBold.woff2`
- `public/fonts/unite/Inter-Bold.woff2`
- `public/logos/carsi/icon.svg`
- `public/logos/carsi/inverted.svg`
- `public/logos/carsi/primary.svg`
- `public/logos/dr/icon.svg`
- `public/logos/dr/inverted.svg`
- `public/logos/dr/primary.svg`
- `public/logos/john-coutis/icon.svg`
- `public/logos/john-coutis/inverted.svg`
- `public/logos/john-coutis/primary.svg`
- `public/logos/nrpg/icon.svg`
- `public/logos/nrpg/inverted.svg`
- `public/logos/nrpg/primary.svg`
- `public/logos/ra/icon.svg`
- `public/logos/ra/inverted.svg`
- `public/logos/ra/primary.svg`
- `public/logos/synthex/icon.svg`
- `public/logos/synthex/inverted.svg`
- `public/logos/synthex/primary.svg`
- `public/logos/unite/icon.svg`
- `public/logos/unite/inverted.svg`
- `public/logos/unite/primary.svg`

## Exact approval intake locations

- `config/brand-identity-gaps.json#/ccw` — approved colour, typography, logo and motion identity; source: `.claude/memory/ceo-foundation.md`.
- `config/brand-identity-gaps.json#/john-coutis` — visual token approval by John; source: `packages/brand-config/src/brands/john-coutis.ts`.
- `config/brand-identity-gaps.json#/john-coutis` — voice clone consent and licensed voice asset; source: `packages/brand-config/src/brands/john-coutis.ts`.

These JSON pointers are open approval requirements, not receipts. Supply approved CCW identity tokens/assets, John visual approval, and a consented/licensed voice before replacing the intake entries. Do not delete them merely to obtain a green result. Existing `owned` reference declarations were preserved; this offline audit does not independently prove legal title.

## Validation

- Node 22.22.3; existing dependencies only; external TMP/cache environment sourced.
- Four targeted Jest suites: 95 tests passed, including reference absence, unsafe paths, unknown rights, missing dimensions, canonical mappings, DR colour parity, logo baseline and CCW refusal.
- Offline guard rejects fetch, HTTP, HTTPS and TCP before connection; the guarded CLI still emits its report.
- `npm run visual:preflight` returns 1 with 0 code debt / 24 asset gaps / 3 approval requirements.
- Repository ESLint passed all 12 changed TypeScript files with zero warnings; repository config excludes scripts. The offline guard passed Node syntax checking and the runtime rejection checks above.
- `git diff --check` passed. The per-file source hashes were rechecked after validation.
- Full application build/deploy was not run; this receipt validates the local preflight and affected pure contracts, not production rendering.
- No provider calls, spend, deploys, production writes, migrations, rendering or publication.

## Files changed

- `__tests__/brand-config/visual-preflight.test.ts`
- `__tests__/remotion/brand-registry.test.ts`
- `config/brand-identity-gaps.json`
- `lib/brand-video/preflight.ts`
- `lib/brand/visual-preflight.ts`
- `lib/remotion/brand-content.ts`
- `lib/remotion/brand-registry.ts`
- `package.json`
- `packages/brand-config/src/brands/dr.ts`
- `packages/brand-config/src/brands/john-coutis.ts`
- `packages/brand-config/src/brands/nrpg.ts`
- `packages/brand-config/src/brands/synthex.ts`
- `packages/brand-config/src/brands/unite.ts`
- `scripts/brand-visual-preflight-offline.cjs`
- `scripts/brand-visual-preflight.ts`
- `tests/unit/brand-video/preflight.test.ts`

Evidence files in this directory are additional local artifacts. Files reviewed and SHA-256 values are in `current.json`. The pre-existing social-pipeline edit was not edited by this task.

## Next step

Supply the 24 listed assets and 3 approval requirements, implement CCW approved identity only from those supplied tokens, and rerun the offline preflight. Deployment and provider activation require separate authorization.
