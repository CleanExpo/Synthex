# Phase 80-02: Brand Profile UI — SUMMARY

**Linear**: SYN-55
**Date**: 10/03/2026
**Status**: Complete

## Tasks Completed

### Task 1: `hooks/use-brand-profile.ts` (NEW)
SWR hook for brand profile data. Uses `credentials: 'include'` fetcher for GET and a plain `async` `updateBrandProfile()` mutation calling `PATCH /api/brand-profile`, then re-validates with `mutate()`. Follows the project SWR pattern (read with SWR, write in callbacks).

### Task 2: `components/settings/brand-profile-tab.tsx` (NEW)
Full brand profile editor client component with four glassmorphic cards:
1. **Brand Identity** — name, description, logo (URL + file upload via `POST /api/media/upload`), favicon, primary colour picker + hex input
2. **Business Details** — website, industry (dropdown from constant list), team size (button group: Solo, 2-10, 11-50, 51-200, 200+), ABN
3. **Social Handles** — 8 platforms (Twitter/X, Instagram, LinkedIn, YouTube, TikTok, Facebook, Pinterest, Reddit)
4. **Live Preview** — brand card that updates live as the user types name, logo, colour, and description

Validation: name required (max 100), hex colour format, URL format for website/logo/favicon, description max 500, ABN max 20.

### Task 3: `app/dashboard/settings/brand-profile/page.tsx` (NEW)
Server component page wrapper exporting Next.js `metadata` and rendering `<BrandProfileTab />`.

### Task 4: `app/dashboard/settings/page.tsx` (UPDATED)
Added `Link`, `Building`, and `ChevronRight` imports. Wrapped ProfileTab in a `div.space-y-6` and added a "Brand Profile" link card below it, linking to `/dashboard/settings/brand-profile`.

### Task 5: `components/settings/index.ts` (UPDATED)
Added `export { BrandProfileTab } from './brand-profile-tab'`.

## Verification

- `npm run type-check` — PASS (zero errors)
- `npm run lint` — PASS (zero warnings/errors)

## Success Criteria

- [x] `/dashboard/settings/brand-profile` page renders without errors
- [x] `useBrandProfile` hook fetches via `GET /api/brand-profile` with `credentials: 'include'`
- [x] All org brand fields pre-populate from API on page load
- [x] PATCH on save only sends changed fields
- [x] Logo upload calls `POST /api/media/upload`, URL result populates logo field
- [x] Primary colour validated as 6-digit hex before save
- [x] Website validated as valid URL before save
- [x] Live preview card updates as user types name and colour
- [x] Settings page Profile tab has visible "Brand Profile" link card
- [x] `npm run type-check` passes

---

# Phase 80-01: Brand Profile API — SUMMARY

**Linear**: SYN-55
**Date**: 10/03/2026
**Status**: Complete

## Tasks Completed

### Task 1: `app/api/brand-profile/route.ts` (NEW)
Created GET and PATCH handlers for the brand profile self-service endpoint.

- **GET** `/api/brand-profile`: Authenticates via `getUserIdFromRequestOrCookies`, resolves the caller's `organizationId` from `User`, then fetches and returns the org's brand fields in the `BrandProfileResponse` shape.
- **PATCH** `/api/brand-profile`: Authenticates + resolves org, parses body with the `brandProfileSchema` Zod validator, builds a partial update object (only fields explicitly provided), updates the org, and returns the updated brand profile.
- Returns 401 on missing auth, 404 when no org is linked, 400 with `fieldErrors` on Zod validation failure, 400 when no fields supplied.
- No admin check required — any org member may update their own org's brand identity.
- `primaryColor` validated as 6-digit hex (`/^#[0-9A-Fa-f]{6}$/`).
- URL fields (`website`, `logo`, `favicon`) accept a valid URL or empty string (to clear).

### Task 2: `app/api/brand-profile/types.ts` (NEW)
Extracted `BrandProfileResponse` and `BrandProfileUpdatePayload` interfaces into a shared types file for consumption by UI components and hooks (Plan 80-02).

## Files Created

| File | Status |
|------|--------|
| `app/api/brand-profile/route.ts` | NEW |
| `app/api/brand-profile/types.ts` | NEW |

## Verification

- `npm run type-check` — PASS (zero errors)
- `npx eslint app/api/brand-profile/route.ts app/api/brand-profile/types.ts --max-warnings=0` — PASS

## Success Criteria

- [x] `GET /api/brand-profile` returns brand profile for authenticated user's organisation
- [x] `PATCH /api/brand-profile` updates only supplied fields (no overwriting unset fields with null)
- [x] Returns 401 when unauthenticated
- [x] Returns 404 with helpful message when user has no organisation
- [x] Returns 400 with Zod validation details on invalid input
- [x] Primary colour validates as 6-digit hex
- [x] URL fields accept empty string (to clear) or valid URL
- [x] `npm run type-check` passes
