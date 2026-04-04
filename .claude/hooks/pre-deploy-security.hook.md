---
name: pre-deploy-security
type: hook
trigger: Before deployment to production (vercel --prod, vercel deploy, npm run deploy)
priority: 1
blocking: true
version: 1.0.0
---

# Pre-Deploy Security Hook (BLOCKING)

**CRITICAL**: Blocks deployment if any security gate fails. This hook runs
automatically before any production deployment command and enforces the
security baseline that a senior engineer would verify manually.

## Trigger Conditions

This hook activates before execution of:
- `vercel --prod`
- `vercel deploy --prod`
- `npm run deploy`
- Any command containing `vercel` and `prod`

## Security Gates (All Must Pass)

### Gate 1: TypeScript Compilation (CRITICAL)
```bash
npx tsc --noEmit
```
**Expected:** Exit code 0 with 0 errors.
**Why:** TypeScript errors can mask security vulnerabilities. A route that compiles with errors may have broken auth checks.
**On fail:** BLOCK. List all errors. Suggest running `npx tsc --noEmit` to see details.

### Gate 2: Production Build (CRITICAL)
```bash
npm run build
```
**Expected:** Exit code 0.
**Why:** Build failures in production mean the deploy will fail or produce broken output.
**On fail:** BLOCK. Show build error output.

### Gate 3: Build Config Integrity (CRITICAL)
```bash
grep -c "ignoreBuildErrors.*true" next.config.mjs
grep -c "ignoreDuringBuilds.*true" next.config.mjs
```
**Expected:** Both return 0 (no matches).
**Why:** These flags mask errors that should block deployment. If someone enables them "temporarily" they must be reverted before deploy.
**On fail:** BLOCK. Message: "CRITICAL: ignoreBuildErrors or ignoreDuringBuilds is set to true. This masks TypeScript/ESLint errors. Set both to false and fix all errors before deploying."

### Gate 4: No Unsafe JWT Casts (CRITICAL)
```bash
grep -rn "as any" app/api/ --include="*.ts" | grep -i "jwt\|verify\|token"
```
**Expected:** 0 results.
**Why:** `as any` on JWT verification bypasses TypeScript's type checking on authentication, creating a security hole.
**On fail:** BLOCK. List all files with unsafe casts. Suggest using `verifyTokenSafe()` from `@/lib/auth/jwt-utils`.

### Gate 5: No Duplicate Auth Functions (HIGH)
```bash
grep -rn "function getJWTSecret" app/api/ --include="*.ts"
```
**Expected:** 0 results (getJWTSecret should only exist in `lib/auth/jwt-utils.ts`).
**Why:** Duplicate auth functions diverge from the centralised implementation and may have bugs or weaker security.
**On fail:** WARN (non-blocking). List all files with duplicate functions. Suggest migration to centralised auth.

### Gate 6: No Exposed Error Messages (HIGH)
```bash
grep -rn "error\.message" app/api/ --include="*.ts" | grep -i "json\|response\|return"
```
**Expected:** 0 results in response objects.
**Why:** Returning `error.message` to clients can leak internal implementation details, file paths, or stack information.
**On fail:** WARN (non-blocking). List files. Suggest generic error messages.

### Gate 7: Dependency Security (MEDIUM)
```bash
npm audit --audit-level=critical
```
**Expected:** Exit code 0 (no critical vulnerabilities).
**Why:** Critical dependency vulnerabilities are actively exploited and must be patched before deployment.
**On fail:** WARN (non-blocking for medium, BLOCK for critical). List vulnerabilities.

## Execution Flow

```
1. Run Gate 1 (tsc)           → PASS/FAIL
2. Run Gate 2 (build)         → PASS/FAIL
3. Run Gate 3 (build config)  → PASS/FAIL
4. Run Gate 4 (JWT safety)    → PASS/FAIL
5. Run Gate 5 (duplicate auth)→ PASS/WARN
6. Run Gate 6 (error exposure)→ PASS/WARN
7. Run Gate 7 (dependencies)  → PASS/WARN

If ANY gate 1-4 FAILS → BLOCK DEPLOYMENT
If gates 5-7 WARN     → Log warnings, allow deployment
```

## On Failure — BLOCK DEPLOYMENT

Generate a failure report:

```
============================================
 DEPLOYMENT BLOCKED — Security Gate Failure
============================================

Failed Gates:
  [FAIL] Gate 3: ignoreBuildErrors is set to true in next.config.mjs
  [FAIL] Gate 4: 2 files contain `as any` JWT casts

Files to fix:
  - app/api/stripe/checkout/route.ts (line 23): jwt.verify(...) as any
  - app/api/rate-limit/route.ts (line 15): jwt.verify(...) as any

Remediation:
  1. Set ignoreBuildErrors: false in next.config.mjs
  2. Replace jwt.verify() as any with getUserIdFromRequestOrCookies()
     from @/lib/auth/jwt-utils
  3. Run: npx tsc --noEmit (must pass with 0 errors)
  4. Re-run deployment

Warnings (non-blocking):
  [WARN] Gate 5: 3 routes have duplicate getJWTSecret functions
  [WARN] Gate 6: 2 routes expose error.message in responses

============================================
```

## On Success — APPROVE DEPLOYMENT

```
============================================
 DEPLOYMENT APPROVED — All Security Gates Passed
============================================

  [PASS] Gate 1: TypeScript — 0 errors
  [PASS] Gate 2: Build — successful
  [PASS] Gate 3: Build config — strict mode enabled
  [PASS] Gate 4: JWT safety — 0 unsafe casts
  [PASS] Gate 5: Auth centralisation — no duplicates
  [PASS] Gate 6: Error sanitisation — no exposed messages
  [PASS] Gate 7: Dependencies — no critical vulnerabilities

Proceeding with deployment...
============================================
```

## Integration

- Uses checks from **security-hardener** skill
- Complements the existing **pre-deploy** hook (which covers tests, Lighthouse, SEO)
- Called automatically before Vercel/production deployment commands
- Results feed into **senior-reviewer** agent reports
