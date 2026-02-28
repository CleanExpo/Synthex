# Onboarding Streamline Design

**Linear Issue**: UNI-1150
**Date**: 2026-02-28
**Status**: Implemented

## Problem

The onboarding flow had 6 steps across 8 pages with scrambled navigation:
Welcome -> Step 1 (name/URL) -> Step 5 (vetting) -> Step 6 (API keys) -> Step 2 (review) -> Step 3 (platforms) -> Step 4 (persona) -> Complete.

Each page defined its own `STEPS` array with different values, making the progress indicator unreliable. Non-essential gates (business vetting, API key setup) blocked users from reaching their dashboard.

## Solution

Reduced to 3 active steps + completion page with sequential navigation:

```
Welcome -> Step 1 (Your Business) -> Step 2 (Platforms) -> Step 3 (Persona) -> Complete
```

### Step 1: Your Business (required)
- Business Name (required)
- Website URL (optional, triggers AI analysis on blur)
- Industry (required, dropdown with 14 options)
- Team Size (required, dropdown with 5 options)
- Description (optional)

### Step 2: Connect Platforms (fully skippable)
- Uses existing `<PlatformConnector />` component
- "Skip for now" button when no platforms connected
- Can connect later in Settings

### Step 3: Brand Persona (fully skippable)
- Uses existing `<PersonaSetup />` component
- "Skip for now" button when no persona configured
- Can set up later in Settings

### Removed from onboarding
- **Business vetting/health checkup** -> Dashboard feature
- **API key setup** -> Settings > API Keys (middleware has separate `/api/ai/*` gate)
- **Brand colors** -> Settings
- **Social handles** -> Settings

## Files Changed

| File | Change |
|------|--------|
| `app/(onboarding)/onboarding/page.tsx` | Simplified welcome CTA |
| `app/(onboarding)/onboarding/step-1/page.tsx` | Combined business identity + details form |
| `app/(onboarding)/onboarding/step-2/page.tsx` | Platform connections (skippable) |
| `app/(onboarding)/onboarding/step-3/page.tsx` | Persona setup (skippable) |
| `app/(onboarding)/onboarding/step-4/page.tsx` | Redirect to complete |
| `app/(onboarding)/onboarding/step-5/page.tsx` | Redirect to step-1 |
| `app/(onboarding)/onboarding/step-6/page.tsx` | Redirect to step-1 |
| `app/(onboarding)/onboarding/complete/page.tsx` | Updated STEPS to 4-step array, completeStep(4) |
| `components/onboarding/OnboardingContext.tsx` | Updated NEXT_STEP max=4, rewrote canProceed() |

## Architecture Notes

- `OnboardingContext` reducer NEXT_STEP max changed from 5 to 4
- `canProceed()` now only requires businessName + industry + teamSize for step 1; steps 2-3 always passable
- Old step-4/5/6 pages serve as redirects for stale navigation (bookmarks, back button)
- No API route changes needed — Zod schema already accepts the minimal required fields
- Middleware onboarding gate unchanged — still checks JWT `onboardingComplete` claim
