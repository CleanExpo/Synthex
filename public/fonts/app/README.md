# Bundled application fonts

Space Grotesk headings (300, 400, 500, 600) and Inter body (400, 500, 600, 700) retain the application design contract. These are Latin static faces from the pinned Fontsource 5.3.0 packages, licensed under SIL OFL 1.1. Both licences and exact download URLs/hashes are recorded here.

`app/layout.tsx` uses `next/font/local`, so builds do not fetch Google Fonts or parse changing CDN URLs. CSS variable names and `display: swap` are preserved. These application weights are separate from each brand's approved art-board typography.

Sources: [Fontsource](https://github.com/fontsource/fontsource), [Next.js local fonts](https://nextjs.org/docs/app/getting-started/fonts). See `sources.json`, `inter-OFL.txt` and `space-grotesk-OFL.txt`.
