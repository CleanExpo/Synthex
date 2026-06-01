# Sign-Off Evidence

This folder contains historical sign-off evidence imported from the archived `Synthex-prod-verify` build plus current shipit evidence for the consolidated main repo.

The 2026-05-16 packet is **not** current `/shipit` evidence. Its verdict was `NOT READY`, and several checks were tied to the production state observed on 2026-05-16.

The 2026-05-27 packet is a superseded cleanup/readiness snapshot. It verified the consolidated local repo and surfaced the then-current blockers, but it is no longer the current verdict.

The 2026-05-28 packet is the current automated `/shipit` evidence. It verifies the consolidated main repo, PR #311 merge, database migration ledger, RLS coverage, live `/shipit` gate, production release parity, Vercel production deployment, production health, and post-merge GitHub workflows.

The 2026-06-02 founder UAT packet is the current manual authenticated-flow acceptance script for production founder review. It is ready for execution, but it is not a PASS until a founder or production test operator completes the evidence fields in `FOUNDER-UAT-AUTHENTICATED-FLOWS-2026-06-02.md`.

Before claiming a future Synthex release is production-ready, rerun the live gates and produce a new dated sign-off packet covering:

- production HTTP probes
- Vercel deploy state
- live RLS/adversarial database checks
- immutable audit-log mutation check
- authenticated browser smoke flows
- billing/Stripe webhook health
- cron guard coverage
- full type-check, lint, test, and build
