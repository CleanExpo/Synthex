# Summary 77-01: Media Upload & Attachment Pipeline

**Linear**: SYN-45
**Status**: COMPLETE
**Date**: 10/03/2026

---

## What Was Done

### Task 1: Supabase Storage Helper
- **File**: `lib/storage/supabase-storage.ts` (NEW)
- Created `validateFile()` -- validates MIME type and size (10 MB images, 100 MB video)
- Created `uploadToStorage()` -- uploads to `post-media` bucket via service-role client, returns public URL
- Created `deleteFromStorage()` -- removes file by storage path
- Lazy singleton pattern for the Supabase service-role client

### Task 2: Upload API Route
- **File**: `app/api/media/upload/route.ts` (NEW)
- `POST /api/media/upload` accepts `multipart/form-data` with a `file` field
- Auth via `getUserIdFromRequestOrCookies()` (JWT)
- Validates file type/size, uploads to Supabase Storage, returns `{ data: { url, path, size, mimeType } }` with 201

### Task 3: MediaAttacher Component
- **File**: `components/content/media-attacher.tsx` (NEW)
- Drag-and-drop zone with dashed border, click-to-select hidden file input
- Upload progress: per-file spinner overlay on thumbnail
- Preview grid: 4-column thumbnails with hover remove (X) button
- File count indicator: "N/4 files attached"
- Error toast on upload failure via `sonner`
- **File**: `components/content/index.ts` (UPDATED) -- added `MediaAttacher` export

### Task 4a: Content Page Integration
- **File**: `app/dashboard/content/page.tsx` (UPDATED)
- Added `mediaUrls` state and `MediaAttacher` component above the generation grid
- `handleSave` now includes `images: mediaUrls` in the draft payload
- `handleSchedule` now includes `images: mediaUrls` in `metadata` for the scheduler API

### Task 4b: Publish Cron Fix
- **File**: `app/api/cron/publish-scheduled/route.ts` (UPDATED)
- Extracts `metadata.images` from the scheduled post record
- Passes as `mediaUrls` to `service.createPost()` so platform services receive attached media
- Also populates `mediaUrls` on the `PlatformPost` record for metrics tracking

---

## Verification

- `npm run type-check` -- PASS (zero errors)
- All new files follow existing codebase patterns (JWT auth, Supabase client, glassmorphic UI)
- No new npm packages required
- No schema changes required (`Post.metadata` JSON field already supports arbitrary keys)
- No env changes required (`NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` already exist)

---

## Commits

| Commit | Description |
|--------|-------------|
| `96c046e8` | feat(77-01): add Supabase Storage upload/delete helper (SYN-45) |
| `83d98af3` | feat(77-01): add multipart file upload API route (SYN-45) |
| `0a5f0530` | feat(77-01): add MediaAttacher drag-and-drop component (SYN-45) |
| `79871835` | feat(77-01): wire MediaAttacher into content page (SYN-45) |
| `2786d1c6` | feat(77-01): pass media URLs from post metadata to createPost (SYN-45) |

---

## Files Changed

| File | Status |
|------|--------|
| `lib/storage/supabase-storage.ts` | NEW |
| `app/api/media/upload/route.ts` | NEW |
| `components/content/media-attacher.tsx` | NEW |
| `components/content/index.ts` | UPDATED |
| `app/dashboard/content/page.tsx` | UPDATED |
| `app/api/cron/publish-scheduled/route.ts` | UPDATED |
