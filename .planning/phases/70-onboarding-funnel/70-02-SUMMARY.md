# 70-02 Summary: ProductTour v2.0 Extension + Onboarding Tour CTA

**Issue**: SYN-53
**Date**: 2026-03-10
**Status**: Complete

## Tasks Completed

### Task 1: Extend ProductTour with v2.0 steps

**File**: `components/ProductTour.tsx`

Changes:
- Added optional `showIf?: () => boolean` field to the `TourStep` interface
- Inserted 3 new steps before the 'complete' step:
  - `workflows` — AI Workflow Engine (target: `/dashboard/workflows`)
  - `insights` — Performance Insights (target: `/dashboard/insights`)
  - `upgrade` — Unlock the Full Platform (target: `/dashboard/billing`, conditional on `userPlan === 'starter'` or no plan set)
- Added `activeSteps` filtering: `tourSteps.filter(s => !s.showIf || s.showIf())`
- Updated all step count references (`nextStep`, progress dots, "Get Started" button check) to use `activeSteps` instead of `tourSteps`
- Total steps: 14 for starter/free users, 13 for pro/business users (upgrade step hidden)

### Task 2: Onboarding complete page — explicit tour CTA

**Files**: `app/(onboarding)/onboarding/complete/page.tsx`, `app/api/onboarding/route.ts`

Changes:
- Renamed "Take a Quick Tour" button to "Start Tour" (primary, gradient)
- Changed "Skip to Dashboard" button to "Skip tour" (ghost variant) — buttons now side by side
- Added "What's next" section above the action buttons listing 3 next-step actions
- After successful API save, parses response JSON and stores `plan` in `localStorage('userPlan')` so the ProductTour upgrade step can conditionally display
- API route (`/api/onboarding`): fetches user's subscription plan via `prisma.subscription.findFirst`, returns `plan` field in response JSON alongside `success`, `organization`, `persona`

## Commits

1. `feat(70-02): extend ProductTour with workflows, insights, upgrade steps (SYN-53)`
2. `feat(70-02): add explicit tour CTA and userPlan to onboarding complete (SYN-53)`

## Verification

- `npm run type-check` passes (0 errors)
- ProductTour has 3 new steps in `tourSteps` array (total 14 entries)
- Onboarding complete page shows "Start Tour" + "Skip tour" buttons in success state
- API returns `plan` field for localStorage persistence
