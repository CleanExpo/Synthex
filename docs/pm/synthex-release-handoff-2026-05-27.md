# Synthex Release Handoff - 2026-05-27

> Superseded by PR #311, release commit `700dff176801a9c88a0e839b41ca65ae4ad8efbb`, and `docs/sign-off/SYNTHEX-SHIPIT-READY-2026-05-28.md`.
> This file is preserved as historical handoff evidence for the earlier pre-push/pre-deploy state.

## Current State

- Canonical repo: `https://github.com/CleanExpo/Synthex.git`
- Active checkout: `/Users/phill-mac/pi-seo-workspace/Synthex`
- Working path: `/Users/phill-mac/Documents/Synthex`
- Current local `HEAD`: run `git rev-parse --short HEAD` in the active checkout.
- Last measured pre-handoff `HEAD`: `6362e22d docs(cleanup): SYN-971 record remaining archived synthex paths`
- Local branch: `main`
- Git state: clean, `main...origin/main [ahead 22]`
- Live production currently reports `buildId=f7a59e2`, not the local release commit.

## Local Commits Waiting For Push

Measured before this handoff packet was committed:

```text
6362e22d docs(cleanup): SYN-971 record remaining archived synthex paths
d2b65c85 chore(cleanup): SYN-971 archive stale partial artifact
a090a84f fix(rls): SYN-971 cover remaining prisma tables
70b18714 fix(rls): SYN-971 enable policy-backed tables
e92b900c chore(rls): SYN-971 surface coverage shipit gate
f6fe5bc9 chore(shipit): SYN-971 add gate status reporter
2c64b021 chore(env): SYN-971 add production metadata verifier
2e6ffd5c test(e2e): SYN-971 split production browser gates
fc89da00 fix(deploy): SYN-971 enforce release identity smoke
6d01f97e docs(pm): SYN-971 record dependency audit gate
d924d9f1 fix(health): SYN-971 align readiness cache probe
b3cbf1b8 fix(cron): SYN-971 enforce scheduled route secrets
06cdb557 fix(deploy): SYN-971 repair production smoke verification
34bbd249 docs(pm): SYN-971 record current readiness gates
c319db75 docs(pm): SYN-971 preserve stale signoff evidence
58f59cb5 docs(pm): SYN-971 close phase1 archive import
32b50093 fix(brand-config): SYN-971 close phase5 archive import
e9e57964 docs(pm): SYN-971 close hygiene archive import
19cb9103 docs(pm): SYN-971 close journey hmac archive import
7b575aa1 docs(pm): SYN-971 close phase2 archive import
e0915eed docs(pm): SYN-971 inventory archived Synthex builds
6c3eadf5 docs(pm): SYN-971 record Synthex build cleanup
```

## Local Gates Already Passing

- `npm run db:validate`
- `npm run type-check`
- `npm run lint`
- `npm test -- --runInBand`
- `JWT_SECRET=synthex-local-build-only-do-not-use-in-production npm run build`
- `npm run rls:coverage`
- `npm run verify:prod-env`
- `npm run e2e:prod:public:bash`
- `npm run shipit:status` passes all local source/artifact gates except expected push and DB-access blockers.

## Remaining Approval/Access Gates

1. Explicit human approval to push local `main` to `origin/main`.
2. Production deployment from the pushed commit.
3. Supabase/Postgres DB access in the shell via `SUPABASE_DB_URL` or `DATABASE_URL`.
4. Production test credentials for authenticated Playwright flows:
   - `PROD_TEST_EMAIL`
   - `PROD_TEST_PASSWORD`

## Release Sequence After Push Approval

```bash
git status --short --branch
git push origin main
npm run shipit:status:live
EXPECTED_GIT_SHA=$(git rev-parse HEAD) node scripts/verify-deployment.js
npm run e2e:prod:public:bash
```

With DB access present:

```bash
npm run shipit:status:live -- --run-rls
```

With authenticated production test credentials present:

```bash
npm run e2e:prod:critical:bash
```

## `/shipit` Criteria Still Not Met

Synthex is not `/shipit` until:

- GitHub `origin/main` contains local `HEAD`.
- Production `/api/health.buildId` matches the release commit prefix.
- Live Supabase adversarial RLS passes against `pg_policies`.
- Authenticated production browser flows pass with real production test credentials.
- Any remaining provider-scope decisions are accepted or explicitly deferred.
