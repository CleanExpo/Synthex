# Brand Build Recipe — audit → brand-config entry

Turns a **corrected** audit (every `[INFERRED]`/`[MISSING]` flag resolved —
see [audit-recipe.md](audit-recipe.md)) into a first-class entry in
`packages/brand-config`, the single source of truth every agent reads.

Do not run this on an audit with open flags.

## Steps

### 1. Register the slug

Add the new `<slug>` to the `BrandSlug` union in
`packages/brand-config/src/types.ts` with a short comment naming the client.

### 2. Create the runtime config

`packages/brand-config/src/brands/<slug>.ts`, exported
`as const satisfies BrandConfig` (match `synthex.ts` as the template).
Populate from the corrected audit:

- `voice` — tones (must fit the `BrandTone` union; extend the union with a
  documented comment only if genuinely new), `forbiddenWords`
  (spread `FORBIDDEN_PRONOUNS` unless the client brand speaks in first
  person), `requiredCadence`
- `colour` — primary/secondary/accent, neutral ramp, semantic set, `family`
- `typography` — display/body(/mono) with `src` paths
- `logo` — variant paths + `safeAreaPx` from the audit's logo rules
- `motion`, `voiceover` — from the audit or agreed defaults; mark any
  defaulted value with a source comment
- `doNot` — the client's forbidden treatments, verbatim
- `audience`, `defaultChannel`, `legalName`, `displayName`, `tagline`

Trace comments (`// [verified-YYYY-MM-DD · field] source: ...`) on any value
whose provenance isn't obvious, matching the existing house style.

### 3. Create the agent-readable projection

`packages/brand-config/src/brands/<slug>.design.md` in the **Google
DESIGN.md v1 frontmatter format** — copy the structure of
`synthex.design.md` (frontmatter: `colors`, `typography`, `spacing`,
`rounded`, `components`; body: Overview, Colors, Typography, Layout,
Do's and Don'ts). This format is what the brandprint skill, Impeccable, and
every other DESIGN.md-aware tool consume — keep it token-complete.

### 4. Register the brand

Add the import and entry to the `brands` record in
`packages/brand-config/src/brands/index.ts`.

### 5. Place the assets

- Logos → `public/logos/<slug>/`, named `primary`, `inverted`, and `icon` to
  match the three `BrandLogo` variants. `svg` is the declared extension across
  every existing brand; use it where the client supplies vector artwork and
  keep the filenames identical when they only supply raster.
- Fonts → the path referenced by the config's `typography.src` entries
- Never commit fonts the client hasn't licensed for this use

`logo` paths in `<slug>.ts` are written relative to `public/` — every existing
brand declares `logos/<slug>/primary.svg`, so the file belongs at
`public/logos/<slug>/primary.svg`. `.claude/DESIGN.md` agrees (Real Logos,
Phill Rule 4).

Two schemes share `public/logos/` and are **not** interchangeable:

| Path                                              | Asset class                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `public/logos/<slug>/{primary,inverted,icon}.svg` | A brand's own identity variants — what `BrandLogo` and this recipe mean                          |
| `public/logos/<slug>.{png,svg}`                   | A third party's logo for social proof / logo walls, auto-fetchable via `/api/logo-fetch?domain=` |

Both key on a slug, so `public/logos/dr/` and `public/logos/dr.png` can coexist
and mean different things. Never satisfy a `BrandLogo` variant with a flat
customer-logo file.

Two further traps, both real today:

- **Nothing in `brand-config` resolves this field.** `theme-factory.ts`,
  `index.ts`, and `tenant-resolver.ts` never read `logo`, so a wrong path fails
  silently instead of throwing. Step 6's on-disk check is the only guard.
- **`public/brands/<name>/` is a different, older scheme** keyed by full brand
  name rather than slug (see `lib/remotion/brand-content.ts`). Don't add to it.

### 6. Verify — mandatory, paste real output

```bash
npm run type-check
npm test -- __tests__/brand-config
```

Both must pass. The Jest suite lives at `__tests__/brand-config/`, not inside
the package; the package's own `*.test-d.ts` files are type-level assertions
covered by `type-check`. A `satisfies BrandConfig` failure means the audit data
doesn't fit the contract — fix the data or (with justification) the type,
never force-cast. Then confirm every asset path referenced in `<slug>.ts`
and `<slug>.design.md` resolves on disk.

Optional UI gate: render a sample branded surface and run the detector bundled
with the installed impeccable skill to catch slop before the client sees it:

```bash
node ~/.claude/skills/impeccable/scripts/detect.mjs --json <files>
```

Never `npx impeccable` — `impeccable` is not a repo dependency, so the bare name
would resolve against the public registry. See
[Verification in SKILL.md](../SKILL.md#verification) for the full reasoning.

### 7. Close the loop

Commit as `feat(brand-config): add <slug> brandprint` with the Linear issue
identifier. The corrected audit document is the brand specification — keep
it with the client's records.

## What this recipe does NOT touch

- **Prisma/DB** (`BrandDNA`, `BrandPreset`, `Organization`) — runtime tenant
  branding is a separate concern; syncing config → DB is out of scope here.
- **Schema changes** beyond the `BrandSlug` union and, rarely, `BrandTone`.
- `prisma db push` — never (repo rule).
