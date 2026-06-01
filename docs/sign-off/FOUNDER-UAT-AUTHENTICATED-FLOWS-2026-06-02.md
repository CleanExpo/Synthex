# Founder UAT - Authenticated Flows - 2026-06-02

| Field | Value |
|---|---|
| Evidence date | 2026-06-02 Australia/Brisbane |
| Production domain | `https://synthex.social` |
| Release under UAT | `e367cc92` |
| UAT status | READY FOR FOUNDER EXECUTION |
| Current automated gate | `shipit:status:live -- --run-rls` passed with 0 blockers and 0 warnings |

## Purpose

This packet captures the remaining human acceptance step after automated `/shipit`
passed for release `e367cc92`.

The automated gates prove production health, release parity, live RLS coverage,
and high-exposure RLS policy repair. This UAT packet proves the founder-facing
authenticated experience behaves correctly with a real production user.

## Preconditions

- Production serves release `e367cc92`.
- `npx dotenv -e .env.local -- npm run shipit:status:live -- --run-rls` passes.
- Founder or production test user can sign in at `https://synthex.social/login`.
- No passwords, tokens, API keys, or customer-private content are pasted into
  this packet.

## Automated Preflight

Run before manual UAT starts:

```bash
npx dotenv -e .env.local -- npm run shipit:status:live -- --run-rls
```

Optional authenticated Playwright preflight if production test credentials are
available in the local environment:

```bash
PW_SKIP_WEBSERVER=1 PW_REQUIRE_PROD_CREDS=1 BASE_URL=https://synthex.social npx playwright test tests/e2e/production-critical-paths.spec.ts --project=chromium
```

## Manual UAT Script

1. Sign in at `https://synthex.social/login`.
2. Confirm `/dashboard` loads without redirecting back to login.
3. Open business or organization settings.
4. Update one low-risk business detail field.
5. Save the change and confirm the UI shows a successful save state.
6. Reload the page and confirm the saved value persists.
7. Switch to another business context if one is available.
8. Switch back and confirm the saved business details still persist.
9. Open the content/studio workflow and create a draft without publishing.
10. Save the draft and confirm it appears in the authenticated dashboard context.
11. Open billing or account settings and confirm the authenticated route loads.
12. Sign out and confirm protected dashboard routes no longer load as an
    authenticated session.

## Acceptance Criteria

- Sign-in succeeds with the intended production user.
- Authenticated dashboard routes stay authenticated after navigation and reload.
- Business detail save/reload persists against the correct business context.
- Business context switching does not leak or overwrite another business record.
- Draft creation/save is scoped to the current authenticated business context.
- Billing/account routes are reachable only while authenticated.
- Sign-out invalidates the authenticated session.

## Evidence Capture

Record the following after execution:

- UAT executor:
- Production user identity used, without secret values:
- Timestamp started:
- Timestamp completed:
- Browser/device:
- Business context tested:
- Result: PASS / FAIL / BLOCKED
- Notes:

## Issue Capture

For any failure, create a focused follow-up with:

- route
- browser/device
- business context
- exact visible symptom
- expected behavior
- screenshot or short recording location, if safe
- whether the issue blocks founder acceptance

## Current Status

Ready for founder/human execution.

This packet is not a PASS until the manual UAT script is executed and the
evidence fields above are completed.
