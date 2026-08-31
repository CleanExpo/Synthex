# Synthex Cloudflare Workers Latency Baseline — Post-PR #786

**Date:** 2026-08-20  
**Task ID:** t_84d40025  
**Task Status:** Baseline Captured (Manual)

---

## Executive Summary

The Synthex platform is currently experiencing significant latency issues. The **homepage latency is ~1.29s**, which is **>6x higher** than the target threshold of <200ms. This positions Synthex well outside acceptable performance targets and represents a P1 critical issue requiring immediate optimization.

---

## Critical Finding

| Metric               | Value    | Target | Gap              |
| -------------------- | -------- | ------ | ---------------- |
| **Homepage Latency** | 1,293ms  | <200ms | +1,093ms (+645%) |
| Target Compliance    | ✗ NO     | —      | —                |
| P95 Estimate         | >1,200ms | <200ms | —                |

**Severity:** P1 — Critical performance degradation affecting user experience and SEO.

---

## Infrastructure Assessment

### Current Setup

- **Hosting Platform:** Vercel (Next.js 16.2.11)
- **Production URL:** https://synthex.social
- **CDN Provider:** Cloudflare (configured but not actively used for latency optimization)
- **Deployment Script:** `deployment/rollout-script.js` (includes CDN cache clearing stub)
- **Vercel Config:** `vercel.json` (headers configured)
- **App Config:** `config/app.config.js` (CDN enabled but configuration incomplete)

### Cloudflare Configuration

```javascript
// config/app.config.js
cdn: {
  enabled: process.env.CDN_ENABLED === 'true',
  provider: process.env.CDN_PROVIDER || 'cloudflare',
  cloudflare: {
    zoneId: process.env.CLOUDFLARE_ZONE_ID || '',  // MISSING
    apiToken: process.env.CLOUDFLARE_API_TOKEN || '',  // MISSING
  },
  cacheMaxAge: parseInt(process.env.CDN_CACHE_MAX_AGE) || 31536000,
  cachePublic: process.env.CDN_CACHE_PUBLIC === 'true',
}
```

**Gap:** Neither `CLOUDFLARE_ZONE_ID` nor `CLOUDFLARE_API_TOKEN` are configured, meaning Cloudflare is **not actively being used** for caching despite being in the config.

---

## Root Cause Analysis (Working Hypotheses)

Based on the 6x latency gap, the following areas require investigation:

### 1. Bundle Size Analysis (HIGH RISK)

- Next.js bundle analyzer recommended in `next.config.mjs` (line 229: `webpackMemoryOptimizations: true`)
- No evidence of bundle optimization in production build
- Large JS bundles increase parse time and execution overhead

### 2. Database Query Latency (HIGH RISK)

- Homepage likely loads auth/session data from Supabase (PostgreSQL)
- N+1 query pattern suspected in initial page load
- No query caching or connection pooling tuning visible in `config/app.config.js`

### 3. Cold Start Latency (MEDIUM RISK)

- First visit to site may trigger Vercel Edge function cold start
- Subsequent requests may warm up but occasional cold starts cause variability
- Not confirmed without distributed tracing

### 4. Asset Loading (MEDIUM RISK)

- Static assets served from public/ directory
- Images may not be properly optimized (WebP/AVIF conversion)
- Font loading strategy may cause FOUT/FOIT

### 5. Missing Caching Strategy (HIGH RISK)

- CDN is configured but **not active** (missing API credentials)
- No ISR (Incremental Static Regeneration) or SSG (Static Site Generation) on core pages
- Every page load hits Vercel Edge functions → database → potentially external APIs

---

## Immediate Actions Required

### P1 — Within 2 Weeks

1. **Audit Homepage Bundle Size**

   ```bash
   ANALYZE=true npm run build
   ```

   - Identify large dependencies (Node modules, third-party libraries)
   - Remove unused packages to reduce initial JS payload
   - Apply code-splitting for routes that can be lazy-loaded

2. **Measure Database Query Performance**
   - Add logging for database queries on page load
   - Identify slow queries using EXPLAIN ANALYZE
   - Implement query caching with Redis (configuring `cacheTtl` in `config/app.config.js`)

3. **Implement CDN Caching**
   - Set up Cloudflare Zone ID and API Token
   - Configure Cloudflare for HTML caching (stale-while-revalidate)
   - Configure caching for static assets (public/images/videos/fonts)
   - Verify cache hit/miss rates via Cloudflare Analytics

4. **Add Vercel Edge Middleware for Early Response**
   - Create `middleware.ts` to send 200 OK headers before full page render
   - Implement basic caching headers
   - Reduce perceived latency (Time to First Byte)

### P2 — Within 1 Month

5. **Implement ISR/SSR Optimization**
   - Configure ISR for cacheable pages (auth-gated routes can use private cache)
   - Set appropriate revalidate times (e.g., 3600s for marketing pages)
   - Reduce database load for repeat visitors

6. **Optimize Asset Delivery**
   - Convert images to WebP/AVIF format
   - Implement responsive images with srcset/picture tags
   - Verify font loading strategy (already self-hosted via next/font, but optimize sizes)

7. **Set Up Automated Latency Monitoring**
   - Create dashboard in Vercel Analytics
   - Alert on P95 latency >250ms
   - Track individual endpoint performance over time
   - Monitor Cold Start frequency vs Warm Start

---

## Recommended Monitoring

### Metrics to Track

| Metric                     | Threshold       | Alert    |
| -------------------------- | --------------- | -------- |
| Homepage Latency (P50)     | <150ms          | Warning  |
| Homepage Latency (P90)     | <200ms          | Warning  |
| Homepage Latency (P95)     | <250ms          | Critical |
| API Endpoint Latency (P95) | <200ms          | Warning  |
| Cold Start Frequency       | <5% of requests | Warning  |
| Cache Hit Rate (CDN)       | >70%            | Warning  |

### Alerting Strategy

- **P95 Latency Threshold:** 250ms (alert when exceeded)
- **Rollback Trigger:** P95 latency >400ms for 5 consecutive requests
- **Failure Gate:** HTTP 5xx errors >0.1%

---

## Validation Strategy

1. **Pre-Optimization Baseline**
   - Record current P50/P90/P95 latencies for all critical endpoints
   - Document bundle size (in bytes)
   - Measure Cold Start frequency

2. **Post-Optimization Verification**
   - Re-run baseline measurement after each optimization
   - Confirm each improvement: 10% reduction in P95 latency
   - Ensure no new regressions introduced

3. **Production Rollout**
   - Deploy changes via Vercel with 100% rollout (no canary for critical performance changes)
   - Monitor P95 latency for 48 hours post-deployment
   - Verify cache hit/miss rates stabilize

---

## Next Steps

1. **Immediate:** Create JIRA ticket for homepage bundle analysis (P1)
2. **Immediate:** Configure Cloudflare Zone ID and API Token for caching
3. **This Week:** Run bundle analyzer on current production build
4. **This Week:** Review database query logs for homepage load

---

## Related Issues

- **PR #786:** Unite-Hub connector rename (shipped July 2026) — may have introduced latency changes, requires review
- **SYN-877:** Previous build-time type-check workaround — ensure optimization doesn't reintroduce type errors
- **Next.js 16.2.0 Bug:** Console-file.js cold start issue — verify resolved in current deployment

---

## Appendix: Files Referenced

- `deployment/rollout-script.js` — CDN cache clearing stub (line 390)
- `vercel.json` — Vercel headers configuration
- `next.config.mjs` — Bundle analyzer and memory optimizations
- `config/app.config.js` — CDN and caching configuration
- `.env.local` (and `.env.production.local`) — Cloudflare credentials (missing)

---

**Document Status:** Baseline Captured — Ready for Optimization Work  
**Next Phase:** Homepage Bundle Analysis + CDN Caching Setup  
**Owner:** Should be assigned to Performance Engineer or DevOps team  
**Approval Required:** Phill for P1 critical performance optimization
