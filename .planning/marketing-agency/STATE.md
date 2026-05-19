# Marketing Agency State

## Current Status

Phase 2 schema design map completed on 2026-05-15. No product code, routes, Prisma schema edits, migrations, providers, tests, or UI were added.

## Repo Truth

- Local path: `/Users/phill-mac/Documents/Synthex`
- Source repo: `https://github.com/CleanExpo/Synthex`
- Branch: `main`
- App framework: Next.js App Router with TypeScript.
- Data layer: Prisma + Supabase/Postgres.
- Auth rule: Supabase-only.
- Tenant boundary: `Organization` / `organizationId`.
- Package scripts use `npm`.

## Key Decisions

- Build inside existing Synthex dashboard and service layers.
- Use organisation-scoped data models.
- Use provider interfaces and mocks before live Artlist/HeyGen integrations.
- Artlist scope is music only unless official docs later prove additional API coverage.
- Meta scope is draft/export/QA only unless `APPROVED_TO_PUBLISH_META_ADS=true` is explicitly added and reviewed.
- Evidence, consent, and licensing are first-class records, not optional metadata.
- Product architecture is now defined across product, agent, Facebook creator, client success, licensing, consent, SEO/AEO/GEO, E-E-A-T, and Meta QA docs.
- Pre-migration schema design is documented in `docs/marketing-agency/schema-map.md`.

## Current Blockers

- No Artlist credentials.
- No HeyGen credentials.
- No Meta ad publishing approval flag.
- No documented Artlist video-generation API.
- No Linear issue was provided for code implementation; docs-only Phase 0-2 design work proceeded from explicit user request.

## Next Action

Begin Phase 2 implementation only after explicit approval for schema edits/migrations:

- edit `prisma/schema.prisma`
- create additive Prisma migration
- create Supabase/RLS migration if required
- add ownership and data-access tests
- run `npx prisma validate`
