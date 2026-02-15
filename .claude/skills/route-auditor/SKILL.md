---
name: route-auditor
description: >-
  API Route Compliance Scanner for SYNTHEX. Audits any API route file against
  the standard security and architecture pattern. Catches auth drift, unsafe
  casts, missing validation, exposed error messages, and org-scoping gaps.
  Use when creating, modifying, or reviewing any file under app/api/.
metadata:
  author: synthex
  version: "1.0"
  engine: synthex-ai-agency
  type: enforcement-skill
  triggers:
    - audit route
    - check api route
    - route compliance
    - api review
    - route audit
---

# Route Auditor — API Route Compliance Scanner

## Purpose

Scans any API route file and reports violations against the SYNTHEX standard
pattern. This skill catches the exact drift that causes technical debt: routes
using raw `jwt.verify() as any` instead of centralised auth, missing org
scoping, exposed error messages, duplicate utility functions, and more.

A senior engineer would never approve a route with `as any` casts on JWT
verification or a locally-defined `getJWTSecret()` when a centralised utility
exists. This skill encodes that judgement as automated checks.

## When to Use

Activate this skill when:
- Creating a new API route under `app/api/`
- Modifying an existing API route
- Reviewing a PR that touches API routes
- Running a bulk compliance audit across all routes
- Onboarding to understand the expected route pattern

## When NOT to Use

- For frontend component reviews (use `code-review` or `design`)
- For database schema changes (use `database-prisma`)
- For security surface beyond routes (use `security-hardener`)
- For general architecture patterns (use `architecture-enforcer`)

## Tech Stack Context

- **Framework**: Next.js 15 App Router (`app/api/` route handlers)
- **Auth**: JWT in httpOnly `auth-token` cookie via `lib/auth/jwt-utils.ts`
- **Security**: `lib/security/api-security-checker.ts` (comprehensive checker)
- **Org Scoping**: `lib/multi-business/business-scope.ts`
- **ORM**: Prisma via `lib/prisma.ts`
- **Validation**: Zod schemas
- **Logging**: `lib/logger.ts` (structured logging)

## Compliance Checks (Ordered by Severity)

### CRITICAL (Blockers — must fix before merge)

#### C1: Auth Pattern
**Rule:** Must use `APISecurityChecker.check()` OR `getUserIdFromRequestOrCookies()` from `@/lib/auth/jwt-utils`.
**Anti-pattern:** Raw `jwt.verify()` calls, custom `getUserFromRequest()` functions.
**Check:**
```bash
grep -n "jwt\.verify" <file>
grep -n "getUserFromRequest\|getTokenFromRequest" <file>
```
**Fix:** Replace with:
```typescript
import { getUserIdFromRequestOrCookies, unauthorizedResponse } from '@/lib/auth/jwt-utils';

const userId = await getUserIdFromRequestOrCookies(request);
if (!userId) return unauthorizedResponse();
```

#### C2: No `as any` Casts on Auth
**Rule:** Never cast JWT verification results with `as any`.
**Anti-pattern:** `jwt.verify(token, secret) as any`
**Check:**
```bash
grep -n "as any" <file> | grep -i "jwt\|verify\|token\|auth"
```
**Fix:** Use typed `verifyTokenSafe()` from `@/lib/auth/jwt-utils`.

#### C3: No Duplicate Utilities
**Rule:** `getJWTSecret()` must only exist in `lib/auth/jwt-utils.ts`.
**Anti-pattern:** Local `function getJWTSecret()` defined in the route file.
**Check:**
```bash
grep -n "function getJWTSecret\|const getJWTSecret" <file>
```
**Fix:** Remove local definition, import from `@/lib/auth/jwt-utils`.

### HIGH (Warnings — should fix)

#### H1: Input Validation
**Rule:** All POST/PUT/DELETE request bodies must be validated with Zod.
**Anti-pattern:** `const body = await request.json()` without validation.
**Check:** Look for `request.json()` without a subsequent Zod `.parse()` or `.safeParse()`.
**Fix:** Define a Zod schema and validate:
```typescript
const schema = z.object({ name: z.string().min(1) });
const body = schema.parse(await request.json());
```

#### H2: Error Sanitisation
**Rule:** Never return raw `error.message` or stack traces to the client.
**Anti-pattern:** `return NextResponse.json({ error: error.message }, { status: 500 })`
**Check:**
```bash
grep -n "error\.message\|error\.stack" <file>
```
**Fix:** Return generic messages:
```typescript
return NextResponse.json(
  { error: 'An internal error occurred' },
  { status: 500 }
);
```

#### H3: Organisation Scoping
**Rule:** Routes querying user data must scope by `userId` or use `getEffectiveQueryFilter()`.
**Anti-pattern:** Prisma queries without `where: { userId }` or `where: { organizationId }`.
**Check:** Look for `prisma.<model>.findMany()` without userId/orgId in the where clause.
**Fix:** Use `getEffectiveQueryFilter(userId)` from `@/lib/multi-business/business-scope`.

#### H4: Handler Parameter Types
**Rule:** Use `NextRequest` from `next/server`, not the generic `Request` type.
**Anti-pattern:** `export async function GET(request: Request)`
**Check:**
```bash
grep -n "request: Request[^a-zA-Z]" <file>
```
**Fix:** `import { NextRequest } from 'next/server'` and use `NextRequest`.

### MEDIUM (Suggestions — nice to have)

#### M1: Audit Logging
**Rule:** Write operations (POST/PUT/DELETE) should create audit log entries.
**Check:** Look for POST/PUT/DELETE handlers without `auditLog` or `logger.info`.

#### M2: Logger Usage
**Rule:** Use `logger` from `@/lib/logger` instead of `console.log`/`console.error`.
**Check:**
```bash
grep -n "console\.\(log\|error\|warn\)" <file>
```

#### M3: Runtime Export
**Rule:** Routes using Prisma should export `const runtime = 'nodejs'`.
**Check:** If file imports from `@/lib/prisma`, verify `export const runtime = 'nodejs'` exists.

#### M4: Credentials on Fetch
**Rule:** Client-side fetch calls include `credentials: 'include'`.
**Check:** Look for `fetch(` without `credentials: 'include'` in the options.

## Input Specification

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| target | string | yes | File path or directory (e.g., `app/api/campaigns/route.ts` or `app/api/`) |
| scope | string | no | `critical`, `high`, `medium`, `full` (default: `full`) |
| fix | boolean | no | If true, apply auto-fixes where possible (default: false) |

## Output Specification

| Field | Type | Description |
|-------|------|-------------|
| file | string | File path audited |
| check | string | Check ID (C1, C2, C3, H1, etc.) |
| severity | critical/high/medium | Issue severity |
| status | pass/fail | Whether the check passed |
| line | number | Line number of violation (if applicable) |
| description | string | What was found |
| suggestion | string | How to fix it |

### Output Format

```
## Route Audit Report: app/api/campaigns/route.ts

### CRITICAL
- [PASS] C1: Auth pattern — Uses `getUserIdFromRequestOrCookies`
- [PASS] C2: No `as any` casts
- [PASS] C3: No duplicate utilities

### HIGH
- [FAIL] H1: Input validation — POST handler missing Zod validation (line 45)
  Fix: Add Zod schema for request body
- [PASS] H2: Error sanitisation
- [PASS] H3: Organisation scoping
- [PASS] H4: Handler types — Uses `NextRequest`

### MEDIUM
- [WARN] M1: Audit logging — POST handler has no audit log entry
- [PASS] M2: Logger usage
- [PASS] M3: Runtime export

### Summary: 9/10 passed | 1 failure (HIGH) | 1 warning (MEDIUM)
```

## Instructions

1. **Identify target** — Accept file path or directory from user input
2. **For each route file**, run all checks in order (Critical first)
3. **Report findings** grouped by severity with line numbers
4. **Suggest fixes** with code snippets referencing existing utilities
5. **If `fix` mode**, apply automated fixes for C1, C2, C3, H4, M2 (safe to auto-fix)
6. **Summarise** with pass/fail counts per severity level

## Error Handling

| Error | Action |
|-------|--------|
| File not found | Report clear error with suggested path |
| Not an API route | Skip with info message |
| Binary file | Skip silently |
| Permission error | Report and continue with next file |

## Reference Files

- `lib/auth/jwt-utils.ts` — Canonical auth pattern
- `lib/security/api-security-checker.ts` — Full security checker
- `lib/multi-business/business-scope.ts` — Org scoping utilities
- `lib/logger.ts` — Structured logging
- `app/api/campaigns/route.ts` — Reference implementation (recently fixed)

## Integration Points

- Works with **security-hardener** for full security posture
- Works with **architecture-enforcer** for cross-codebase pattern checks
- Called by **senior-reviewer** agent during comprehensive reviews
- Triggered by **post-route-create** hook after route file changes

## Commands

```bash
# Quick scan for critical issues only
grep -rn "jwt\.verify\|as any\|getJWTSecret" app/api/ --include="*.ts" | grep -v "lib/auth"

# Full compliance check
grep -rn "console\.\(log\|error\|warn\)" app/api/ --include="*.ts"
grep -rn "error\.message" app/api/ --include="*.ts"
grep -rn "request: Request[^a-zA-Z]" app/api/ --include="*.ts"
```
