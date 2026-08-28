# Self-hosted fonts

Font files for `synthex-design` art-boards. Boards are rendered from `file://`
by `scripts/design/render-board.mjs`, which **aborts every non-`file:` request**
— so a Google Fonts `<link>` or `@import` is a hard render failure, not a
silent fallback to a system face.

Paths mirror the `typography.display.src` / `typography.body.src` values already
declared in `packages/brand-config/src/brands/<slug>.ts`, so a board's
`@font-face` and the brand config agree by construction.

## Licences

Both faces are licensed under the SIL Open Font License 1.1
(<https://openfontlicense.org>), which permits redistribution and embedding.
Latin subsets, fetched from Google Fonts.

| File                        | Family | Weight | Licence                                   |
| --------------------------- | ------ | ------ | ----------------------------------------- |
| `carsi/Lora-Bold.woff2`     | Lora   | 700    | SIL OFL 1.1 — © Cyreal                    |
| `carsi/Inter-Regular.woff2` | Inter  | 400    | SIL OFL 1.1 — © The Inter Project Authors |

## Adding a brand

Only add faces a brand's config already declares. Never substitute a different
family and leave the config saying otherwise — if a declared file is missing,
the engine records `missing-font:<brand>/<family>` in the run manifest and says
so in the run summary. A silent fallback is the failure this directory exists
to prevent: a CARSI board set in a system serif instead of Lora has lost the
thing that defines the brand, and nothing in the output would tell you.
