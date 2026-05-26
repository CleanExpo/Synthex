# Synthex Build Cleanup - 2026-05-27

## Canonical Repository

- GitHub: `https://github.com/CleanExpo/Synthex.git`
- Active local checkout: `/Users/phill-mac/pi-seo-workspace/Synthex`
- Convenience symlinks:
  - `/Users/phill-mac/Documents/Synthex -> /Users/phill-mac/pi-seo-workspace/Synthex`
  - `/Users/phill-mac/Synthex -> /Users/phill-mac/pi-seo-workspace/Synthex`
- Current baseline: `main` at `f7a59e2 feat(agency): v12.0 In-House Agency OS (SYN-971) (#300)`

## Archived Local Builds

Old local Synthex app checkouts were preserved, not deleted, under:

`/Users/phill-mac/Local-Quarantine/Synthex-cleanup-20260526-230400/archived-local-builds`

Archived app checkouts:

- `Synthex`
- `Synthex-audit`
- `Synthex-hygiene`
- `Synthex-journey-hmac`
- `Synthex-owner-override`
- `Synthex-phase1`
- `Synthex-phase2`
- `Synthex-phase3`
- `Synthex-phase4`
- `Synthex-phase5`
- `Synthex-prod-verify`
- `Synthex-srleak`
- `Synthex-testimonial`

The previous dirty `/Users/phill-mac/pi-seo-workspace/Synthex` checkout was preserved at:

`/Users/phill-mac/Local-Quarantine/Synthex-cleanup-20260526-230400/pi-seo-workspace-Synthex-before-fresh-clone`

The stale partial iCloud/Documents artifact is no longer the active repo path. It remains at:

`/Users/phill-mac/Documents/Synthex_PARTIAL_ORPHAN_20260526-230400`

This partial folder resisted cross-folder moves twice and should be treated as a stale generated artifact, not source truth.

## Dependency Setup Notes

The repo requires Node `22.x` per `.node-version` and `.nvmrc`.

The default shell initially used Node `20.20.2`, which is not valid for this project. Validation used:

`/Users/phill-mac/.nvm/versions/node/v22.22.3/bin/node`

`npm ci` initially failed because npm attempted to write logs/cache under the user home and then hit npm's `Exit handler never called!` failure. The successful install used npm cache/log dirs under `/private/tmp`:

`NPM_CONFIG_CACHE=/private/tmp/synthex-npm-cache NPM_CONFIG_LOGS_DIR=/private/tmp/synthex-npm-logs node npm-cli.js ci --ignore-scripts`

Because scripts were ignored, Prisma generation and the local brand-config package build were run explicitly.

## Verification Evidence

Commands run from `/Users/phill-mac/Documents/Synthex` after cleanup:

- `npm run db:validate` with Node 22/npm 11: passed
  - Prisma schema valid
  - Prisma Client generated, v7.7.0
- `npm run type-check`: passed
- `npm run lint`: passed
- `npm test -- --runInBand`: passed
  - Test Suites: 235 passed, 10 skipped, 245 total
  - Tests: 3632 passed, 201 skipped, 27 todo, 3860 total
- `npm run build` without env: failed as expected because `JWT_SECRET` is required in production build collection
- `JWT_SECRET=synthex-local-build-only-do-not-use-in-production npm run build`: passed
  - Next.js compiled successfully
  - TypeScript completed
  - Static generation completed for 614 pages

## Current Readiness State

The local build surface is now consolidated around one main repo and the baseline code gates are green with an ephemeral local `JWT_SECRET`.

Archived local builds are now inventoried in:

- `docs/pm/synthex-archived-builds-inventory-2026-05-27.md`
- `docs/pm/synthex-archived-builds-inventory-2026-05-27.json`

The archive inventory found that several old branch heads are not ancestors of `origin/main` but are patch-equivalent to current main. Remaining unique review candidates are concentrated in Phase 2 RLS/SOC2 work, journey HMAC signing, hygiene fixes, Phase 1 measurement artifacts, Phase 5 TenantConfig continuation, and one old production sign-off document that must be refreshed before it can count as current release evidence.

Not yet `/shipit`:

- Production env must provide real `JWT_SECRET`, `DATABASE_URL`, Redis, AI, Twitter/social, and provider credentials as appropriate.
- `npm audit` reported 6 low severity vulnerabilities after dependency install.
- Several runtime warnings during build are expected without local production env, but must be verified against Vercel production env before release.
- The stale partial Documents artifact still exists outside the canonical path because filesystem moves from Documents to quarantine hung twice.
- Live runtime, authenticated browser flows, RLS live database state, and Vercel deployment readiness have not been re-verified in this cleanup pass.
