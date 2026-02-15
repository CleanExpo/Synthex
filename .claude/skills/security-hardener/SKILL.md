---
name: security-hardener
description: >-
  Security Posture Enforcer for SYNTHEX. Proactive security scan covering the
  full attack surface beyond individual routes: build config, secret exposure,
  CSP headers, rate limiting, cookie security, dependency vulnerabilities, and
  type safety. Use before deployment or on demand for security audits.
metadata:
  author: synthex
  version: "1.0"
  engine: synthex-ai-agency
  type: enforcement-skill
  triggers:
    - security scan
    - security audit
    - hardening check
    - pre-deploy security
    - vulnerability check
---

# Security Hardener — Security Posture Enforcer

## Purpose

Proactive security scan that covers the full security surface of the SYNTHEX
platform. While `route-auditor` checks individual API routes, this skill checks
the infrastructure-level security posture: build configuration, secret
management, HTTP headers, rate limiting, cookie policies, dependency health,
and type safety.

A senior engineer reviews these before every production deployment. This skill
automates that review so nothing slips through regardless of who (or what AI)
is writing the code.

## When to Use

Activate this skill when:
- Preparing for a production deployment
- After modifying `next.config.mjs`, `middleware.ts`, or security-related files
- Running a periodic security audit
- Onboarding to understand the security baseline
- After adding new dependencies
- Before a security review or compliance check

## When NOT to Use

- For individual API route compliance (use `route-auditor`)
- For architecture pattern enforcement (use `architecture-enforcer`)
- For database security (use `sql-hardener` or `database-prisma`)
- For UI/UX accessibility audits (use `ui-ux`)

## Tech Stack Context

- **Framework**: Next.js 15 with App Router
- **Auth**: JWT in httpOnly `auth-token` cookie
- **Security Layer**: `lib/security/api-security-checker.ts`
- **Rate Limiting**: `lib/security/rate-limiter-redis.ts`
- **Middleware**: `middleware.ts` (CSP, HSTS, CORS, X-Frame-Options)
- **Build**: `next.config.mjs` with strict TypeScript enforcement
- **Deploy**: Vercel serverless

## Security Checks

### CRITICAL (Deployment Blockers)

#### S1: Build Configuration Integrity
**Rule:** `ignoreBuildErrors` and `ignoreDuringBuilds` must be `false` in `next.config.mjs`.
**Why:** Setting these to `true` masks TypeScript errors that can hide security vulnerabilities, null pointer exceptions, and type confusion bugs.
**Check:**
```bash
grep -n "ignoreBuildErrors\|ignoreDuringBuilds" next.config.mjs
```
**Expected:** Both set to `false`.
**Fix:** Set both to `false` and resolve all TypeScript errors.

#### S2: Type Safety Gate
**Rule:** `npx tsc --noEmit` must pass with 0 errors.
**Why:** TypeScript errors can mask security issues. A function expecting `string` receiving `any` can lead to injection vulnerabilities.
**Check:**
```bash
npx tsc --noEmit 2>&1 | tail -1
```
**Expected:** "Found 0 errors."

#### S3: Secret Exposure Scan
**Rule:** No hardcoded secrets, no fallback values for critical environment variables.
**Anti-patterns:**
- `const secret = process.env.JWT_SECRET || 'fallback-secret'`
- `const key = 'sk_live_...'`
- API keys in source code
**Check:**
```bash
grep -rn "JWT_SECRET.*||.*['\"]" app/ lib/ --include="*.ts"
grep -rn "sk_live_\|sk_test_\|OPENROUTER_API_KEY.*=" app/ lib/ --include="*.ts" | grep -v ".env"
grep -rn "password.*=.*['\"]" app/ lib/ --include="*.ts" | grep -v "test\|spec\|mock"
```
**Fix:** Use `process.env.JWT_SECRET!` with runtime validation, never fallback values.

#### S4: No Unsafe JWT Casts
**Rule:** Zero instances of `jwt.verify(...) as any` in the codebase.
**Check:**
```bash
grep -rn "as any" app/api/ --include="*.ts" | grep -i "jwt\|verify\|token"
```
**Expected:** 0 results.

### HIGH (Should Fix Before Deploy)

#### S5: CSP Headers Completeness
**Rule:** `middleware.ts` must set Content-Security-Policy with at minimum:
- `default-src 'self'`
- `script-src` (no `unsafe-inline` in production)
- `style-src` (Tailwind needs `unsafe-inline`)
- `img-src` (allow CDN domains)
- `connect-src` (API domains)
- `frame-ancestors 'none'`
**Check:** Read `middleware.ts` and verify CSP directive completeness.

#### S6: Rate Limiting on Auth Endpoints
**Rule:** Authentication endpoints must have rate limiting configured.
**Endpoints to check:** `/api/auth/login`, `/api/auth/register`, `/api/auth/forgot-password`
**Check:** Verify these routes use `APISecurityChecker` with rate limiting or `rate-limiter-redis`.

#### S7: Cookie Security
**Rule:** The `auth-token` cookie must be set with:
- `httpOnly: true`
- `secure: true` (in production)
- `sameSite: 'strict'` or `'lax'`
- `path: '/'`
**Check:**
```bash
grep -rn "auth-token" lib/ app/ --include="*.ts" | grep -i "set\|cookie"
```

#### S8: HTTPS Enforcement
**Rule:** No HTTP-only URLs in production configuration.
**Check:**
```bash
grep -rn "http://" app/ lib/ --include="*.ts" | grep -v "localhost\|127\.0\.0\.1\|http://"
```

### MEDIUM (Security Hygiene)

#### S9: Dependency Vulnerabilities
**Rule:** No critical or high severity vulnerabilities in dependencies.
**Check:**
```bash
npm audit --audit-level=high 2>&1 | tail -5
```

#### S10: Error Response Sanitisation
**Rule:** API error responses must not leak internal details (stack traces, file paths, query details).
**Check:**
```bash
grep -rn "error\.stack\|error\.message" app/api/ --include="*.ts"
grep -rn "\.stack" app/api/ --include="*.ts"
```

#### S11: CORS Configuration
**Rule:** CORS must not use wildcard `*` for allowed origins in production.
**Check:** Review `middleware.ts` CORS headers.

#### S12: Security Headers
**Rule:** All required security headers present in middleware:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security` (HSTS)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (restrict camera, microphone, geolocation)
**Check:** Read `middleware.ts` and verify each header.

## Input Specification

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| scope | string | no | `critical`, `high`, `medium`, `full` (default: `full`) |
| fix | boolean | no | If true, run fix commands where safe (default: false) |

## Output Specification

### Output Format

```
## Security Posture Report — SYNTHEX

### CRITICAL (Deployment Blockers)
- [PASS] S1: Build config — ignoreBuildErrors: false, ignoreDuringBuilds: false
- [PASS] S2: Type safety — 0 TypeScript errors
- [PASS] S3: Secret exposure — No hardcoded secrets found
- [PASS] S4: JWT safety — 0 unsafe `as any` casts

### HIGH (Pre-Deploy Fixes)
- [PASS] S5: CSP headers — All directives present
- [WARN] S6: Rate limiting — /api/auth/forgot-password missing rate limit
- [PASS] S7: Cookie security — httpOnly, secure, sameSite configured
- [PASS] S8: HTTPS — No HTTP-only URLs

### MEDIUM (Security Hygiene)
- [PASS] S9: Dependencies — No critical/high vulnerabilities
- [WARN] S10: Error sanitisation — 3 routes expose error.message
- [PASS] S11: CORS — No wildcard origins
- [PASS] S12: Security headers — All present

### Summary: 10/12 passed | 0 blockers | 2 warnings
### Deployment: APPROVED (no critical failures)
```

## Instructions

1. **Run all critical checks first** — Any failure here blocks deployment
2. **Run high checks** — Flag for pre-deploy fixes
3. **Run medium checks** — Report for security hygiene improvement
4. **Generate deployment verdict** — APPROVED / BLOCKED with reasons
5. **List specific fixes** with file paths and code suggestions

## Error Handling

| Error | Action |
|-------|--------|
| tsc command not found | Report: "Install TypeScript globally or use npx" |
| npm audit fails | Report audit failure, continue with other checks |
| File permission error | Report and skip, continue with other checks |
| middleware.ts not found | Report CRITICAL: security middleware missing |

## Reference Files

- `next.config.mjs` — Build configuration
- `middleware.ts` — Security headers, CSP, CORS
- `lib/auth/jwt-utils.ts` — Auth and cookie configuration
- `lib/security/api-security-checker.ts` — Security checking utilities
- `lib/security/rate-limiter-redis.ts` — Rate limiting configuration

## Integration Points

- Called by **pre-deploy-security** hook before every deployment
- Complements **route-auditor** (infrastructure vs route-level)
- Called by **senior-reviewer** agent for comprehensive reviews
- Works with **sql-hardener** for database security coverage

## Commands

```bash
# Quick critical-only scan
npx tsc --noEmit && echo "Types OK" || echo "TYPE ERRORS"
grep -rn "ignoreBuildErrors.*true" next.config.mjs
grep -rn "as any" app/api/ --include="*.ts" | grep -i "jwt\|verify"

# Full security scan
npm audit --audit-level=high
grep -rn "console\.\(log\|error\)" app/api/ --include="*.ts" | wc -l
grep -rn "error\.message\|error\.stack" app/api/ --include="*.ts"
```
