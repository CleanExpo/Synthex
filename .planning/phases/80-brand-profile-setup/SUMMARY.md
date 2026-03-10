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
