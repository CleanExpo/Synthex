# SYN-1113 — local closeout, 10 October 2026

The authorized local repair and artwork work is finalized. Eight businesses have complete logo and icon packs: **156 delivery files, 28 retained source/master files, zero missing assets and zero detected code/configuration blockers.** NRPG now uses the four-letter shield confirmed by Phill, rather than the rejected legacy NRP badge.

Source revision: `b8262a0d9b82a958a6ec832293c14ee1181ec5da`. The following evidence-only commit does not change tested code or assets. Source/asset fingerprint: `2e7b6a59d2baf91c66f5b98e0355844bffd96b674ab235b348ed1be4ac76beea`. [Current evidence](current.json) records all 543 reviewed paths and hashes; 219 source/asset files changed. The pre-existing social-pipeline edit remains untouched and excluded from the commits.

## Final verification

- 107 tests passed in five suites on the committed source.
- All 18 scoped TypeScript files passed ESLint with zero warnings. Secret detection, lint-staged and formatting hooks passed without bypass.
- Brand package ESM, CJS and declaration builds passed on the committed source. No full application build, browser render or deployment is claimed.
- All 156 delivered file hashes matched, all 28 original/master hashes matched, all 82 PNGs decoded with visible pixels, and all 57 delivery SVGs were self-contained. ICO bounds and PNG payloads, manifest references and maskable entries passed contract tests.
- Three Node syntax checks and the staged diff whitespace check passed. Font licence whitespace was normalized without changing its wording.
- The lint stall was traced to Node compile-cache reads. Validation completed with `NODE_DISABLE_COMPILE_CACHE=1`; this is documented for repeat runs.
- The guarded visual preflight reports **0 code debt / 0 missing assets / 3 external approval requirements**. Exit 1 intentionally holds those approvals.

[Validation](final-validation.json), [tests](test-output.txt), [package build](build-output.txt), [asset checks](asset-validation.json) and [preflight](preflight-output.txt) preserve the results. [Closeout](closeout.json) records the exact remaining paths and counts.

## Artwork and source trail

Each business has 18 files under `public/logos/<slug>/`: primary SVG/PNG, dark-surface SVG, two greyscale SVGs, icon and favicon SVGs, Safari pinned-tab SVG, 16/32/48/256 PNG favicons, Apple 180 PNG, Android 192/512 PNG, padded maskable 512 PNG, four-size ICO, and web manifest. Synthex has 12 additional app aliases. `config/brand-logo-packs.json` lists every delivery path; [output receipts](official-logo-pack-files.json) list all output hashes.

`config/brand-logo-sources.json` records source URLs, hashes and conversion methods. The NRPG source is the first-party `CleanExpo/DR-NRPG` repository at `fc7ecd47fd03481a31947aa9d5f0e3662907bf24`, path `apps/web/public/images/brand/nrpg-logo-full.png`. The bytes match that commit's blob. The corresponding shared-site URL returned 404; a successful public website download is not claimed for NRPG. [NRPG correction](nrpg-correction.json) preserves the correction and user acceptance.

Other sources are the official RestoreAssist, Disaster Recovery, CARSI, Synthex, Unite-Group Nexus, CCW and John Coutis sites recorded in the source manifest and [research receipts](official-site-research.json). Raster-derived SVGs are traced approximations, not original designer vectors. Unite's cleaned network geometry is explicitly recorded as a reconstruction. Exact original logo bytes and derived masters remain beside the variants. [Preview](official-logo-pack-preview.png).

Brand registry mappings, font paths, token parity, app manifests, Synthex landing logo components and Git ignore rules are repaired. Packaging uses the checked-in masters and existing Sharp dependency under the offline guard; it makes no provider or network calls.

## Cleanup and preservation

Removed unused `public/logos/dr/primary.jpg` and `public/logos/nrpg/icon.png` after finding no references. Removed the task's two temporary tracing environments and prepared bitmap directory from the external volume. All official originals, vector masters, delivery files, public research receipts and historical checkpoints remain. Shared caches were preserved. [Cleanup receipt](cleanup.json).

The July 24 baseline, initial 24-asset checkpoint, later 11-asset checkpoint, and pre-NRPG-correction receipts remain as historical evidence. Their outstanding counts are superseded by `current.json`. Evidence files with `pre-*` or `initial-*` names describe earlier states.

## Remaining external requirements — three, across two brands

| Exact location                                 | Required evidence                                                                                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `config/brand-identity-gaps.json#/ccw`         | Approved colour, typography, logo and motion identity for video.                                                                  |
| `config/brand-identity-gaps.json#/john-coutis` | John's approval of the proposed visual tokens in `packages/brand-config/src/brands/john-coutis.ts`.                               |
| `config/brand-identity-gaps.json#/john-coutis` | Consented original recordings, or explicit permission changing the existing no-synthetic-speech rule plus a licensed voice asset. |

These are external identity/consent inputs. The John engagement remains paused and its tokens remain proposals. Existing runtime gates reject pending identities before jobs can be created. [Approval action sheet](approval-action-sheet.md) describes the closing evidence and exact update steps; no request was sent and no consent was invented. Full portfolio readiness remains held until those receipts exist.

Provider calls, spend, deploys, publication, production writes, migrations and Git push remain disabled. The implementation and evidence are committed locally on main.
