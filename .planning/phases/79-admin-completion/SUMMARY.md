# Plan 79-01 Summary: Role Update API & Edit-User Dialog Wiring

**Linear:** SYN-18
**Status:** Complete
**Date:** 10/03/2026

---

## Tasks Completed

### Task 1: Add PATCH handler to `app/api/admin/users/route.ts`
- Added `updateUserSchema` Zod schema for `{ userId, role?, status? }` validation
- Added `PATCH` export with full admin auth, org scoping, and superadmin protection
- Merges role/status into existing `preferences` JSON field
- Deletes user sessions when status changes to `suspended` or `banned`
- Creates audit log entry (`user_role_updated`) with previous and new values
- Severity set to `high` for admin role promotions, `medium` otherwise

### Task 2: Update `handleSaveUser` in `app/dashboard/admin/page.tsx`
- Replaced POST-based save (which only sent status-derived actions) with PATCH call
- Now sends both `role` and `status` fields to the API in a single request
- Role changes are no longer silently lost

### Task 3: Wire password reset action
- Replaced toast-only stub in `handleUserAction` case `'reset-password'`
- Now calls `/api/auth/request-reset` POST with the target user's email
- Added `users` to the `handleUserAction` dependency array
- Shows success/error toast with the target email address

### Task 4: Make email field read-only in `components/admin/edit-user-dialog.tsx`
- Changed email `Input` to `readOnly` with `cursor-not-allowed` styling
- Removed `onChange` handler from email input
- Added helper text: "Email cannot be changed from the admin panel"

---

## Verification

- `npm run type-check` — PASS
- `npm run lint` — PASS

---

## Files Modified

| File | Change |
|------|--------|
| `app/api/admin/users/route.ts` | Added PATCH handler with Zod schema, org scoping, superadmin guard, session invalidation, audit logging |
| `app/dashboard/admin/page.tsx` | handleSaveUser uses PATCH; password reset wired to `/api/auth/request-reset`; deps updated |
| `components/admin/edit-user-dialog.tsx` | Email field made read-only with helper text |

---

## Success Criteria Met

- [x] `PATCH /api/admin/users` accepts `{ userId, role?, status? }` and updates preferences
- [x] Org scope enforced: admins cannot modify users from other organisations
- [x] Superadmin protection: PATCH rejects modifications to superadmin users
- [x] Role changes create audit log entries with previous and new role
- [x] Status change to suspended/banned deletes user sessions
- [x] `handleSaveUser` calls PATCH (not POST) with role and status
- [x] Password reset action calls `/api/auth/request-reset` with user's email
- [x] Email field is read-only in edit dialog
- [x] `npm run type-check` passes
