# Self-hosted fonts

Font files for `synthex-design` art-boards. Boards are rendered from `file://`
by `scripts/design/render-board.mjs`, which **aborts every non-`file:` request**
— so a Google Fonts `<link>` or `@import` is a hard render failure, not a
silent fallback to a system face.

Paths mirror the `typography.display.src` / `typography.body.src` values already
declared in `packages/brand-config/src/brands/<slug>.ts`, so a board's
`@font-face` and the brand config agree by construction.

## Licences

Every face is licensed under the SIL Open Font License 1.1
(<https://openfontlicense.org>), which permits redistribution and embedding.
Latin subsets, fetched from Google Fonts.

| File                            | Family         | Weight | Licence                                   |
| ------------------------------- | -------------- | ------ | ----------------------------------------- |
| `carsi/Lora-Bold.woff2`         | Lora           | 700    | SIL OFL 1.1 — © Cyreal                    |
| `carsi/Inter-Regular.woff2`     | Inter          | 400    | SIL OFL 1.1 — © The Inter Project Authors |
| `ra/Inter-ExtraBold.woff2`      | Inter          | 800    | SIL OFL 1.1 — © The Inter Project Authors |
| `ra/Inter-Regular.woff2`        | Inter          | 400    | SIL OFL 1.1 — © The Inter Project Authors |
| `ra/JetBrainsMono-Medium.woff2` | JetBrains Mono | 500    | SIL OFL 1.1 — © JetBrains s.r.o.          |

## Adding a brand

Only add faces a brand's config already declares. Never substitute a different
family and leave the config saying otherwise — if a declared file is missing,
the engine records `missing-font:<brand>/<family>` in the run manifest and says
so in the run summary. A silent fallback is the failure this directory exists
to prevent: a CARSI board set in a system serif instead of Lora has lost the
thing that defines the brand, and nothing in the output would tell you.

## Provenance and how to verify a face

Files are the **latin static instances** published by
[Fontsource](https://fontsource.org) on jsDelivr, e.g.
`https://cdn.jsdelivr.net/npm/@fontsource/inter@5/files/inter-latin-400-normal.woff2`.
Static per-weight instances, not variable fonts: a variable file would make
`Inter-Regular.woff2` and `Inter-ExtraBold.woff2` byte-identical, and a filename
that no longer distinguishes what it holds is the same silent-substitution
problem this directory exists to prevent.

`ra/Inter-Regular.woff2` is byte-identical to `carsi/Inter-Regular.woff2`
(sha256 `8909904a…`), which is how the CARSI faces were confirmed to share this
provenance. They are kept as separate files so each brand's declared
`typography.*.src` path resolves independently.

**A filename is not evidence of a weight.** Read the weight out of the file
before trusting it:

```bash
pip install fonttools brotli   # brotli is required to open woff2
python3 -c "
from fontTools.ttLib import TTFont; import sys
f = TTFont(sys.argv[1]); print(f['OS/2'].usWeightClass)" public/fonts/ra/Inter-ExtraBold.woff2
# => 800, matching typography.display.weight in ra.ts
```

Verified 29/08/2026 — `ra/` reads 800 / 400 / 500, matching the three weights
`packages/brand-config/src/brands/ra.ts` declares.
