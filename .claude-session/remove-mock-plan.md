# Mock Removal & Real Implementation Plan
**Session:** 2025-08-11
**Strategy:** Resource-safe, incremental changes

## 🎯 Priority Targets Found

### 1. Mock Authentication (CRITICAL)
- **File:** `src/services/auth.ts`
- **Issue:** Line 9 - `useMockAuth` fallback
- **Fix:** Remove mock fallback, enforce real DB only

### 2. Unused Mock Service
- **File:** `src/services/mock-auth.ts`
- **Action:** Delete entire file (not imported anywhere)

### 3. Dashboard Services
- **File:** `src/services/dashboard-service.ts`
- **Check:** May contain hardcoded data

### 4. Page Placeholders to Build Out
- `app/dashboard/content/page.tsx` - Content generator
- `app/dashboard/analytics/page.tsx` - Analytics dashboard
- `app/dashboard/settings/page.tsx` - User settings
- `app/onboarding/page.tsx` - User onboarding
- `app/support/page.tsx` - Support page
- `app/blog/page.tsx` - Blog listing

### 5. API Routes to Connect
- `app/api/auth/login/route.ts`
- `app/api/auth/dev-login/route.ts`

## 🔧 Implementation Order (Resource-Safe)
1. Remove mock auth fallback
2. Delete unused mock files
3. Connect API routes to real DB
4. Build out placeholder pages one by one
5. Test each change incrementally

## ⚠️ Resource Safety Protocol
- ONE file at a time
- 500ms pause between operations
- Test after each change
- No parallel processing
- Monitor CPU constantly