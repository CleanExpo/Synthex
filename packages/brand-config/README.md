# @unite-group/brand-config

Single source of truth for Unite-Group portfolio brands: DR, NRPG, RestoreAssist, CARSI, CCW, Synthex, Unite. Consumed by Remotion video compositions and (Phase 2.2+) by web frontends.

## Install (in-repo, file: protocol)

```jsonc
// remotion-studio/package.json or any other Pi-Dev-Ops sub-app
"dependencies": {
  "@unite-group/brand-config": "file:../packages/brand-config"
}
```

Run `pnpm install` (or `npm install`) from the consumer; the package's `dist/` build output is what's imported. Run `pnpm --filter @unite-group/brand-config build` first if `dist/` is empty.

## Usage

```ts
import { brands, ra, themeFactory, oklchFromHex } from '@unite-group/brand-config';

// 1) Direct brand access (Remotion compositions, voiceover, etc)
const cfg = brands['ra'];
console.log(cfg.colour.primary);             // "#0E7C7B"
console.log(cfg.motion.signature);            // "sweep"

// 2) Theme bridge for web apps
const theme = themeFactory(ra);
console.log(theme.tokens.primary.oklch);      // "oklch(48.5% 0.066 195.4)"
console.log(theme.cssVars.light['--primary']); // OKLch string ready to inject
console.log(theme.tailwind.colors.brand);     // { primary, secondary, accent }

// 3) Standalone OKLch conversion
oklchFromHex('#0E7C7B');                      // "oklch(48.5% 0.066 195.4)"
```

## Wiring web apps (Phase 2.2 / 2.3)

For Tailwind v4 + shadcn consumers (RestoreAssist style):

```css
/* app/globals.css */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  /* ... */
}

:root { /* values from themeFactory(brand).cssVars.light */ }
.dark  { /* values from themeFactory(brand).cssVars.dark  */ }
```

For Tailwind v3 consumers (Pi-CEO Dashboard style, until upgraded):

```ts
// tailwind.config.ts
import { themeFactory, ra } from '@unite-group/brand-config';
const t = themeFactory(ra);

export default {
  theme: { extend: { ...t.tailwind } },
};
```

## Source of truth

- Each brand is a typed `BrandConfig` at `src/brands/{slug}.ts`.
- The 9-section `DESIGN.md` projection per brand lives at `Pi-Dev-Ops/remotion-studio/src/brands/{slug}.md` (Phase 1 deliverable, kept there for proximity to compositions).
- Edits to a brand: edit `.ts` here → re-run `remotion-brand-codify` → `.md` projection regenerates.

## Build

```sh
pnpm --filter @unite-group/brand-config build   # tsup → dist/
pnpm --filter @unite-group/brand-config typecheck
```

The `themeFactory` is pure (no I/O, no `Math.random`). Same `BrandConfig` input → same `ThemeOutput` always.
