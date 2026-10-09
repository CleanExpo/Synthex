# SYN-1113 — official logos and complete offline icon packs

All requested logo and favicon file work is complete locally. **Eight businesses, 156 generated files, zero missing assets, zero detected software/configuration debt.** Three existing identity/voice approval requirements still hold the full portfolio preflight. No approval or consent was inferred from a public website.

Current main base: `ec96cdc4ba498d36e00c0be62f2d039019212efe`; changes remain uncommitted. Audited source/asset fingerprint: `e1a9b83e57a59d9bf7fc3be51596f0124d23aecca584f7b3e076fce2e75f2cb0`. `current.json` lists reviewed and changed paths and SHA-256 values. The fingerprint includes 310 reference images, current source files and present asset inputs; it excludes evidence documents, dependency installations and the untouched pre-existing social-pipeline edit.

## Delivered files

| Delivery                            | Count |
| ----------------------------------- | ----: |
| Businesses                          |     8 |
| SVG files                           |    57 |
| PNG files                           |    82 |
| ICO files                           |     9 |
| Web manifests                       |     8 |
| Generated delivery files            |   156 |
| Preserved originals and SVG masters |    28 |
| Missing logo/font/reference files   |     0 |
| Detected code/configuration debt    |     0 |
| Identity/consent approval inputs    |     3 |

Each business has 18 files under `public/logos/<slug>/`: primary SVG/PNG, a dark-surface SVG, two greyscale SVG treatments, icon SVG, favicon SVG, Safari pinned-tab SVG, 16/32/48/256 PNG favicons, Apple 180 PNG, Android 192/512 PNG, maskable 512 PNG, four-size PNG-backed ICO, and web manifest. Synthex has another 12 local app aliases: browser SVG/ICO, Apple touch icon, structured-data `logo.png`, and the existing eight PWA icon sizes. `config/brand-logo-packs.json` records every deployed path; `official-logo-pack-files.json` records all generated output hashes.

[Visual preview](official-logo-pack-preview.png). Original business artwork and vector masters remain beside the variants. `config/brand-logo-sources.json` records source URLs, hashes and conversion methods.

## Real business sources

| Identity          | Official source                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| RestoreAssist     | https://restoreassist.app/logo.png                                                                                       |
| Disaster Recovery | https://www.disasterrecovery.com.au/ — current inline pulse/DR SVG                                                       |
| NRPG              | https://www.disasterrecovery.com.au/logos/nrp-logo.png and its published NRP favicon                                     |
| CARSI             | https://carsi.com.au/logo/logo1.png and https://carsi.com.au/logo/favicon.png                                            |
| Synthex           | https://synthex.social/ — current orange graph header SVG, with public CSS variables resolved                            |
| Unite-Group Nexus | https://unite-group.in/logos/unite-group-nexus-logo.png                                                                  |
| CCW               | https://ccwonline.com.au/ — current header/company icon images from its own Shopify CDN                                  |
| John Coutis       | https://www.johncoutis.com/ — published JOHN-COUTIS-2 wordmark and character-logo-transparent-john-coutis-2 illustration |

NRPG's standalone `nrpg.com.au` did not resolve; the existing shared Disaster Recovery address is now used in the local content registry. John HTML was retrieved with ordinary browser Accept/content-negotiation headers after the initial 406 response; there was no login, authentication bypass or protected-resource access. Some early guessed asset URLs returned 404; delivered files use successful public source responses, recorded in `official-site-research.json`.

## Conversion and implementation

- Replaced legacy CARSI and RestoreAssist artwork with the logos actually published on their sites. Kept the downloaded originals.
- Used current public header SVGs for Synthex and Disaster Recovery. The published Synthex favicon still carries an older teal mark; the new pack consistently uses the current orange header identity.
- Raster-origin SVGs are traced derivatives, not original designer-supplied vectors. They contain vector geometry, not embedded PNG/JPEG wrappers. Minor contour/colour approximation remains inherent in tracing.
- Unite's photographic glow was flattened; its existing square/network geometry was reconstructed and its original lettering outlined from the source image. That cleaned SVG is explicitly recorded as a derivative reconstruction.
- Small icons use the real house/lens, waveform, network or officially published business favicon/character. No placeholder initials or AI-generated replacement marks were used.
- Dark-surface variants retain bright or opaque badge colours; dark lettering is adapted where needed. Greyscale variants preserve internal detail instead of flattening a complex logo into an unrecognisable solid disc.
- Updated canonical BrandConfig logo paths, all six publishing-content logo mappings, and the logo baseline (now empty). Pending CCW and John consent gates remain intact.
- Local Synthex landing components, root browser/Apple icons, structured-data logo alias and PWA icons now share the pack. The app manifest preserves its existing routes and uses a separately padded maskable icon; ordinary icons are no longer incorrectly labelled maskable.
- `npm run visual:logos` packages from checked-in, hash-verified SVG masters under the offline guard. It needs only the existing Sharp dependency and does not download or trace anything at runtime.
- `npm run visual:test` runs the five pure contract suites with isolated TS transpilation. The initial broader ts-jest run stalled after one passing suite and was stopped; the separate brand-package DTS build passed. No full application typecheck, browser rendering test or deployment is claimed.

## Validation

- **106 tests passed in five suites** using the maintained offline visual test profile.
- **18 changed TypeScript files passed ESLint**, zero warnings. The pack generator and test profile passed Node syntax checks.
- Brand package ESM/CJS/DTS build passed. Existing packages only in the app; the one-time optional vtracer 0.6.12 tool lived in an external-volume Python 3.12 environment. Python 3.14's tracer binding crashed; switching the temporary tool to 3.12 resolved that conversion failure.
- All generated SVGs parsed with viewBox values and no script, event handler, foreignObject, raster-image wrapper or external link. Source/master and output hashes verified.
- All 82 PNG deliveries decoded, contained visible pixels and passed declared icon-dimension checks. ICO entry bounds/PNG payloads, PWA references and maskable entries passed contract tests.
- Final guarded `npm run visual:preflight`: **0 code debt / 0 missing assets / 3 approval requirements**. Exit 1 is intentional for those permissions; it is not a remaining software error.
- `git diff --check` and Git visibility checks passed. All changed source/assets are deliverable; no files are silently hidden by the old Synthex ignore rule.
- No AI generation provider calls, spending, deployment, production writes, publication, migrations or Git push. Downloads were read-only public research; conversion and packaging were local.

## Exact remaining approval locations

- `config/brand-identity-gaps.json#/ccw` — approved colour, typography, logo and motion identity.
- `config/brand-identity-gaps.json#/john-coutis` — visual token approval by John.
- `config/brand-identity-gaps.json#/john-coutis` — consented original recordings, or explicit synthetic-speech permission and a licensed voice asset.

The sources are `config/brand-identity-gaps.json`, `.claude/memory/ceo-foundation.md` and the John BrandConfig. The local John kickoff record additionally keeps the engagement paused and prohibits synthetic speech. Public logos do not approve proposed visual tokens, unpause the engagement, provide original recordings or grant synthetic-voice consent. `approval-action-sheet.md` states the concrete closing evidence. No requests were sent and no proposal was promoted to confirmed.

## Files reviewed, changes and recovery

`current.json` records all reviewed paths, changed source/asset paths and per-file hashes. Evidence documents are additional local changes. The pre-existing `docs/marketing/synthex-social-pipeline.md` edit is untouched.

July 24 commit `d06377e9c7da091102943abfc35ff74548278b26` was reproduced from Git objects: 48 historical debt entries. The July 25 head has the same original preflight blob. `july-24-baseline.json` preserves that reproduction. `initial-current.json`/`initial-README.md` preserve the first 24-asset checkpoint; `pre-official-current.json`/`pre-official-README.md` preserve the later 11-asset checkpoint. Prior receipt files describe those checkpoints and are superseded for the current artwork by the official pack receipts.

## Completion boundary

The requested logo, SVG, favicon and app-icon creation/integration is complete locally. Full SYN-1113 closure still requires the three explicit identity/consent inputs above. When receipts exist, apply only the approved tokens/voice inputs and rerun the offline preflight. Provider calls, spending, deployment and production writes remain disabled.
