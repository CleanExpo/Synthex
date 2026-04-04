# PHASE 8: CROSS-CUTTING CONCERNS

**Deliverable:** 08-CROSS-CUTTING.md
**Completed:** 2026-02-05
**Auditor:** Claude Opus 4.5

---

## 1. ERROR HANDLING CHAIN

### 1.1 Database Error Flow

```
Prisma Query Error
    ↓
lib/db/prisma-client.ts
    ↓ catch(error)
API Route Handler
    ↓ NextResponse.json({ error: ... }, { status: 500 })
Frontend fetch()
    ↓ .catch() or try/catch
useApi Hook
    ↓ setError(message)
Component
    ↓ {error && <ErrorMessage />}
User Sees
    ↓ "Something went wrong. Please try again."
```

**Assessment:** ✅ GOOD - Proper error propagation

**⚠️ Issue:** Some database errors expose internal details:
```typescript
// Bad pattern found in some routes:
return NextResponse.json(
  { error: error.message }, // Exposes Prisma internals
  { status: 500 }
);
```

### 1.2 Network Timeout Flow

```
API Call Timeout
    ↓
useApi Hook (timeout: 30s default)
    ↓ AbortController.abort()
Error Handler
    ↓ Retry logic (max 3 attempts)
Final Failure
    ↓ setError('Request timed out')
Component
    ↓ <RetryButton onClick={refetch} />
User Action
    ↓ Click to retry
```

**Assessment:** ✅ GOOD - Retry with user control

### 1.3 Validation Error Flow

```
Form Submission
    ↓
Client Validation
    ├─ React Hook Form (if used)
    └─ Custom validation
    ↓ Invalid
Field Highlighting
    ↓ setFieldError(field, message)
User Sees
    ↓ Red border + error message
    ↓ Correct and resubmit
Server Validation
    ↓ Zod schema.parse()
    ↓ Invalid → ZodError
API Response
    ↓ { error: 'Validation failed', details: [...] }
Frontend Parse
    ↓ Map to field errors
User Sees
    ↓ Specific field errors
```

**⚠️ Issue:** Client and server validation not always synchronized

### 1.4 Auth Error Flow

```
Protected Route Access
    ↓
APISecurityChecker.check()
    ↓ !security.allowed
Unauthorized Response
    ↓ { error: 'Unauthorized' }, 401
Frontend Intercept
    ↓ Response status check
Auth Context
    ↓ Clear user, redirect
User Sees
    ↓ Login page with "Session expired" message
```

**Assessment:** ✅ GOOD - Proper session handling

---

## 2. LOGGING AND OBSERVABILITY

### 2.1 Current Logging Architecture

```
Application
    ↓
console.log/error/warn  ←── ⚠️ 901 occurrences
    ↓
Vercel Logs (stdout/stderr)
    ↓
30-day retention
```

**Issues:**
- No structured logging
- No log levels
- No correlation IDs
- Excessive debug logs in production

### 2.2 Request ID Tracing

**Implementation:** `lib/middleware/api-middleware.ts`

```typescript
const requestId = request.headers.get('x-request-id')
  || crypto.randomUUID();
```

| Hop | Has Request ID |
|-----|----------------|
| Client Request | ❌ Not set |
| API Middleware | ✅ Generated |
| Database Query | ❌ Not passed |
| External API | ❌ Not passed |
| Response | ✅ In header |

**⚠️ Incomplete:** Request ID not propagated to all services

### 2.3 Sentry Integration

**Configuration:** `sentry.client.config.ts`, `sentry.server.config.ts`

| Feature | Status |
|---------|--------|
| Error capture | ✅ Enabled |
| Performance tracing | ✅ Enabled |
| User context | ⚠️ Partial |
| Release tracking | ✅ Configured |
| Source maps | ✅ Uploaded |

### 2.4 Business Metrics

**File:** `lib/metrics/business-metrics.ts` (908 lines)

| Metric Category | Tracked |
|-----------------|---------|
| User signups | ✅ Yes |
| Content created | ✅ Yes |
| Posts published | ✅ Yes |
| AI generations | ⚠️ Partial |
| Revenue events | ✅ Yes (via Stripe) |

---

## 3. CACHING STRATEGY

### 3.1 Cache Layers

```
Client                    Server                    Database
  │                         │                         │
  ├── React Query ─────────►│                         │
  │   (1 min stale)         │                         │
  │                         ├── Redis ───────────────►│
  │                         │   (Upstash)             │
  │                         │                         │
  │                         ├── In-Memory ───────────►│
  │                         │   (Fallback)            │
  │                         │                         │
  │◄─────────────────────────────────────────────────►│
                     HTTP Cache
                   (CDN, stale-while-revalidate)
```

### 3.2 Cache Configuration

| Layer | TTL | Invalidation |
|-------|-----|--------------|
| React Query | 60s stale, 5min gc | Manual + focus |
| Redis | Varies by key | Manual |
| HTTP (static) | 31536000s | Deploy |
| HTTP (API) | no-store | N/A |

### 3.3 Cache Invalidation Patterns

| Event | Caches Invalidated |
|-------|-------------------|
| User update | React Query: user |
| Post create | React Query: posts, Redis: feed |
| Settings change | React Query: settings |

**⚠️ Issue:** No centralized cache invalidation strategy

---

## 4. FEATURE FLAGS

### 4.1 Current Implementation

**Status:** ❌ No feature flag system found

**Impact:**
- No gradual rollouts
- No A/B testing infrastructure (separate from product A/B testing)
- All-or-nothing deployments

### 4.2 Recommendation

Implement feature flags for:
- New feature rollouts
- Experimental features
- Kill switches for problematic features

---

## 5. INTERNATIONALIZATION

### 5.1 Current Status

**Status:** ❌ No i18n implementation

| Aspect | Status |
|--------|--------|
| Language files | ❌ None |
| Date formatting | ⚠️ Inconsistent |
| Number formatting | ⚠️ Inconsistent |
| Currency | ⚠️ USD only |
| RTL support | ❌ None |

### 5.2 Hardcoded Strings

**Total Count:** 500+ UI strings hardcoded

**Examples:**
```tsx
// Throughout components:
<Button>Save Changes</Button>
<h1>Dashboard</h1>
<p>No results found</p>
```

---

## 6. ACCESSIBILITY (A11Y)

### 6.1 Assessment Summary

| Category | Status | Score |
|----------|--------|-------|
| ARIA labels | ⚠️ Partial | 60% |
| Keyboard navigation | ✅ Good | 80% |
| Color contrast | ❓ Unknown | N/A |
| Screen reader | ⚠️ Partial | 50% |
| Focus management | ⚠️ Partial | 60% |

### 6.2 Issues Found

1. **Images without alt text:** ~20 instances
2. **Interactive divs without role:** ~15 instances
3. **Missing form labels:** ~10 instances
4. **No skip-to-content link:** Landing page

---

## 7. PERFORMANCE PATTERNS

### 7.1 Code Splitting

| Pattern | Count | Assessment |
|---------|-------|------------|
| dynamic() imports | 8 | ✅ Good |
| lazy() components | 6 | ✅ Good |
| Suspense boundaries | 5 | ⚠️ Could be more |

### 7.2 Bundle Analysis

**Estimated Bundle Sizes:**

| Bundle | Size | Assessment |
|--------|------|------------|
| Main chunk | ~250KB | ⚠️ Large |
| Three.js | ~150KB | ⚠️ Consider lazy load |
| Recharts | ~100KB | ⚠️ Consider lazy load |
| Framer Motion | ~80KB | Acceptable |

### 7.3 Database Query Patterns

| Pattern | Instances | Risk |
|---------|-----------|------|
| N+1 queries | ~5 | MEDIUM |
| Missing indexes | ~3 | LOW |
| Large result sets | ~8 | MEDIUM |

---

## 8. SECURITY PATTERNS

### 8.1 Input Sanitization

| Layer | Sanitization |
|-------|--------------|
| API Input | ✅ Zod validation |
| Database | ✅ Prisma parameterization |
| HTML Output | ⚠️ Mostly escaped, 1 XSS risk |

### 8.2 Output Encoding

| Context | Encoding |
|---------|----------|
| HTML | ✅ React auto-escape |
| JSON | ✅ JSON.stringify |
| URL | ✅ encodeURIComponent |

### 8.3 Sensitive Data Handling

| Data Type | In Transit | At Rest |
|-----------|------------|---------|
| Passwords | ✅ HTTPS | ✅ bcrypt |
| OAuth tokens | ✅ HTTPS | ❌ Plain text |
| API keys | ✅ HTTPS | ❌ Plain text |
| PII | ✅ HTTPS | ❌ Not encrypted |

---

## 9. DEPENDENCY INJECTION

### 9.1 Current Pattern

**Pattern:** Direct imports (no DI container)

```typescript
// Current pattern:
import { prisma } from '@/lib/db/prisma-client';

export async function getUser(id: string) {
  return prisma.user.findUnique({ where: { id } });
}
```

### 9.2 Testability Impact

| Aspect | Status |
|--------|--------|
| Database mocking | ⚠️ Difficult |
| Service isolation | ⚠️ Tight coupling |
| Unit testing | ⚠️ Requires setup |

---

## 10. RECOMMENDATIONS

### 10.1 Critical

1. **Implement Structured Logging**
   - Replace console.log with proper logger
   - Add log levels (debug, info, warn, error)
   - Include request ID in all logs

2. **Add Health Check Endpoint**
   - Database connectivity
   - Redis connectivity
   - External service status

### 10.2 High Priority

1. **Implement Feature Flags**
   - LaunchDarkly or Unleash
   - Gradual rollout capability

2. **Propagate Request IDs**
   - Pass through all service calls
   - Include in external API calls

3. **Fix Error Message Exposure**
   - Sanitize all error messages
   - Log details server-side only

### 10.3 Medium Priority

1. **Add i18n Support**
   - Extract strings to language files
   - Implement next-intl or similar

2. **Improve Accessibility**
   - Add missing alt texts
   - Fix form labels
   - Add skip navigation

3. **Implement Centralized Cache Invalidation**
   - Event-driven invalidation
   - Cross-service coordination

### 10.4 Low Priority

1. **Add Dependency Injection**
   - Improve testability
   - Loose coupling

2. **Bundle Optimization**
   - Lazy load heavy libraries
   - Code split by route

---

## 11. CROSS-CUTTING METRICS SUMMARY

| Concern | Score | Status |
|---------|-------|--------|
| Error Handling | 7/10 | ⚠️ WARN |
| Logging | 4/10 | ❌ FAIL |
| Caching | 7/10 | ⚠️ WARN |
| Feature Flags | 0/10 | ❌ FAIL |
| i18n | 0/10 | ❌ FAIL |
| Accessibility | 6/10 | ⚠️ WARN |
| Performance | 7/10 | ⚠️ WARN |
| Security Patterns | 6/10 | ⚠️ WARN |

---

**Phase 8 Status:** ✅ COMPLETE
**Deliverable:** specs/08-CROSS-CUTTING.md
