# PHASE 2: BACKEND DEEP INSPECTION

**Deliverable:** 02-BACKEND-INSPECTION.md
**Completed:** 2026-02-05
**Auditor:** Claude Opus 4.5

---

## 1. API LAYER ANALYSIS

### 1.1 API Route Statistics

| Metric | Count |
|--------|-------|
| Total API Route Directories | 187 |
| Route Files (route.ts/js) | 146 |
| Routes WITH authentication | 33 (23%) |
| Routes WITHOUT authentication check* | 113 (77%) |

*Note: Many routes without explicit security checker may use alternative patterns (login/signup don't need auth)

### 1.2 Authentication Coverage Analysis

**Routes Using Security Patterns:**
- `APISecurityChecker.check()` - 113 instances
- `getUserIdFromCookies()` - Used in dashboard routes
- `requireAuth()` - Used in protected endpoints
- `withAuth()` - HOC pattern for route handlers
- Custom `verifyAdmin()` - Used in admin routes

**⚠️ CRITICAL FINDING: API Routes Without Auth Checks**

| Route | Risk | Justification |
|-------|------|---------------|
| `/api/auth/login` | LOW | Public endpoint (expected) |
| `/api/auth/signup` | LOW | Public endpoint (expected) |
| `/api/auth/reset` | LOW | Public endpoint (expected) |
| `/api/admin/users` | **HIGH** | Has custom admin verification |
| `/api/admin/audit-log` | **HIGH** | Has custom admin verification |
| `/api/admin/jobs` | **HIGH** | Has custom admin verification |
| `/api/ai/generate-content` | **MEDIUM** | Needs auth check |
| `/api/analytics/*` (6 routes) | **MEDIUM** | Some missing auth |

### 1.3 Input Validation Coverage

**Zod Schema Usage:**
- `z.object()` patterns found: Extensive usage
- Routes with input validation: Majority of POST/PUT endpoints
- Routes missing validation: Some GET endpoints with query params

**Example - Good Pattern (admin/users):**
```typescript
const listUsersQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  search: z.string().max(200).optional(),
  // ...
});
```

### 1.4 Rate Limiting

**Implementation Found:**
- `lib/middleware/rate-limiter-v2.ts` - Full-featured rate limiter
- `lib/scalability/redis-rate-limiter.ts` - Redis-backed limiter
- `lib/rate-limiter-enhanced.ts` - Enhanced version

**Rate Limit Tiers (from api-security-checker.ts):**

| Policy | Max Requests | Window |
|--------|-------------|--------|
| PUBLIC_READ | 100 | 60s |
| AUTHENTICATED_READ | 200 | 60s |
| AUTHENTICATED_WRITE | 50 | 60s |
| ADMIN_ONLY | 100 | 60s |
| WEBHOOK | 1000 | 60s |

### 1.5 Error Handling Patterns

**Consistent Patterns Found:**
- Try-catch blocks in all route handlers
- Structured error responses with status codes
- Error logging to console (production should use structured logging)

**⚠️ ISSUE: Error Message Exposure**
```typescript
// Found in some routes - exposes internal details
return NextResponse.json(
  { error: 'Internal Server Error', message: error.message },
  { status: 500 }
);
```

---

## 2. AUTHENTICATION & AUTHORIZATION

### 2.1 JWT Implementation (`lib/auth/jwt-utils.ts`)

**Security Assessment: ✅ GOOD**

| Feature | Status | Notes |
|---------|--------|-------|
| Secret validation | ✅ | Throws if JWT_SECRET missing |
| Secret length check | ✅ | Warns if <32 chars |
| Token verification | ✅ | Uses jwt.verify() |
| httpOnly cookies | ✅ | `getUserIdFromCookies()` |
| Token expiration | ✅ | 7d default |
| Dual auth support | ✅ | Cookie + Bearer header |

**Key Code Review:**
```typescript
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required...');
  }
  if (secret.length < 32) {
    console.warn('[SECURITY WARNING] JWT_SECRET should be at least 32 characters...');
  }
  return secret;
}
```

### 2.2 API Security Checker (`lib/security/api-security-checker.ts`)

**Security Assessment: ✅ EXCELLENT**

| Feature | Implementation |
|---------|---------------|
| HTTPS enforcement | ✅ `requireHTTPS` policy |
| IP filtering | ✅ Allow/block lists |
| Rate limiting | ✅ In-memory + Redis |
| Auth verification | ✅ JWT validation |
| RBAC | ✅ Role-based access |
| CSRF protection | ✅ Token verification |
| Body size limits | ✅ Configurable |
| Audit logging | ✅ Every request |
| Output sanitization | ✅ Removes sensitive fields |
| Security headers | ✅ X-Content-Type-Options, etc. |

**Sensitive Field Redaction:**
```typescript
const sensitiveFields = [
  'password', 'token', 'secret', 'apiKey', 'api_key',
  'authorization', 'cookie', 'session', 'salt', 'hash',
  'creditCard', 'credit_card', 'cvv', 'ssn'
];
```

### 2.3 Environment Validator (`lib/security/env-validator.ts`)

**Security Assessment: ✅ EXCELLENT**

**Security Classifications:**
- `PUBLIC` - Safe for client-side (NEXT_PUBLIC_*)
- `INTERNAL` - Server-side only
- `SECRET` - Sensitive data (API keys)
- `CRITICAL` - Highly sensitive (DB URLs, private keys)

**Validated Environment Variables (43 total):**
- DATABASE_URL (CRITICAL)
- JWT_SECRET (CRITICAL)
- SUPABASE_SERVICE_ROLE_KEY (CRITICAL)
- STRIPE_SECRET_KEY (CRITICAL)
- OPENROUTER_API_KEY (SECRET)
- OPENAI_API_KEY (SECRET)
- And 37 more...

### 2.4 RBAC System (`lib/auth/rbac/`)

**Components:**
- `role-manager.ts` - Role CRUD operations
- `permission-engine.ts` - Permission validation

**Features:**
- Permission validation before assignment
- Role inheritance handling
- Audit logging for role changes
- Organization-scoped roles

### 2.5 OAuth Implementation

**Providers Found:**
- Google OAuth (`lib/auth/oauth-handler.ts`)
- Twitter/X OAuth
- Facebook/Meta OAuth
- LinkedIn OAuth
- TikTok OAuth

**PKCE Support:** `lib/auth/pkce.ts`

---

## 3. DATABASE LAYER

### 3.1 Prisma Schema Analysis

**Schema Statistics:**
- Total lines: 904
- Models: 35+
- Indexes: Well-indexed for common queries

### 3.2 Model Summary

| Model | Purpose | Key Relations |
|-------|---------|---------------|
| User | Core user entity | Accounts, Campaigns, AuditLogs |
| Account | OAuth providers | User (multi-provider) |
| Campaign | Marketing campaigns | Posts, Organization |
| Post | Social posts | Campaign, Metrics |
| Session | User sessions | Token-based |
| AuditLog | Security audit trail | User, timestamps |
| Organization | Multi-tenant | Users, Roles, Campaigns |
| PlatformConnection | Social accounts | User, PlatformPosts |
| Role | RBAC roles | Organization |
| Subscription | Billing/plans | User, Stripe |
| Report | Generated reports | User, Organization |

### 3.3 Security Features in Schema

**✅ Cascade Deletes:** `onDelete: Cascade` properly configured
**✅ Unique Constraints:** Email, OAuth provider combos
**✅ Indexes:** Performance-optimized queries
**✅ Soft Deletes:** Status fields for logical deletion
**✅ Audit Trail:** AuditLog model with severity levels

### 3.4 Sensitive Data Storage

| Field | Model | Encryption |
|-------|-------|------------|
| password | User | Nullable (Supabase handles) |
| accessToken | Account | @db.Text (should be encrypted) |
| refreshToken | Account | @db.Text (should be encrypted) |
| accessToken | PlatformConnection | Plain text |
| refreshToken | PlatformConnection | Plain text |
| openrouterApiKey | User | Plain text |
| anthropicApiKey | User | Plain text |

**⚠️ CRITICAL FINDING: OAuth tokens and API keys stored in plain text**

---

## 4. SECURITY VULNERABILITIES

### 4.1 Critical Findings

| ID | Severity | Finding | Location | Remediation |
|----|----------|---------|----------|-------------|
| SEC-001 | **CRITICAL** | OAuth tokens stored plain text | PlatformConnection model | Implement field-level encryption |
| SEC-002 | **CRITICAL** | User API keys stored plain text | User model | Implement encryption |
| SEC-003 | **HIGH** | dangerouslySetInnerHTML without sanitization | blog/[slug]/page.tsx:325 | Use DOMPurify |
| SEC-004 | **MEDIUM** | Error messages expose internal details | Multiple API routes | Sanitize error messages |
| SEC-005 | **MEDIUM** | 113 routes without explicit auth pattern | Various API routes | Audit and add auth (IN PROGRESS - UNI-557) |
| SEC-006 | **HIGH** | IDOR vulnerabilities in stub routes | Various API routes | ~~Add auth + ownership verification~~ ✅ RESOLVED (UNI-558) |

### 4.2 XSS Risk Analysis

**Found in `app/blog/[slug]/page.tsx:325`:**
```tsx
<div
  className="prose prose-invert prose-lg max-w-none"
  dangerouslySetInnerHTML={{ __html: post.content }}
/>
```

**Risk:** If `post.content` comes from user input or external source, XSS is possible.
**Mitigation:** Use DOMPurify before rendering.

### 4.3 IDOR Vulnerability Analysis

**~~IDOR Vulnerabilities Found:~~** ✅ RESOLVED (UNI-558, 2026-02-12)

| Route | Issue | Resolution |
|-------|-------|------------|
| `api/library/content/[contentId]` | Stub with no auth | Added APISecurityChecker + ownership verification |
| `api/competitors/[competitorId]/analyze` | Stub with no auth | Added APISecurityChecker + ownership verification |

**Routes Verified Secure:**
- `api/content/[id]` - Has `campaign.userId` ownership check
- `api/scheduler/posts/[postId]` - Has `campaign.userId` ownership check
- `api/organizations/[orgId]` - Has `isOrgMember()` / `isOrgAdmin()` checks
- `api/ab-testing/tests/[testId]` - Uses `findFirst({ where: { id, userId } })`
- `api/teams/members/[memberId]` - Has organization membership verification
- `api/teams/invitations/[id]` - Has organization scoping
- `api/competitors/track/[id]` - Uses `findFirst({ where: { id, userId } })`
- `api/quotes/[id]` - Has explicit ownership check
- `api/notifications/[notificationId]/read` - Has `userId` ownership check
- `api/personas/[id]/optimize` - Uses `findFirst({ where: { id, userId } })`
- `api/personas/[id]/train` - Uses `findFirst({ where: { id, userId } })`
- `api/competitors/track/[id]/snapshot` - Uses `findFirst({ where: { id, userId } })`
- `api/teams/[id]/settings` - Has `canManageTeam()` permission check
- `api/reporting/reports/[reportId]` - Passes userId to reportGenerator
- `api/reporting/reports/[reportId]/download` - Passes userId to reportGenerator

### 4.4 Command Injection Analysis

**spawn() usage found in:**
- `scripts/real-deploy-check.ts` - Deploy scripts (acceptable)
- `src/services/ttd-rd-framework.ts` - Test runner (acceptable)

**Risk:** LOW - All spawn commands use hardcoded scripts, not user input.

---

## 5. CODE QUALITY METRICS

### 5.1 TypeScript Usage

| Pattern | Count | Assessment |
|---------|-------|------------|
| `@ts-ignore`/`@ts-nocheck` | 1 | ✅ Excellent |
| `: any` type usage | 190 | ⚠️ Needs reduction |
| `as any` casts | Included above | - |

### 5.2 Technical Debt Markers

| Pattern | App Dir | Lib Dir | Total |
|---------|---------|---------|-------|
| TODO | 3 | 4 | 7 |
| FIXME | 2 | 1 | 3 |
| HACK | 1 | 2 | 3 |
| XXX | 1 | 2 | 3 |

### 5.3 Console Logging

**console.log in app/:** 20 occurrences
- Should be replaced with structured logging in production

### 5.4 Large Files (>500 lines)

**App Directory:**
| File | Lines | Action |
|------|-------|--------|
| dashboard/tasks/page.tsx | 1,233 | ⚠️ Needs decomposition |
| dashboard/settings/page.tsx | 931 | ⚠️ Needs decomposition |
| dashboard/team/page.tsx | 920 | ⚠️ Needs decomposition |
| page.tsx (landing) | 882 | Acceptable for landing |
| dashboard/personas/page.tsx | 870 | ⚠️ Needs decomposition |

**Lib Directory:**
| File | Lines | Action |
|------|-------|--------|
| metrics/business-metrics.ts | 908 | ⚠️ Consider splitting |
| security/env-validator.ts | 884 | Acceptable (comprehensive) |
| industries/taxonomy.ts | 882 | Data file - acceptable |
| analytics/analytics-tracker.ts | 874 | ⚠️ Consider splitting |

---

## 6. MIDDLEWARE ARCHITECTURE

### 6.1 API Middleware (`lib/middleware/api-middleware.ts`)

**Features:**
- Request ID generation
- CORS handling
- Rate limiting integration
- Auth verification
- Request logging
- Error handling
- Tenant context injection

**Convenience Wrappers:**
```typescript
withPublicAPI()      // No auth, rate limited
withAuthenticatedAPI() // Auth required
withAIAPI()          // Stricter limits
withExportAPI()      // Daily limits
withAdminAPI()       // Enhanced logging
```

### 6.2 Rate Limiter V2 (`lib/middleware/rate-limiter-v2.ts`)

- Tiered by plan (free, starter, pro, enterprise)
- In-memory fallback when Redis unavailable
- Cost multiplier support for expensive operations

---

## 7. THIRD-PARTY INTEGRATIONS

### 7.1 AI Services

| Service | Package | Key Validation |
|---------|---------|----------------|
| OpenRouter | Direct API | `sk-or-` prefix |
| Anthropic | @anthropic-ai/sdk | `sk-ant-` prefix |
| OpenAI | openai | `sk-` prefix |

### 7.2 Payment Processing

| Service | Package | Features |
|---------|---------|----------|
| Stripe | stripe, @stripe/stripe-js | Subscriptions, webhooks |

**Webhook Validation:** `WebhookValidator.validateStripe()` in security module

### 7.3 Email Services

- SendGrid (`@sendgrid/mail`)
- Nodemailer (SMTP)

### 7.4 Caching

- Upstash Redis (`@upstash/redis`)
- IORedis (`ioredis`)
- Redis (`redis`)

---

## 8. RECOMMENDATIONS

### 8.1 Immediate Actions (Critical)

1. ~~**Encrypt OAuth Tokens**~~ ✅ RESOLVED (2026-02-12)
   - Account model: lib/auth/account-service.ts uses encryptField/decryptField
   - PlatformConnection: lib/supabase-server.ts now encrypts tokens via field-encryption.ts
   - Uses AES-256-GCM with FIELD_ENCRYPTION_KEY environment variable

2. ~~**Encrypt User API Keys**~~ ✅ RESOLVED
   - app/api/auth/api-keys/route.ts encrypts with encryptField() before storing
   - src/services/auth.ts also encrypts via encryptApiKey()
   - Migration script: scripts/migrate-encrypt-tokens.ts

3. ~~**Sanitize HTML Content**~~ ✅ RESOLVED (UNI-555)
   - app/blog/[slug]/page.tsx uses DOMPurify.sanitize() for content

### 8.2 High Priority

1. **Reduce `: any` usage** from 190 to <50
2. **Add auth to unprotected AI routes**
3. **Sanitize error messages** in production
4. **Decompose large page components** (>800 lines)

### 8.3 Medium Priority

1. Replace console.log with structured logging
2. Add explicit APISecurityChecker to remaining routes
3. Implement field-level audit logging for sensitive operations

---

## 9. EVIDENCE SUMMARY

### Commands Executed

```bash
# File counts
find ./app/api -name "route.ts" | wc -l  # 146

# Auth pattern check
grep -rL "APISecurityChecker|requireAuth|withAuth" ./app/api --include="route.ts" | wc -l  # 113

# Security patterns
grep -rn "dangerouslySetInnerHTML" --include="*.tsx"  # 1 in app code
grep -rn "@ts-ignore|@ts-nocheck"  # 1 occurrence
grep -rn ": any" ./app --include="*.ts" --include="*.tsx"  # 190 occurrences
```

---

**Phase 2 Status:** ✅ COMPLETE
**Deliverable:** specs/02-BACKEND-INSPECTION.md
