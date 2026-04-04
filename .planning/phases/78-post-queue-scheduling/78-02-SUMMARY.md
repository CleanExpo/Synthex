# Summary: 78-02 Time-Slot Picker & Smart Scheduling

**Linear:** SYN-44
**Status:** Complete
**Date:** 10/03/2026

---

## What Was Built

A reusable TimeSlotPicker component with ML-predicted optimal posting times and conflict detection, integrated across all three scheduling surfaces in the application.

## Tasks Completed (6/6)

### Task 1: useOptimalTimes hook
- **File:** `hooks/use-optimal-times.ts` (NEW)
- SWR wrapper around `/api/optimize/auto-schedule` (multi-platform action)
- Returns flat `OptimalTimeSlot[]` with day, hour, score, confidence, platform
- `bestNextSlot(platform, afterDate)` finds the highest-scoring ML slot after a given date, mapping day names to concrete Dates in the next 7 days
- Falls back to industry defaults from `schedule-config.ts` when ML predictions unavailable
- Cached via SWR with `revalidateOnFocus: false` and 5-minute dedup interval

### Task 2: useScheduleConflicts hook
- **File:** `hooks/use-schedule-conflicts.ts` (NEW)
- Fetches scheduled posts from `/api/scheduler/posts` for a date range via SWR
- `checkConflict(platform, proposedTime, bufferMinutes)` detects same-platform overlaps within configurable buffer (default 30 minutes)
- Returns the conflicting post details or null

### Task 3: TimeSlotPicker component
- **Files:** `components/scheduling/time-slot-picker.tsx` (NEW), `components/scheduling/index.ts` (NEW)
- 7-day horizontal date strip with week navigation (ChevronLeft/Right)
- 24-hour grid (4x6) with ML score-based colouring: green (80+), amber (50-79), neutral (<50)
- Red pulsing conflict dots on hours with existing same-platform posts
- "Suggest Best Time" button: auto-picks next conflict-free optimal slot
- Minute sub-selector (0/15/30/45) after hour selection
- Compact mode for popover use (no outer card chrome or legend)
- Conflict warning banner when selected time overlaps an existing post
- Dark glassmorphic theme consistent with the codebase

### Task 4: PublishConfirmModal integration
- **File:** `components/content/publish-confirm-modal.tsx` (UPDATED)
- Replaced `<input type="datetime-local" />` with `<TimeSlotPicker />`
- Changed state from datetime-local string to `Date | null`
- Widened modal from `max-w-md`/`max-w-lg` to `max-w-xl`/`max-w-2xl` to accommodate the grid
- Multi-platform mode passes all selected platforms for cross-platform conflict checks

### Task 5: Calendar schedule modal integration
- **File:** `app/dashboard/calendar/page.tsx` (UPDATED)
- Replaced date `<Input>` + hour `<Select>` combo with `<TimeSlotPicker compact />`
- Removed `scheduleHour` state -- full datetime now managed by picker
- Removed unused `Input` import
- Widened modal from `max-w-lg` to `max-w-xl`

### Task 6: Queue reschedule popover integration
- **File:** `components/queue/queue-bulk-actions.tsx` (UPDATED)
- Replaced date + time inputs in "Exact Time" tab with `<TimeSlotPicker compact />`
- "Shift by Hours" offset tab kept as separate alternative
- Updated state from `exactDate`/`exactTime` strings to `pickerDate: Date | null`
- Widened popover from `max-w-md` to `max-w-xl`

## Verification

- `npm run type-check` -- PASS (zero errors)

## Files Changed

| File | Status |
|------|--------|
| `hooks/use-optimal-times.ts` | NEW |
| `hooks/use-schedule-conflicts.ts` | NEW |
| `components/scheduling/time-slot-picker.tsx` | NEW |
| `components/scheduling/index.ts` | NEW |
| `components/content/publish-confirm-modal.tsx` | UPDATED |
| `app/dashboard/calendar/page.tsx` | UPDATED |
| `components/queue/queue-bulk-actions.tsx` | UPDATED |
