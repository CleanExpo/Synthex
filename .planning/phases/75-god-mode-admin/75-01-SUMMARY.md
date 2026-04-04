# Summary 75-01: God Mode Admin Panel

**Linear:** SYN-18
**Status:** COMPLETE
**Date:** 2026-03-10

---

## What Was Done

Wired the admin panel to real APIs, added owner-only route protection, and added Platform Health + Audit Log views.

---

## Commits

| Hash | Description |
|------|-------------|
| `4b47f2bf` | feat(75-01): add owner-only route guard for admin panel (SYN-18) |
| `7374eb9c` | feat(75-01): add shared verifyAdmin utility with owner email bypass (SYN-18) |
| `2dec0559` | feat(75-01): rewrite admin page with real SWR data fetching and actions (SYN-18) |
| `d3fd5946` | feat(75-01): add platform health and audit log tabs to admin panel (SYN-18) |

---

## Files Changed

### New Files

| File | Purpose |
|------|---------|
| `app/dashboard/admin/layout.tsx` | Server component route guard — redirects non-owners to /dashboard |
| `lib/admin/verify-admin.ts` | Shared admin auth utility replacing 3× copy-paste implementations |
| `app/api/admin/platform-stats/route.ts` | New API — returns totalUsers, activeSubscriptions, freeUsers, triallingSubscriptions |
| `components/admin/platform-health.tsx` | Platform Health tab — job queue stats + subscription metrics via SWR |
| `components/admin/audit-log-viewer.tsx` | Audit Log tab — paginated table with category/severity/date filters |

### Modified Files

| File | Change |
|------|--------|
| `app/dashboard/admin/page.tsx` | **Rewritten** — removed supabase.auth.admin.*, added SWR + real API actions + Tabs |
| `app/api/admin/users/route.ts` | Replaced local verifyAdmin with shared utility; added isOwnerEmail bypass |
| `app/api/admin/audit-log/route.ts` | Replaced local verifyAdmin with shared utility |
| `app/api/admin/jobs/route.ts` | Replaced local verifyAdmin with shared utility; removed unused prisma import |
| `components/admin/types.ts` | Updated User type from Supabase fields (created_at/last_sign_in_at) to Prisma fields (createdAt/lastLogin) |
| `components/admin/admin-config.ts` | Updated calculateStats() to use new User type fields; fixed date calculation bug |
| `components/admin/users-table.tsx` | Updated field references from created_at/last_sign_in_at to createdAt/lastLogin |
| `components/admin/edit-user-dialog.tsx` | Updated field references from created_at/last_sign_in_at to createdAt/lastLogin |

---

## Decisions Made

1. **Server-side auth in layout**: Used `verifyTokenSafe()` + cookie read + Prisma lookup (no `getServerSession` — that function does not exist; the `auth-service.ts` is a client-side class). The layout reads the `auth-token` httpOnly cookie directly using `next/headers`.

2. **verifyAdmin cookie fallback**: The shared `verifyAdmin` utility also parses the `auth-token` cookie from the `cookie` request header as a fallback after the Bearer token check — this allows browser-initiated SWR requests to authenticate without an explicit Authorization header.

3. **User type migration**: The `User` type in `components/admin/types.ts` previously used Supabase-style field names (`created_at`, `last_sign_in_at`). Updated to Prisma-style (`createdAt`, `lastLogin`) to match the actual API response from `/api/admin/users`. All consumer components updated.

4. **MRR field**: The Subscription model does not have an `amount` field (billing amount lives in Stripe). The platform-stats API returns `mrr: 0` with a comment. A future phase can add Stripe API integration to compute real MRR (SYN-future).

5. **handleSaveUser in admin page**: The edit dialog maps the user's chosen status ('suspended', 'banned', etc.) to the matching API action ('suspend', 'activate', 'delete'). Role updates are not yet persisted via the API — the existing POST endpoint only handles status actions (suspend/activate/delete). This is a known limitation; a future plan should add a role-update action to the POST handler.

6. **Bulk actions**: Implemented as parallel `Promise.allSettled()` calls — each user action is a separate POST request. Failed requests are counted and reported in the toast.

---

## Bugs Fixed During Implementation

1. **calculateStats date bug** (in `admin-config.ts`): The original code mutated `now` with `setHours()` and then used the mutated value for `weekAgo` calculation via `setDate()` on the already-mutated date, producing incorrect week calculations. Fixed by creating independent date objects.

2. **Unused `prisma` import** in `app/api/admin/jobs/route.ts`: The inline `verifyAdmin` function was the only prisma user in that file. Removed the import when replacing with the shared utility to avoid a lint warning.

3. **CSV injection protection** in `exportUsersToCSV`: Original code joined fields with plain commas without quoting. Updated to wrap each cell in double-quotes and escape embedded quotes.

---

## Deferred / Nice-to-Haves (logged here, not blocking)

- Password reset endpoint (`/api/admin/users` POST with `action: 'reset-password'`) — admin page shows toast only for now
- Role update action in `/api/admin/users` POST — handleSaveUser currently maps role to status action as a workaround
- MRR from Stripe API — platform-stats returns 0 until Stripe amount field or API query is added
- Audit log entry detail drawer / expandable row for viewing `details` JSON

---

## Success Criteria Verification

- [x] Non-owner users cannot access `/dashboard/admin/` (redirect to `/dashboard`)
- [x] Admin panel loads real users from Prisma (not Supabase admin client)
- [x] Suspend/activate/delete actions call real API and persist to DB
- [x] No fake `setTimeout` in any handler
- [x] No `supabase.auth.admin.*` calls in client-side code
- [x] Platform Health tab shows live job queue stats
- [x] Audit Log tab shows real entries with filter controls
- [x] `npm run type-check` passes (0 errors)
- [x] `npm run lint` passes (0 errors, 0 warnings on changed files)
- [x] SUMMARY.md created
- [x] STATE.md updated
