---
name: auth-patterns
description: >-
  Authentication and authorisation pattern guide for SYNTHEX. Documents the four
  auth layers (Supabase session, JWT token, RBAC permissions, owner bypass),
  when to use each, and the common mistakes that cause auth drift.
  Use when creating or modifying any authenticated endpoint or middleware logic.
metadata:
  author: synthex
  version: "1.0"
  engine: synthex-ai-agency
  type: reference-skill
  triggers:
    - auth pattern
    - authentication
    - authorisation
    - jwt
    - rbac
    - permissions
    - owner check
    - pkce
    - oauth flow
---

# Auth Patterns — Authentication & Authorisation Guide

## Purpose

SYNTHEX has four distinct auth layers that serve different purposes. Using the
wrong layer (or mixing them) causes auth drift — the #1 source of security
bugs in the codebase.

This skill documents which layer to use, where the code lives, and the
common mistakes to avoid.

## Auth Layer Decision Tree

```
Is this a Next.js middleware route guard?
  YES → Use Supabase session (middleware.ts)

Is this an API route?
  YES → Does it use APISecurityChecker?
    YES → Use DEFAULT_POLICIES.AUTHENTICATED_READ or AUTHENTICATED_WRITE
    NO  → Is it a legacy route?
      YES → Migrate to APISecurityChecker
      NO  → Use APISecurityChecker (never raw jwt.verify)

Does it need fine-grained permission checks?
  YES → Use RBAC (permission-engine.ts + role-manager.ts)

Does it need to gate on platform ownership?
  YES → Use isOwnerEmail() from jwt-utils.ts
```

## Layer 1: Supabase Session (Middleware)

**File:** `middleware.ts`
**Purpose:** Route-level access control for pages and API preflight
**How it works:** Creates a Supabase SSR client from cookies, calls `getSession()`,
redirects unauthenticated users to `/login`.

```
Request → middleware.ts → Supabase SSR client → getSession()
  → Authenticated: pass through with security headers
  → Unauthenticated: redirect to /login
```

**Key details:**
- Runs in Edge Runtime (limited Node.js APIs)
- Sets security headers (CSP, HSTS, X-Frame-Options)
- Handles API key gate via `checkApiKeyGate()` for `/dashboard` routes
- Checks `supabase-auth-token` cookie fallback for unified login

**When to use:** Page-level route protection only. Never for API authorisation.

## Layer 2: APISecurityChecker (API Routes)

**File:** `lib/security/api-security-checker.ts`
**Purpose:** Standardised auth + validation + rate limiting for all API routes
**How it works:** Accepts a `SecurityPolicy` config, verifies JWT from
Authorization header, applies rate limits, validates input schema.

```typescript
const security = await APISecurityChecker.check(
  request,
  DEFAULT_POLICIES.AUTHENTICATED_WRITE
);
if (!security.allowed) {
  return APISecurityChecker.createSecureResponse(
    { error: security.error },
    security.error === 'Authentication required' ? 401 : 403
  );
}
const userId = security.context.userId;
```

**Default policies:**
- `PUBLIC_READ` — No auth required, rate limited
- `AUTHENTICATED_READ` — JWT required, read-only
- `AUTHENTICATED_WRITE` — JWT required, CSRF protection
- `ADMIN_ONLY` — JWT + admin role required

**When to use:** Every API route. No exceptions.

## Layer 3: RBAC (Fine-Grained Permissions)

**Files:**
- `lib/auth/rbac/permission-engine.ts` — Permission matching with wildcards
- `lib/auth/rbac/role-manager.ts` — Role CRUD, user-role assignment
- `lib/auth/rbac/access-control.ts` — Middleware-style access control

**Permission format:** `resource:action` (e.g., `posts:create`, `billing:manage`)

**Resources:** posts, campaigns, analytics, personas, settings, users, roles,
integrations, billing, organization

**Actions:** create, read, update, delete, manage, export, invite, approve

**Wildcard:** `*` grants all permissions (owner-level)

**Fail-secure:** On any error, access is denied. Never fails open.

**When to use:** Multi-tenant features where different team roles need different
access levels within an organisation.

## Layer 4: Owner Bypass

**File:** `lib/auth/jwt-utils.ts` (line 46-57)
**Purpose:** Platform owner gets full access without Stripe or onboarding gates

```typescript
import { isOwnerEmail } from '@/lib/auth/jwt-utils';

if (!isOwnerEmail(user.email)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

**How it works:** Checks email against `OWNER_EMAILS` ReadonlySet. Owners get
`onboardingComplete: true` and `apiKeyConfigured: true` in their JWT regardless
of DB state.

**When to use:** Admin-only endpoints (model refresh, platform credentials,
system configuration).

## PKCE (OAuth Security)

**File:** `lib/auth/pkce.ts`
**Purpose:** RFC 7636 implementation for secure OAuth 2.0 code exchange

**Key functions:**
- `generateCodeVerifier()` — 32 bytes of crypto-random, base64url encoded
- `generateCodeChallenge()` — SHA-256 hash of verifier
- `generatePKCEChallenge()` — Returns `{ codeVerifier, codeChallenge, method: 'S256' }`

**Storage fallback chain:** Redis → Database (OAuthPKCEState table) → In-memory

**When to use:** All OAuth flows for social platform connections.

## OAuth Handler (Client-Side)

**File:** `lib/auth/oauth-handler.ts`
**Purpose:** Unified client-side OAuth initiation for social login

**Providers:** Google, GitHub, Twitter, LinkedIn, Facebook

**Pattern:** Calls `/api/auth/oauth/{provider}`, receives redirect URL, handles
errors with `sonner` toasts.

## Common Mistakes

| Mistake | Why It's Wrong | Correct Pattern |
|---------|---------------|----------------|
| `jwt.verify(token, secret) as any` | Unsafe cast, no type safety | Use `APISecurityChecker.check()` |
| Local `getJWTSecret()` function | Duplicates centralised utility | Import from `jwt-utils.ts` |
| Missing org scoping on queries | Data leaks across organisations | Always filter by `organizationId` |
| Hardcoded role checks | Bypasses RBAC system | Use `PermissionEngine.checkPermission()` |
| `process.env.JWT_SECRET!` in route | Non-null assertion on env var | `getJWTSecret()` with validation |
| Supabase auth in API routes | Wrong layer, session vs token | Use APISecurityChecker |

## Environment Variables

| Variable | Layer | Required |
|----------|-------|----------|
| `JWT_SECRET` | JWT token signing | CRITICAL |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase session | CRITICAL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase session | CRITICAL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase | CRITICAL |
| `DATABASE_URL` | RBAC persistence | CRITICAL |
| `REDIS_URL` | PKCE state storage | Recommended |

## File Index

| File | Purpose |
|------|---------|
| `middleware.ts` | Route guards, security headers, session refresh |
| `lib/auth/jwt-utils.ts` | JWT generation, verification, owner checks |
| `lib/auth/pkce.ts` | PKCE challenge generation and state management |
| `lib/auth/oauth-handler.ts` | Client-side OAuth flow initiation |
| `lib/auth/rbac/permission-engine.ts` | Permission matching and evaluation |
| `lib/auth/rbac/role-manager.ts` | Role CRUD and user assignment |
| `lib/auth/rbac/access-control.ts` | Access control middleware |
| `lib/auth/auth-service.ts` | Auth service utilities |
| `lib/auth/account-service.ts` | Account management |
| `lib/auth/signInFlow.ts` | Sign-in flow orchestration |
| `lib/auth/monitoring.ts` | Auth event monitoring |
| `lib/security/api-security-checker.ts` | API route security enforcement |
