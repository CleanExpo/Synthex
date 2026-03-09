# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Synthex, please report it responsibly.

**Do not** open a public GitHub issue for security vulnerabilities.

**Contact:** security@synthex.social

We will acknowledge your report within 48 hours and aim to release a patch within 14 days of confirmation.

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested mitigations

## Pre-Launch Security Checklist

Before going live, verify all of the following:

### Secrets Rotation
- [ ] NEXTAUTH_SECRET rotated from any dev/test value
- [ ] SUPABASE_SERVICE_ROLE_KEY is production-only (never in client-side code)
- [ ] OPENROUTER_API_KEY is production key
- [ ] STRIPE_SECRET_KEY is live key (sk_live_*), not test key
- [ ] STRIPE_WEBHOOK_SECRET matches live-mode webhook endpoint
- [ ] All social OAuth app credentials (Facebook, Instagram, Twitter, LinkedIn, TikTok, YouTube, Pinterest, Snapchat) are production credentials
- [ ] SENTRY_AUTH_TOKEN and SENTRY_DSN are production project values
- [ ] RESEND_API_KEY is verified production domain key
- [ ] No .env.local committed to git (`git log --oneline -- .env.local`)

### Infrastructure
- [ ] Vercel project environment variables set for production, preview, and development
- [ ] Supabase Row Level Security (RLS) enabled on all tables
- [ ] Supabase service role key never exposed to browser
- [ ] Redis (Upstash) TLS enabled
- [ ] Custom domain verified and HTTPS enforced

### Application Security
- [ ] CSP header: no 'unsafe-eval' in script-src
- [ ] HSTS: max-age=31536000; includeSubDomains; preload
- [ ] X-Frame-Options: DENY
- [ ] X-Content-Type-Options: nosniff
- [ ] All auth routes rate-limited (authStrict: 5 req/min)
- [ ] Webhook endpoints validate signatures (Stripe, social platforms)
- [ ] CSRF protection active (origin check + double-submit cookie)
- [ ] All API mutations require Zod validation
- [ ] No org-cross-contamination: all DB queries scoped to authenticated userId/orgId

### Monitoring
- [ ] Sentry DSN configured and receiving errors in production project
- [ ] Sentry cron monitors active for scheduled jobs
- [ ] Vercel deployment notifications enabled
- [ ] Health endpoint (/api/health) returning 200

## Security Features in Place

| Feature | Implementation |
|---------|---------------|
| Content Security Policy | `middleware.ts` — strict CSP headers on all responses |
| HSTS | `middleware.ts` — 1-year HSTS with preload |
| Rate Limiting | `lib/rate-limit/` — per-route presets (5–120 req/min) |
| CSRF Protection | `middleware.ts` — origin check + double-submit cookie |
| Auth Guard | `middleware.ts` — Supabase session + custom auth-token |
| API Key Gate | `lib/middleware/api-key-gate.edge.ts` — Edge-compatible AI key gate |
| Webhook Verification | Stripe: HMAC-SHA256; platforms: signature headers |
| Data Encryption | `lib/encryption/` — API keys encrypted at rest |
| Audit Logging | `lib/audit/` — mutations logged with userId + IP |
| Zod Validation | All API routes use APISecurityChecker + schema validation |
| Org Scoping | All DB queries scoped to authenticated organisation |
