---
description: Verify the Synthex foundation is intact — directory structure, key modules, then run the real gate (type-check, lint, test, prisma validate).
allowed-tools: Read, Glob, Grep, Bash
---

# Verify Command

Verify that the Synthex foundation architecture is intact.

> **Architecture:** `app/` → `components/` → `hooks/` → `lib/` → Prisma → Supabase (no `src/` app code — `src/` only holds `skills/`).

## Checks to Perform

### 1. Directory Structure

Verify these top-level directories exist:
- `app/` and `app/api/`
- `components/`
- `hooks/`
- `lib/` (with `lib/auth/`, `lib/api/`)
- `prisma/` (with `prisma/schema.prisma`)
- `types/`
- `supabase/`

### 2. Key Modules

Verify these exist and are wired:
- `lib/api/define-route.ts` — exports `defineRoute` and `defineOrgRoute`
- `lib/auth/jwt-utils.ts` — exports `getUserIdFromRequestOrCookies`
- `lib/multi-business/business-scope.ts` — exports `getEffectiveOrganizationId`
- `lib/prisma.ts` — Prisma client singleton

### 3. Auth Discipline

- No imports of Clerk / NextAuth / Auth.js anywhere (Supabase only)
- Mutation routes go through `defineRoute`/`defineOrgRoute` or an explicit auth + Zod check

### 4. Prisma Validity

```bash
npx prisma validate
```

### 5. Type Check

```bash
npm run type-check   # tsc --noEmit
```

### 6. Lint

```bash
npm run lint         # eslint . --max-warnings 0
```

### 7. Tests

```bash
npm test             # jest --config jest.worktree.cjs
```

Paste the actual `Tests: X passed, Y total` line — do not assert a pass without it.

## Report Format

```
Foundation Verification Report
==============================

Directory Structure: [PASS/FAIL]
Key Modules:         [PASS/FAIL]
Auth Discipline:     [PASS/FAIL]
Prisma Validate:     [PASS/FAIL]
Type Check:          [PASS/FAIL]
Lint:                [PASS/FAIL]
Tests:               [PASS/FAIL]  (Tests: X passed, Y total)

Overall: [PASS/FAIL]

Issues Found:
- [file:line — description]
```
