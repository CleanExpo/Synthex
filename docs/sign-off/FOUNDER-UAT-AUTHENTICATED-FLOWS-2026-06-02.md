# Founder UAT - Authenticated Flows - 2026-06-02

| Field | Value |
|---|---|
| Evidence date | 2026-06-02 Australia/Brisbane |
| Production domain | `https://synthex.social` |
| Release under UAT | `373f349d` |
| UAT status | PASS |
| Current automated gate | `shipit:status:live -- --run-rls` passed with 0 blockers and 0 warnings for `373f349d` |

## Purpose

This packet captures the authenticated founder-flow acceptance step after
automated `/shipit` passed for release `373f349d`.

The automated gates prove production health, release parity, live RLS coverage,
and high-exposure RLS policy repair. This UAT packet proves the founder-facing
authenticated experience behaves correctly with a real production user.

## Preconditions

- Production serves release `373f349d`.
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

- UAT executor: Codex automated founder UAT runner.
- Production user identity used, without secret values: temporary production UAT user `synt***@synthex.social`.
- Timestamp started: `2026-06-01T23:44:54.910Z`.
- Timestamp completed: `2026-06-01T23:45:10.816Z`.
- Browser/device: Playwright Chromium headless on macOS.
- Business context tested: two temporary production business contexts:
  `2f331637-04cf-4202-a8eb-c21eda5444eb` and
  `db8393df-d82c-4294-9937-100ef94346ab`.
- Result: PASS.
- Notes:
  - Evidence JSON: `/private/tmp/synthex-founder-auth-uat-20260601234454.json`.
  - Temporary user, business contexts, team memberships, business ownerships,
    draft, and auth user were deleted after the run.
  - The draft was created with status `draft`; no publishing action was taken.

## Execution Results

- Sign-in redirected to `/dashboard`.
- `/dashboard` loaded as an authenticated route.
- `/api/businesses?stats=true` returned two accessible business contexts.
- `/dashboard/settings/brand-profile` loaded as an authenticated route.
- A low-risk business description update saved through `/api/brand-profile`.
- The saved business detail persisted after reload.
- Switching to a secondary business context succeeded.
- The secondary business context was isolated from the primary business detail.
- Switching back to the primary business context succeeded.
- The primary business detail persisted after context switching.
- `/dashboard/content/drafts` loaded as an authenticated route.
- A draft was created through `/api/content-drafts` with status `draft`.
- The saved draft appeared in the authenticated drafts context.
- `/dashboard/settings/billing` loaded as an authenticated route.
- Sign-out through `/api/auth/logout` succeeded.
- Visiting `/dashboard` after sign-out redirected to
  `/login?redirect=%2Fdashboard`.

## Issue Capture

For any failure, create a focused follow-up with:

- route
- browser/device
- business context
- exact visible symptom
- expected behavior
- screenshot or short recording location, if safe
- whether the issue blocks founder acceptance

No blocking issues were found in the accepted run.

## Current Status

Founder authenticated-flow UAT passed for production release `373f349d`.
