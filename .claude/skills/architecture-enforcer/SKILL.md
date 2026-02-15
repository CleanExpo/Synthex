---
name: architecture-enforcer
description: >-
  Pattern Consistency Guard for SYNTHEX. Enforces architectural patterns across
  the entire codebase to prevent drift. Checks auth centralisation, import
  conventions, icon barrel usage, Prisma import paths, API response format,
  theme tokens, client directives, fetch credentials, and dead code. Use after
  bulk changes, during reviews, or periodically.
metadata:
  author: synthex
  version: "1.0"
  engine: synthex-ai-agency
  type: enforcement-skill
  triggers:
    - architecture check
    - pattern audit
    - consistency check
    - codebase review
    - convention check
---

# Architecture Enforcer — Pattern Consistency Guard

## Purpose

Enforces architectural patterns across the entire SYNTHEX codebase. Prevents
the pattern drift where each new coding session — human or AI — introduces
its own conventions, imports, and approaches instead of following established
patterns.

This is the difference between "vibe coding" and senior engineering:
a senior engineer knows the codebase conventions and follows them consistently.
This skill encodes those conventions as automated checks.

## When to Use

Activate this skill when:
- Reviewing a PR with changes across multiple files
- After a bulk refactoring session
- Running a periodic architecture health check
- Onboarding to understand codebase conventions
- Before a major release to ensure consistency
- After AI-assisted coding sessions to verify pattern adherence

## When NOT to Use

- For individual API route security (use `route-auditor`)
- For infrastructure security posture (use `security-hardener`)
- For database schema patterns (use `database-prisma`)
- For UI component design (use `design`)

## Tech Stack Context

- **Framework**: Next.js 15 App Router
- **Language**: TypeScript 5.7 (strict mode)
- **Styling**: Tailwind CSS with dark theme (bg-gray-950, cyan accents)
- **Icons**: Barrel export from `@/components/icons` (lucide-react re-exports)
- **ORM**: Prisma via `@/lib/prisma`
- **Auth**: Centralised in `@/lib/auth/jwt-utils`
- **Security**: `@/lib/security/api-security-checker`
- **Multi-business**: `@/lib/multi-business/business-scope`

## Pattern Checks

### P1: Auth Centralisation
**Rule:** All `app/api/` routes import auth from `@/lib/auth/jwt-utils` or use `APISecurityChecker`. No route should define its own auth functions.
**Check:**
```bash
# Find routes with local auth definitions
grep -rn "function getJWTSecret\|function getUserFromRequest\|function getTokenFromRequest\|function getUserId(" app/api/ --include="*.ts"

# Find routes importing jwt directly instead of centralised auth
grep -rn "from 'jsonwebtoken'" app/api/ --include="*.ts"
```
**Expected:** 0 results for both.
**Fix:** Replace with imports from `@/lib/auth/jwt-utils`.

### P2: No Duplicate Utilities
**Rule:** Utility functions should exist in exactly one location. Specifically:
- `getJWTSecret()` — only in `lib/auth/jwt-utils.ts`
- `verifyToken()` — only in `lib/auth/jwt-utils.ts`
- `prisma` client — only in `lib/prisma.ts`
**Check:**
```bash
grep -rn "function getJWTSecret" app/ lib/ --include="*.ts" | grep -v "lib/auth/jwt-utils"
grep -rn "new PrismaClient" app/ lib/ --include="*.ts" | grep -v "lib/prisma"
```
**Expected:** 0 results.

### P3: Icon Barrel Imports
**Rule:** All icon imports must come from `@/components/icons`, never directly from `lucide-react`.
**Why:** The barrel export ensures consistent icon naming and allows future icon library changes.
**Check:**
```bash
grep -rn "from 'lucide-react'" components/ app/ --include="*.tsx" --include="*.ts" | grep -v "components/icons"
```
**Expected:** 0 results (only `components/icons.tsx` imports from lucide-react).
**Fix:** Change `import { Icon } from 'lucide-react'` to `import { Icon } from '@/components/icons'`.

### P4: Prisma Import Path
**Rule:** Always import Prisma from `@/lib/prisma`, never from `@prisma/client` directly.
**Why:** The centralised import configures logging, connection pooling, and error handling.
**Check:**
```bash
grep -rn "from '@prisma/client'" app/ --include="*.ts" | grep -v "import.*Prisma\b\|import type"
```
**Expected:** Only type imports (`import { Prisma } from '@prisma/client'` for types is acceptable).
**Fix:** Use `import { prisma } from '@/lib/prisma'` for the client instance.

### P5: API Response Format
**Rule:** API routes return consistent JSON structure:
- Success: `{ data: ... }` or `{ ...data }` with 200/201 status
- Error: `{ error: 'message' }` with appropriate 4xx/5xx status
- Never: `{ message: ... }`, `{ result: ... }`, `{ success: true, ... }`
**Check:** Manual review — look for inconsistent response shapes in API routes.

### P6: Dark Theme Tokens
**Rule:** Use Tailwind utility classes for theming. Avoid hardcoded hex colours.
**Anti-patterns:** `bg-[#0f172a]`, `text-[#06b6d4]`, `border-[#1e293b]`
**Preferred:** `bg-gray-950`, `text-cyan-400`, `border-gray-800`, `bg-[#0f172a]/80` (opacity variants are acceptable)
**Check:**
```bash
grep -rn "bg-\[#\|text-\[#\|border-\[#" components/ app/ --include="*.tsx" | grep -v "/80\|/60\|/40\|/20\|/50"
```
**Note:** Opacity variants like `bg-[#0f172a]/80` are acceptable as Tailwind doesn't support opacity on arbitrary colours natively.

### P7: Client Directive
**Rule:** Every React component that uses hooks (`useState`, `useEffect`, `useRef`, etc.) or browser APIs must have `'use client'` as the first line.
**Check:**
```bash
# Find files using hooks without 'use client'
grep -rln "useState\|useEffect\|useRef\|useCallback\|useMemo\|useContext" components/ app/ --include="*.tsx" | xargs grep -L "'use client'"
```
**Expected:** 0 results.

### P8: Fetch Credentials
**Rule:** All client-side `fetch()` calls must include `credentials: 'include'`.
**Why:** Without this, the httpOnly `auth-token` cookie is not sent, causing auth failures.
**Check:**
```bash
grep -rn "fetch(" components/ app/ hooks/ --include="*.tsx" --include="*.ts" | grep -v "credentials.*include\|server\|api/\|node_modules"
```

### P9: Multi-Business Scoping
**Rule:** Routes that query data for the current user/organisation must use `userId` filtering or `getEffectiveQueryFilter()` from `@/lib/multi-business/business-scope`.
**Why:** Without org scoping, multi-business users could see data from wrong organisations.
**Check:** Manual review — look for Prisma queries in API routes that access user data without `userId` or `organizationId` in the `where` clause.

### P10: Dead Code Detection
**Rule:** No unused imports, no unused variables, no large commented-out code blocks (>5 lines).
**Check:**
```bash
# Commented-out code blocks (crude but effective)
grep -rn "^[[:space:]]*//" app/ components/ lib/ --include="*.ts" --include="*.tsx" | head -50
```
**Note:** This check is best done by running ESLint with `no-unused-vars` and `no-unused-imports`.

## Input Specification

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| target | string | no | Directory or file to check (default: entire project) |
| scope | string | no | Specific pattern IDs: `P1,P3,P7` or `all` (default: `all`) |
| fix | boolean | no | Auto-fix safe patterns (P3, P4, P7) where possible |

## Output Specification

### Output Format

```
## Architecture Consistency Report — SYNTHEX

### Pattern Violations Found

#### P1: Auth Centralisation [5 violations]
- app/api/analytics/reports/route.ts — defines local getJWTSecret() (line 12)
- app/api/auth/api-keys/route.ts — imports from 'jsonwebtoken' (line 3)
- app/api/auth/user/route.ts — defines local getUserFromRequest() (line 18)
- app/api/invoices/route.ts — defines local getJWTSecret() (line 8)
- app/api/notifications/stream/route.ts — defines local getJWTSecret() (line 10)

#### P3: Icon Barrel Imports [PASS]
No direct lucide-react imports found outside icons barrel.

#### P7: Client Directive [2 violations]
- components/business/BusinessSwitcher.tsx — uses useState but missing 'use client'
- app/dashboard/settings/page.tsx — uses useEffect but missing 'use client'

### Summary
- Patterns checked: 10
- Passed: 7
- Violations: 3 (P1: 5 files, P7: 2 files)
- Auto-fixable: 2 (P7)
```

## Instructions

1. **Accept target** — Default to full project scan if no target specified
2. **Run each pattern check** using the provided grep commands
3. **Report violations** with file paths and line numbers
4. **Group by pattern** and count violations per pattern
5. **Suggest fixes** with code snippets and reference to canonical implementations
6. **If `fix` mode**, auto-fix safe patterns (P3 icon imports, P4 Prisma imports, P7 client directive)

## Error Handling

| Error | Action |
|-------|--------|
| No files found in target | Report: "No TypeScript files found in specified directory" |
| Grep returns no matches | Report pattern as PASS |
| File permission error | Skip and report |

## Reference Files (Canonical Implementations)

- `lib/auth/jwt-utils.ts` — Auth pattern (P1, P2)
- `components/icons.tsx` — Icon barrel (P3)
- `lib/prisma.ts` — Prisma client singleton (P4)
- `app/api/campaigns/route.ts` — Reference API route (P5, P9)
- `middleware.ts` — Security headers reference

## Integration Points

- Complements **route-auditor** (route-specific vs codebase-wide)
- Complements **security-hardener** (architecture vs security)
- Called by **senior-reviewer** agent for comprehensive reviews
- Feeds into **post-route-create** hook for new route validation

## Commands

```bash
# Quick architecture health check (runs in ~5 seconds)
echo "=== P1: Auth Centralisation ===" && \
grep -rn "function getJWTSecret\|from 'jsonwebtoken'" app/api/ --include="*.ts" | grep -v "lib/auth" | wc -l && \
echo "=== P3: Icon Barrel ===" && \
grep -rn "from 'lucide-react'" components/ app/ --include="*.tsx" | grep -v "components/icons" | wc -l && \
echo "=== P4: Prisma Import ===" && \
grep -rn "from '@prisma/client'" app/ --include="*.ts" | grep -v "import.*type\|import type" | wc -l && \
echo "=== P7: Client Directive ===" && \
grep -rln "useState\|useEffect" components/ app/ --include="*.tsx" | xargs grep -L "'use client'" 2>/dev/null | wc -l
```
