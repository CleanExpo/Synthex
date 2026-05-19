# Phase 7 Preview Verification

Date: 2026-05-19
Branch: `chore/brand-config-type-test-utils`
Preview: https://synthex-45o4mqbt7-unite-group.vercel.app
Deployment ID: `dpl_Gc7rdAX6D4twNJTywqUrBtUdCmbP`
Inspector: https://vercel.com/unite-group/synthex/Gc7rdAX6D4twNJTywqUrBtUdCmbP

## Scope

Phases 1-6 of the Synthex Pipedream sandbox build:

- command-centre control contracts
- draft-only command intake API
- Command Centre draft intake panel
- Hermes observe-only handoff
- provider readiness gates
- draft presentation and Gen Media packet services

## Local Verification

```bash
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('package ok')"
npx prisma validate
npx jest --config jest.worktree.cjs tests/unit/lib/prisma.test.ts --runInBand
npm test -- --runInBand
npm run build
```

Results:

- package JSON parsed.
- Prisma schema validated.
- targeted Prisma harness test passed.
- full Jest passed: 195 suites, 3,465 tests.
- production build completed successfully.

Build notes:

- local build emitted database-auth warnings during static data collection, then recovered through fallback paths and exited 0.
- Vercel preview build completed with `readyState: READY`.

## Preview Smoke

```bash
curl -i -s https://synthex-45o4mqbt7-unite-group.vercel.app/dashboard
curl -i -s -X POST https://synthex-45o4mqbt7-unite-group.vercel.app/api/command-centre/intake \
  -H 'Content-Type: application/json' \
  --data '{"source":"manual","speaker":"Phill","rawText":"Preview smoke."}'
```

Results:

- `/dashboard` returned `307` to `/login?redirect=%2Fdashboard`.
- unauthenticated `POST /api/command-centre/intake` returned `401` with no draft execution.

## Production Gate

Production remains blocked. No production deploy was run.

Promotion requires:

- authenticated browser review of the Command Centre panel.
- security review of provider readiness and intake routes.
- explicit human approval gate.
- no publish, spend, or public media actions enabled by default.
