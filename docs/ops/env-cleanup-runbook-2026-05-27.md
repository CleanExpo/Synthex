# Synthex Environment Cleanup Runbook - 2026-05-27

## Source Of Truth

- Vercel project: `unite-group/synthex`
- Production and preview runtime envs live in Vercel.
- Local development uses an untracked `.env.local`; do not commit local env files.
- GitHub Actions should keep only CI/deploy secrets, not a duplicate full runtime store.

## Critical Keep List

- Database: `DATABASE_URL`, `DIRECT_URL`
- Auth/security: `JWT_SECRET`, `NEXTAUTH_SECRET`, `OAUTH_STATE_SECRET`, `FIELD_ENCRYPTION_KEY`, `OWNER_EMAILS`
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Cache/jobs: `REDIS_URL`, `CRON_SECRET`
- AI/media: `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `APIFY_API_TOKEN`, `HEYGEN_API_KEY`
- Billing: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, active Stripe price IDs
- App URLs/observability: `NEXT_PUBLIC_APP_URL`, `NEXTAUTH_URL`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`

## Quarantine Policy

Do not delete Vercel envs by age alone. Put these groups into quarantine first, then remove only after usage scan, migration, deploy, and smoke verification:

- Broad legacy toggles: `ENABLE_*`
- Legacy tracking toggles: `TRACK_*`
- Legacy cache toggles: `CACHE_*`
- Legacy rate-limit aliases: `RATE_LIMIT_ENABLED`, `RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_WINDOW_MS`
- Old CORS alias: `CORS_ORIGIN`
- Public bypass token: `NEXT_PUBLIC_BYPASS_TOKEN`

If a quarantine key is still referenced by runtime code, migrate the code path to the canonical key before removal.

## Commands

Run these from the linked Synthex checkout:

```bash
npm run verify:prod-env -- --project synthex --target production
npm run verify:prod-env -- --project synthex --target preview
npm run verify:prod-env -- --project synthex --target development
npm run env:audit -- --target production
gh secret list --repo CleanExpo/Synthex --app actions
printenv | rg '^(DATABASE_URL|SUPABASE_DB_URL|JWT_SECRET|OWNER_EMAILS)=' || true
```

The Vercel verifier prints names, targets, and secret metadata only. It must never pull or print env values.

## Removal Gate

A Vercel env key can be removed only when all of these are true:

- It is not in the critical keep list.
- It is not referenced by the runtime usage scan, or the code has already migrated away from it.
- The replacement key exists in Vercel for the required targets.
- `npm run type-check` passes.
- `npm run shipit:status:live` has no env-related blocker.
- A production or preview smoke path confirms the affected feature still works.
