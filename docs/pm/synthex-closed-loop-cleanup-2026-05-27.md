# Synthex Closed-Loop Cleanup Command

## Operating Loop

The loop runs until every executable gate is green or a hard blocker is proven.

1. Senior Project Manager owns the blocker ledger and keeps the loop focused on production readiness.
2. Orchestrator Agent assigns disjoint work slices and prevents duplicate edits.
3. Environment Lead owns Vercel, local `.env.local`, GitHub Actions secrets, and masked inventory.
4. Backend Lead owns DB migration dry-runs, Prisma/schema drift, and org-context save endpoints.
5. Security Lead owns RLS coverage, adversarial RLS, CSRF, auth, owner access, and secret hygiene.
6. Frontend QA Lead owns authenticated business-details save/reload verification.
7. Release Lead owns `/shipit`, deployment parity, GitHub PR status, and final sign-off evidence.

## Current Loop State

- Production Vercel env metadata: required names present.
- Development Vercel env metadata: required names present.
- Preview Vercel env metadata: missing `JOURNEY_PIXEL_SIGNING_KEY_PRIMARY`, `OWNER_EMAILS`, `APIFY_API_TOKEN`, and `HEYGEN_API_KEY` for generic preview.
- Local `.env.local`: refreshed from Vercel development and ignored by git.
- GitHub Actions secrets: limited to `ANTHROPIC_API_KEY`, `VERCEL_DEPLOY_HOOK`, and `VERCEL_TOKEN`.
- DB dry-run: executable after ESM fix, then correctly fails closed because the connected database has public tables but no migration tracking tables.
- RLS schema coverage: green.
- RLS adversarial: green against the baseline floor, with high-exposure warning tables still surfaced.

## Hard Blockers Before 100% Green

- Reconcile database migration history: the connected database has 247 public base tables, no `public._prisma_migrations`, and no `public.schema_migrations`, so migration history cannot be trusted. The refined audit now accounts for Prisma create-then-drop migrations: Prisma final-state migration table targets are present, but 26 Supabase migration table targets are missing live, including the Prisma-modeled `dunning_states`, `mention_freshness`, and `nap_citation` tables.
- Repair generic Preview env scope or document that preview envs are branch-scoped only.
- Complete authenticated business-details save/reload verification against the deployed app.
- Resolve high-exposure RLS warning tables or explicitly downgrade them with evidence.

## Agent Closure Rule

No agent may mark the application complete unless all of these are true:

- `npm run type-check` passes.
- `npm run validate:env` passes.
- `npm run verify:prod-env -- --project synthex --target production` passes.
- `npm run verify:prod-env -- --project synthex --target preview` passes or has a documented branch-scope exception.
- `npm run verify:prod-env -- --project synthex --target development` passes.
- `npm run db:migrate:dry-run` passes only after migration tracking exists and reports no unexpected pending migrations.
- `npm run rls:coverage` passes.
- `npx dotenv -e .env.local -- npm run rls:adversarial` passes with no untriaged warning tables.
- `npm run shipit:status:live -- --run-rls` passes from a clean, pushed branch.
- Authenticated business-details save/reload verification passes.
