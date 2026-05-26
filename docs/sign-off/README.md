# Sign-Off Evidence

This folder currently contains historical sign-off evidence imported from the archived `Synthex-prod-verify` build.

The 2026-05-16 packet is **not** current `/shipit` evidence. Its verdict was `NOT READY`, and several checks were tied to the production state observed on 2026-05-16.

Before claiming Synthex is production-ready, rerun the live gates and produce a new dated sign-off packet covering:

- production HTTP probes
- Vercel deploy state
- live RLS/adversarial database checks
- immutable audit-log mutation check
- authenticated browser smoke flows
- billing/Stripe webhook health
- cron guard coverage
- full type-check, lint, test, and build
