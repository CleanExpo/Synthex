# 70-01 Summary — Welcome Email Sequence

**Plan:** 70-01-PLAN.md
**Issue:** SYN-52
**Status:** Complete
**Executed:** 2026-03-10

## What Was Done

Added a three-email welcome sequence (D+0, D+3, D+7) to reduce signup-to-first-value time.

### Task 1 — Welcome email templates

Added three fire-and-forget functions to `lib/email/billing-emails.ts`:

- `sendWelcomeSequenceDay0(email, name?)` — Subject: "Welcome to Synthex — let's get you your first result". Content: 3 numbered first actions (connect platform, generate content, connect API key) + dashboard CTA. Dark theme, gradient header matching billing email style.
- `sendWelcomeSequenceDay3(email, name?)` — Subject: "3 things our best users do in their first week". Content: Three tip cards (daily AI generation, batch scheduling, 24-hour analytics review) + Content Studio CTA.
- `sendWelcomeSequenceDay7(email, name?)` — Subject: "How's your first week with Synthex going?". Content: Check-in message + Pro feature table (unlimited AI, advanced analytics, all 9 platforms, A/B testing, priority support) + pricing CTA. Only dispatched to free/starter users by the cron route.

All three follow the exact existing pattern: `getResend()` lazy singleton, `.catch()` error swallowing, inline dark-theme HTML (`#0a0a0a` body, gradient header, `#1a1a1a` card blocks).

**Commit:** `4c1096a2` — `feat(70-01): add welcome email sequence templates (SYN-52)`

### Task 2 — Trigger D+0 and schedule D+3/D+7

**Modified:** `app/api/onboarding/route.ts`
- Imported `sendWelcomeSequenceDay0` from `lib/email/billing-emails`.
- After successful onboarding transaction, fetches current `user.preferences`, merges `emailSequenceStartedAt: new Date().toISOString()` in, and persists via `prisma.user.update`. Wrapped in its own try/catch so any failure here never blocks the onboarding response.
- Calls `sendWelcomeSequenceDay0(user.email, user.name)` fire-and-forget immediately after.

**Created:** `app/api/cron/welcome-sequence/route.ts`
- `GET` handler authorised by `Authorization: Bearer ${CRON_SECRET}` header.
- Uses `prisma.$queryRaw` to find all users where `preferences->>'emailSequenceStartedAt'` is non-null (Prisma's JSON `where` does not support dot-path queries).
- D+3 logic: elapsed >= 3 days AND `emailSequenceDay3Sent` not set in preferences → `sendWelcomeSequenceDay3` + update preferences.
- D+7 logic: elapsed >= 7 days AND `emailSequenceDay7Sent` not set → checks `prisma.subscription` for paid active status → skips professional/business/custom active/trialing plans → `sendWelcomeSequenceDay7` + update preferences.
- Returns JSON: `{ success, day3Sent, day7Sent, errors, totalUsersChecked, durationMs }`.
- `maxDuration: 120` (2-minute serverless limit — lightweight dispatch only).

**Modified:** `vercel.json`
- Added `{ "path": "/api/cron/welcome-sequence", "schedule": "0 9 * * *" }` to existing `crons` array (runs 9 AM UTC daily).

**Commit:** `c8e3af10` — `feat(70-01): trigger D+0 email and add welcome-sequence cron route (SYN-52)`

## Files Changed

| File | Change |
|------|--------|
| `lib/email/billing-emails.ts` | Added 3 welcome sequence functions (+275 lines) |
| `app/api/onboarding/route.ts` | Import + D+0 trigger + emailSequenceStartedAt merge |
| `app/api/cron/welcome-sequence/route.ts` | New file — cron handler for D+3/D+7 |
| `vercel.json` | Added welcome-sequence cron entry |

## Verification

- `npm run type-check` — passed (zero errors)
- D+0 trigger confirmed in `app/api/onboarding/route.ts` (calls `sendWelcomeSequenceDay0`)
- Cron route created at `/api/cron/welcome-sequence/route.ts` with Bearer auth gate
- Preferences gating prevents duplicate sends across cron runs

## Design Decisions

- **Preferences merge pattern**: Fetch current preferences, spread, add new key — avoids overwriting other stored values (notifications, theme, etc.).
- **`$queryRaw` for JSON filtering**: Prisma's typed `where` cannot filter on JSON sub-fields without raw SQL. The raw query is safe (no user input interpolated).
- **D+7 upgrade nudge scoping**: Free and starter users only — `['active', 'trialing'].includes(status) && !['free', 'starter'].includes(plan)` skips paid users correctly. Users with no subscription row are treated as free.
- **Australian English**: "authorised", "organise", "licence" (noun) used throughout cron route comments.
