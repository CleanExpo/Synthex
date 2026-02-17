---
phase: 02-mock-data-api
plan: 02
subsystem: api
tags: [content-generation, personas, ai, mock-removal, prisma]

requires:
  - phase: 02-mock-data-api
    provides: Empty-state pattern established (02-01)

provides:
  - Content generate endpoint fetches real persona from database
  - AI content generation fails with clear errors, never returns fake content
  - Mock AI generators (generateMockAIContent, generateFromTemplate) removed

affects: [02-05, 03-01, 05-01]

tech-stack:
  added: []
  patterns: [error-not-fake-content, persona-from-db]

key-files:
  created: []
  modified:
    - app/api/content/generate/route.ts
    - lib/services/content-generator.ts
    - lib/ai/content-generator.ts
    - lib/ai-persona-learning.ts

key-decisions:
  - "AI unavailable returns error, never silently substitutes fake content"
  - "lib/ai-persona-learning.ts is client-side — marked with TODO for future API migration"
  - "generateVariations() returns empty array when AI unavailable (not fake variations)"

patterns-established:
  - "AI failure pattern: throw error with clear message, never fallback to templates"
  - "Client-side files out of scope for API route cleanup — marked with TODO"

issues-created: []

duration: ~6 min
completed: 2026-02-16
---

# Phase 2 Plan 02: Fix Content Generation Mock Persona Summary

**Replaced hardcoded "Professional Voice" persona with real Prisma query, removed generateMockAIContent() and generateFromTemplate() fake content generators from both content services.**

## Performance
- Task 1: ~3 min
- Task 2: ~3 min
- Total: ~6 min
- Tasks: 2/2 completed
- Files modified: 4

## Accomplishments
- Content generate endpoint now queries real persona from database via Prisma
- Removed generateMockAIContent() with its hardcoded template array from content-generator service
- Removed generateFromTemplate() with platform-specific template arrays from AI content-generator
- AI failures now throw clear errors instead of silently substituting fake content
- Dead code cleanup: removed unused string manipulation helpers (convertToQuestion, varyEmojis, reorderContent)

## Task Commits

1. **Task 1: Replace hardcoded persona with database query** - `edbc552` (fix)
   - Replaced "Professional Voice" hardcoded object with prisma.persona.findUnique()
   - Added 404 response when persona not found
   - Marked lib/ai-persona-learning.ts with TODO (client-side file)
2. **Task 2: Replace mock AI content fallbacks with proper error responses** - `791fe6a` (fix)
   - Removed generateMockAIContent() entirely
   - Removed generateFromTemplate() entirely
   - AI unavailable now throws with clear error message
   - Removed dead code helpers

## Files Created/Modified
- `app/api/content/generate/route.ts` - Real Prisma persona query, 404 handling
- `lib/services/content-generator.ts` - Removed mock generators, AI failures throw errors
- `lib/ai/content-generator.ts` - Removed template fallbacks, AI failures throw errors
- `lib/ai-persona-learning.ts` - Added TODO for client-side migration

## Decisions Made
- **lib/ai-persona-learning.ts is client-side** — imported by components/AIPersonaManager.tsx, not API routes. Preserved existing functionality, added TODO for future migration to database-backed API calls.
- **AI unavailable = error, not fake content** — when API key is missing or AI call fails, throw an error with clear message. Never silently substitute templates.
- **generateVariations() returns empty array** — when AI is unavailable for variations, returns [] instead of faking variations with string manipulation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Dead Code] Removed unused string manipulation helpers**
- **Found during:** Task 2 (mock fallback removal)
- **Issue:** convertToQuestion(), varyEmojis(), reorderContent() became unused after generateVariations() was rewritten
- **Fix:** Removed all three private methods
- **Files modified:** lib/services/content-generator.ts
- **Committed in:** 791fe6a (part of Task 2 commit)

**2. [Rule 1 - Bug] Cleaned up mock content check**
- **Found during:** Task 2
- **Issue:** applyPersonaVoice() had `!aiRewrite.includes('mock')` check that was obsolete
- **Fix:** Removed the check since generateWithAI() no longer returns mock content
- **Files modified:** lib/services/content-generator.ts
- **Committed in:** 791fe6a (part of Task 2 commit)

---

**Total deviations:** 2 auto-fixed (dead code, obsolete check), 0 deferred
**Impact on plan:** Both auto-fixes necessary cleanup after mock removal. No scope creep.

## Issues Encountered
None.

## Next Step
Ready for 02-03-PLAN.md (Fix content library and trending endpoints)

---
*Phase: 02-mock-data-api*
*Completed: 2026-02-16*
*Commits: edbc552, 791fe6a*
