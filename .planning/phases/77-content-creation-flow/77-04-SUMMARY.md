# Summary 77-04: Multi-Platform Publish & Post Status Tracking

## Linear Issue
SYN-45

## Status
COMPLETE -- all 6 tasks implemented, type-check and lint pass.

## What Was Done

### Task 1: Multi-platform selection in GenerationSettings
- Added toggle switch "Post to multiple platforms" above platform grid
- When enabled, platform buttons become checkboxes (multi-select)
- First selected platform is marked as primary ("1st" badge)
- Minimum 1 platform enforced
- New props: `selectedPlatforms`, `onSelectedPlatformsChange`, `multiPlatformEnabled`, `onMultiPlatformToggle`

### Task 2: Content adaptation for secondary platforms
- After generating primary content, automatically calls `/api/content/cross-post` in preview mode
- Adapts content for each secondary platform using AI repurposer
- Shows per-platform previews in a grid layout when multi-platform mode is active
- Adapted content stored in `platformAdaptations` state

### Task 3: Multi-platform scheduling via PublishConfirmModal
- Upgraded modal to show per-platform connection status with green/amber dots
- Shows adapted content preview per platform
- "Schedule N Posts" button creates one Post per platform with shared `metadata.batchId`
- Individual success/failure shown per platform in the modal after scheduling
- Fully backward-compatible with single-platform mode

### Task 4: PostStatusTracker component
- New `components/content/post-status-tracker.tsx`
- Fetches posts by batchId via SWR with 30-second auto-refresh
- Row per platform with status badge (scheduled=blue, published=green, failed=red, draft=amber)
- Progress bar showing "N/N platforms published"
- Links to published posts, scheduled time display
- Dismiss button to clear tracker

### Task 5: batchId filter in scheduler API
- Added `batchId` to `listPostsQuerySchema` (optional string)
- Added `batchId` to `createPostSchema` metadata
- GET handler filters by `metadata.batchId` using Prisma JSON path filtering for PostgreSQL

### Task 6: PostStatusTracker wired into content page
- `PostStatusTracker` rendered below the composer when `lastBatchId` is set
- `lastBatchId` populated after successful multi-platform scheduling
- Dismiss button clears the tracker

## Files Changed

| File | Change |
|------|--------|
| `components/content/generation-settings.tsx` | UPDATED: multi-platform toggle + checkbox mode |
| `components/content/publish-confirm-modal.tsx` | UPDATED: multi-platform scheduling support |
| `components/content/post-status-tracker.tsx` | NEW: per-platform status tracking component |
| `components/content/index.ts` | UPDATED: export PostStatusTracker + PlatformScheduleResult |
| `app/dashboard/content/page.tsx` | UPDATED: multi-platform state, adaptation, scheduling, tracker |
| `app/api/scheduler/posts/route.ts` | UPDATED: batchId query filter + metadata schema |

## Verification

- `npm run type-check` -- PASS
- `npm run lint` -- PASS

## Commits

1. `1e2d3e19` -- feat(content): add multi-platform selection to GenerationSettings (SYN-45)
2. `ac5f8d67` -- feat(content): add cross-post adaptation for multi-platform content (SYN-45)
3. `312ea1e8` -- feat(content): upgrade PublishConfirmModal for multi-platform scheduling (SYN-45)
4. `ed925508` -- feat(content): add PostStatusTracker component for batch post monitoring (SYN-45)
5. `dd02d160` -- feat(api): add batchId filter to scheduler posts API (SYN-45)
6. `5f303a7a` -- feat(content): wire PostStatusTracker into content page after scheduling (SYN-45)
