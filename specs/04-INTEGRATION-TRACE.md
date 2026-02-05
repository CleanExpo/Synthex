# PHASE 4: INTEGRATION AND DATA FLOW TRACING

**Deliverable:** 04-INTEGRATION-TRACE.md
**Completed:** 2026-02-05
**Auditor:** Claude Opus 4.5

---

## 1. USER AUTHENTICATION FLOW

### 1.1 Login Flow Trace

```
User Input → app/(auth)/login/page.tsx
    ↓
API Call → POST /api/auth/login (route.ts)
    ↓
Validation → Zod schema validation (email, password)
    ↓
Database → Prisma User.findUnique()
    ↓
Password Verify → bcrypt.compare() OR Supabase auth
    ↓
JWT Generation → lib/auth/jwt-utils.ts signToken()
    ↓
Cookie Set → httpOnly, secure, sameSite: 'lax'
    ↓
Response → { success: true, user: sanitizedUser }
    ↓
Client Update → AuthContext.setUser()
    ↓
Redirect → /dashboard
```

**⚠️ CRITICAL FINDING: Dual Password Validation**
- Two parallel password systems exist:
  - Supabase Auth (for OAuth users)
  - bcrypt (for email/password users)
- Risk: Inconsistent authentication behavior

### 1.2 OAuth Flow Trace

```
OAuth Button → hooks/useAuth.tsx signInWithOAuth()
    ↓
Provider Redirect → lib/auth/oauth-handler.ts
    ↓
PKCE Flow → lib/auth/pkce.ts (code_verifier, code_challenge)
    ↓
Callback → /api/auth/callback/[provider]
    ↓
Token Exchange → Provider-specific token endpoint
    ↓
User Upsert → Prisma Account + User models
    ↓
Session Create → JWT + Cookie
    ↓
Redirect → /dashboard or /onboarding
```

**Assessment: ✅ GOOD** - PKCE implemented correctly

---

## 2. CONTENT CREATION FLOW

### 2.1 AI Content Generation

```
User Input → Dashboard ContentForm component
    ↓
Form Submit → POST /api/ai/generate-content
    ↓
Auth Check → APISecurityChecker.check()
    ↓
Rate Limit → rate-limiter-v2.ts (AI tier limits)
    ↓
AI Provider → lib/ai/openrouter-client.ts
    ↓
API Call → OpenRouter API with model selection
    ↓
Stream Response → ReadableStream to client
    ↓
Usage Track → lib/usage/usage-tracker.ts
    ↓
Database Save → Prisma Content.create()
    ↓
Client Update → React Query invalidation
```

**⚠️ CRITICAL FINDING: Hardcoded User ID**

In `lib/usage/usage-tracker.ts`:
```typescript
await this.trackUsage({
  userId: 'user_id_here', // HARDCODED - Never works
  feature: 'ai_generation',
  tokens: response.usage?.total_tokens || 0
});
```

This usage tracking never associates with actual users.

### 2.2 Post Scheduling Flow

```
Schedule Form → components/PostScheduler.tsx
    ↓
Validation → Client-side + Zod schema
    ↓
API Call → POST /api/posts/schedule
    ↓
Auth + RBAC → User permissions check
    ↓
Database → Prisma Post.create() with scheduledAt
    ↓
Queue Job → BullMQ job creation
    ↓
Worker → Scheduled job picks up at scheduledAt
    ↓
Platform API → Social platform posting
    ↓
Status Update → Post.update({ status: 'published' })
    ↓
Webhook → Optional notification to user
```

**Assessment: ✅ GOOD** - Proper async job handling

---

## 3. SOCIAL MEDIA POSTING FLOW

### 3.1 Multi-Platform Post

```
Post Content → Dashboard PostCreator
    ↓
Platform Select → Multiple platform checkboxes
    ↓
API Call → POST /api/social/post
    ↓
For Each Platform:
    ↓
    Platform Connection → PlatformConnection lookup
    ↓
    Token Refresh → If expired, refresh OAuth token
    ↓
    Platform API → Twitter/LinkedIn/etc. API
    ↓
    Response Handle → Success/failure per platform
    ↓
    Metric Create → PlatformPost record
    ↓
Aggregate Response → Combined result to client
```

**⚠️ FINDING: Incomplete Webhook Implementation**

Platform webhooks configured in schema but handlers are stubs:
- `app/api/webhooks/twitter/route.ts` - Returns 200 OK only
- `app/api/webhooks/linkedin/route.ts` - Not implemented
- `app/api/webhooks/facebook/route.ts` - Not implemented

---

## 4. REPORT GENERATION FLOW

### 4.1 PDF/CSV Export

```
Report Request → Dashboard Reports page
    ↓
Config Select → Date range, metrics, format
    ↓
API Call → POST /api/reporting/generate
    ↓
Auth Check → withExportAPI() middleware
    ↓
Data Aggregate → Multiple Prisma queries
    ↓
AI Analysis → Optional AI insights
    ↓
Format Generate:
    ├── PDF → lib/reporting/pdf-generator.ts
    ├── CSV → lib/reporting/csv-generator.ts
    └── JSON → Direct response
    ↓
Storage → Temporary file or stream
    ↓
Response → Download URL or stream
```

**Assessment: ✅ GOOD** - Proper export handling

---

## 5. A/B TESTING FLOW

### 5.1 Test Creation and Tracking

```
Test Builder → components/AIABTesting.tsx
    ↓
Variants Define → Control + variants
    ↓
API Call → POST /api/ab-testing/tests
    ↓
Database → ABTest + ABTestVariant creation
    ↓
Activation → Test status = 'active'
    ↓
Traffic Split → Visitor assignment to variants
    ↓
Event Tracking:
    ├── Impression → POST /api/ab-testing/track
    ├── Click → POST /api/ab-testing/track
    └── Conversion → POST /api/ab-testing/track
    ↓
Results → GET /api/ab-testing/results
    ↓
Statistical Analysis → Winner determination
```

**Assessment: ✅ GOOD** - Full A/B testing pipeline

---

## 6. API CONTRACT VERIFICATION

### 6.1 Type Mismatches Found

| Endpoint | Frontend Expects | Backend Returns | Status |
|----------|-----------------|-----------------|--------|
| GET /api/analytics/dashboard | `metrics.growth` | `metrics.growthRate` | ⚠️ Mismatch |
| GET /api/user/profile | `user.avatarUrl` | `user.avatar_url` | ⚠️ Mismatch |
| POST /api/posts | `post.createdAt` | `post.created_at` | ⚠️ Mismatch |

### 6.2 Missing Error Handling

Some frontend components don't handle API error states:
- `components/analytics/RealTimeAnalytics.tsx` - No error boundary
- `components/SentimentAnalysis.tsx` - Silent failures

---

## 7. THIRD-PARTY INTEGRATION AUDIT

### 7.1 AI Services

| Service | Status | Error Handling | Rate Limiting |
|---------|--------|----------------|---------------|
| OpenRouter | ✅ Connected | ✅ Try-catch | ✅ Tier-based |
| Anthropic | ✅ Connected | ✅ Try-catch | ⚠️ Manual |
| OpenAI | ✅ Connected | ✅ Try-catch | ⚠️ Manual |

### 7.2 External Services

| Service | Status | Webhook Verified | Error Recovery |
|---------|--------|------------------|----------------|
| Stripe | ✅ Active | ✅ Signature check | ✅ Retry logic |
| SendGrid | ✅ Active | N/A | ⚠️ No retry |
| Supabase | ✅ Active | N/A | ✅ Auto-reconnect |
| Upstash Redis | ✅ Active | N/A | ✅ Fallback |

---

## 8. DATA CONSISTENCY CHECKS

### 8.1 Transaction Boundaries

**Missing Transactions:**
```typescript
// Should be wrapped in transaction:
await prisma.user.update({ ... });
await prisma.subscription.update({ ... });
await prisma.auditLog.create({ ... });
// If any fails, all should rollback
```

**Locations:**
- `app/api/billing/subscribe/route.ts`
- `app/api/team/invite/route.ts`

### 8.2 Orphaned Record Risk

| Parent | Child | Cascade Delete | Risk |
|--------|-------|----------------|------|
| User | Post | ✅ Yes | Low |
| User | PlatformConnection | ✅ Yes | Low |
| Campaign | Post | ✅ Yes | Low |
| Organization | User | ⚠️ SetNull | Medium |

---

## 9. RECOMMENDATIONS

### 9.1 Critical

1. **Fix Hardcoded User ID**
   - Replace `'user_id_here'` with actual user context
   - File: `lib/usage/usage-tracker.ts`

2. **Unify Password Validation**
   - Choose single auth method or document clearly
   - Add migration path for dual-system users

### 9.2 High Priority

1. **Implement Platform Webhooks**
   - Complete Twitter, LinkedIn, Facebook webhook handlers
   - Add webhook signature verification

2. **Add Transaction Boundaries**
   - Wrap multi-model operations in `prisma.$transaction()`

### 9.3 Medium Priority

1. **Fix API Contract Mismatches**
   - Standardize on camelCase or snake_case
   - Add TypeScript shared types

2. **Add Error Boundaries**
   - Wrap all async components with error handling

---

**Phase 4 Status:** ✅ COMPLETE
**Deliverable:** specs/04-INTEGRATION-TRACE.md
