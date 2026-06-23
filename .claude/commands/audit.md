---
description: Run a full architecture and code-quality audit against Synthex layer rules (app → components → hooks → lib → Prisma → Supabase), org-scoping, and Zod validation.
allowed-tools: Grep, Glob, Read, Bash
---

# Audit Command

Perform a full architecture audit of the Synthex codebase.

> **Architecture (canonical):** `app/` → `components/` → `hooks/` → `lib/` services → Prisma → Supabase.
> **Layer rule:** no cross-layer imports — each layer imports only from the one below it.

## Audit Categories

### 1. LAYER VIOLATIONS (Critical)

Check for improper imports between layers:

- **Components importing route handlers**: `components/**` must NEVER import from `app/api/`
- **Pages/components reaching past hooks**: data fetching belongs in `hooks/` (`useApi`/`useApiSWR`), not raw `fetch()` in client components
- **lib/ importing upward**: `lib/**` must NEVER import from `app/`, `components/`, or `hooks/`

Search patterns:
```
components/**/*.{ts,tsx}  -> import from '@/app/api'
app/**/*.tsx             -> raw fetch( in a 'use client' file (should use hooks)
lib/**/*.ts              -> import from '@/app' | '@/components' | '@/hooks'
```

### 2. AUTH & ORG-SCOPE (Critical)

- **Routes without auth**: `app/api/**/route.ts` mutations missing `getUserIdFromRequestOrCookies()` (`@/lib/auth/jwt-utils`) or `defineOrgRoute`
- **Cross-org leaks**: Prisma queries missing `organizationId` / `clientId` scope (use `getEffectiveOrganizationId()`)
- **Non-Supabase auth**: any reference to Clerk / NextAuth / Auth.js — banned, Supabase only

### 3. VALIDATION ISSUES (High)

- **Mutations without Zod**: POST/PUT/PATCH/DELETE handlers not using `defineRoute`/`defineOrgRoute` (`@/lib/api/define-route`) or a `z.object(...).safeParse()`
- **Wrong error shape**: error responses not matching `{ error: string, details?: unknown }`

### 4. TYPE ISSUES (High)

- **Any type usage**: search for `: any` or `as any`
- **Type assertions without validation**: `as SomeType` without a preceding parse/guard
- **Missing return types** on exported functions

### 5. ASYNC & ERROR HANDLING (High)

- **Unhandled promises**: promises without `await` or `.catch()`
- **Empty catch blocks**: `catch (e) {}` or `catch { }`
- **Swallowed errors**: catches that neither log nor return a structured error

### 6. COMPONENT STATES (Medium)

For each async feature component under `components/`:
- **Missing loading state** (no skeleton/spinner)
- **Missing error state**
- **Missing empty state**

### 7. DEPENDENCY DISCIPLINE (Medium)

- New `package.json` deps that duplicate an existing capability (see the `dependency-discipline` skill)

## Report Format

```
Architecture Audit Report
=========================

CRITICAL ISSUES:
- [Layer violations / auth / org-scope with file:line]

HIGH PRIORITY:
- [Validation / type / async issues with file:line]

MEDIUM PRIORITY:
- [Component state / dependency issues]

Summary:
- Critical: X | High: X | Medium: X | Total: X
```

## Remediation

For each issue: (1) file path and line number, (2) the problem, (3) the suggested fix grounded in the Synthex convention it violates.
