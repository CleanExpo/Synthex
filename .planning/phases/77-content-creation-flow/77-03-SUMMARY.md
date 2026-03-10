# Summary 77-03: Draft-to-Publish Pipeline & Publish Confirmation

**Linear**: SYN-45
**Status**: Complete
**Date**: 10/03/2026

---

## What was done

### Task 1: PublishConfirmModal component
Created `components/content/publish-confirm-modal.tsx` -- a reusable scheduling confirmation modal that provides:
- Date/time picker (native `datetime-local` input) defaulting to 1 hour from now, with a minimum of current time
- Platform account verification via SWR fetch to `/api/auth/connections`
  - Shows green checkmark with account name when connected
  - Shows amber warning with "Connect account" link when no connection exists
- Content summary (truncated preview, platform badge, media count, hashtag count)
- Schedule and Cancel buttons with loading states
- Exported from `components/content/index.ts` alongside `PublishOptions` type

### Task 2: Content page modal integration
Updated `app/dashboard/content/page.tsx` to replace the hardcoded "1 hour from now" scheduling with the new modal:
- Added `publishModalOpen` state
- Replaced `handleSchedule` (immediate POST) with `handleScheduleClick` (opens modal) and `handlePublishConfirm` (called on confirm)
- Rendered `PublishConfirmModal` at bottom of page JSX
- Users now see a date/time picker and platform account status before scheduling

### Task 3: DraftCard edit and schedule actions
Updated `app/dashboard/content/drafts/page.tsx` with major DraftCard enhancements:
- **Edit mode**: Click edit icon to expand card into a textarea + platform selector with Save/Cancel buttons. Saves via `PATCH /api/content-drafts/{id}` with optimistic local state update.
- **Schedule action**: Click calendar icon to open `PublishConfirmModal`. On confirm, creates a scheduled post via `/api/scheduler/posts`, then updates the draft status to 'scheduled' and links it via `scheduledPostId`.
- **Action buttons redesign**: Changed from text buttons (Copy | Delete) to icon-only buttons (Edit | Schedule | Copy | Delete) with title tooltips. Schedule button only appears for drafts with status 'draft'.
- Added `handleUpdate`, `handleScheduleDraft`, and `handlePublishConfirm` handlers to the page component.

### Task 4: API update for scheduledPostId
Updated `app/api/content-drafts/[id]/route.ts`:
- Added `scheduledPostId: z.string().optional()` to the Zod validation schema
- The existing spread pattern (`...rest`) already passes it through to Prisma, so no additional Prisma update logic was needed

---

## Files changed

| File | Action | Description |
|------|--------|-------------|
| `components/content/publish-confirm-modal.tsx` | NEW | Scheduling confirmation modal with date picker + platform check |
| `components/content/index.ts` | UPDATED | Export PublishConfirmModal and PublishOptions type |
| `app/dashboard/content/page.tsx` | UPDATED | Use modal for scheduling instead of hardcoded time |
| `app/dashboard/content/drafts/page.tsx` | UPDATED | Add edit-in-place, schedule action, icon-only buttons to DraftCard |
| `app/api/content-drafts/[id]/route.ts` | UPDATED | Accept scheduledPostId in PATCH validation schema |

---

## Verification

- `npm run type-check` -- PASS (zero errors)
- `npx eslint` on all changed files -- PASS (zero errors)
- Lint on full codebase -- OOM (known pre-existing issue, not related to this change)

---

## Success criteria status

- [x] `PublishConfirmModal` shows date/time picker, platform account selector
- [x] Content page uses modal instead of hardcoded 1-hour schedule
- [x] Platform account check warns if no connected account for target platform
- [x] Drafts page has inline edit capability (textarea + save)
- [x] Drafts page has "Schedule" button that opens PublishConfirmModal
- [x] Draft status updates to 'scheduled' when scheduled
- [x] Draft `scheduledPostId` links to the created scheduled post
- [x] `PATCH /api/content-drafts/[id]` accepts `scheduledPostId`
- [x] `npm run type-check` passes
