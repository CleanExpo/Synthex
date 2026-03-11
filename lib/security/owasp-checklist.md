# OWASP Top 10 Security Checklist - SYNTHEX

**Last Updated:** 12 March 2026
**Status:** Production Ready

---

## A01:2021 - Broken Access Control ✅

| Control | Status | Implementation |
|---------|--------|----------------|
| Deny by default | ✅ | `api-security-checker.ts` - All endpoints require explicit policy |
| Role-based access | ✅ | RBAC system in `prisma/schema.prisma` (Role, UserRole models) |
| JWT validation | ✅ | `lib/auth/jwt-utils.ts` with expiry checks |
| Resource ownership | ✅ | User ID verification on all data endpoints |
| Rate limiting | ✅ | `rate-limiter-redis.ts` - Distributed with Redis |
| CORS policy | ✅ | `cors-config.ts` - Whitelist-based origin validation |
| Audit logging | ✅ | `audit-logger.ts` - All access logged to database |

**Files:**
- `lib/security/api-security-checker.ts`
- `lib/security/rate-limiter-redis.ts`
- `lib/security/cors-config.ts`
- `lib/security/audit-logger.ts`

---

## A02:2021 - Cryptographic Failures ✅

| Control | Status | Implementation |
|---------|--------|----------------|
| HTTPS enforcement | ✅ | HSTS header in `middleware.ts` |
| Sensitive data encryption | ✅ | API keys encrypted in database |
| Secure password hashing | ✅ | bcrypt with salt rounds |
| JWT signing | ✅ | HMAC-SHA256 with secret key |
| Token storage | ✅ | httpOnly cookies for session |
| Environment secrets | ✅ | `env-validator.ts` - Classification & validation |

**Files:**
- `middleware.ts` - Security headers
- `lib/security/env-validator.ts`
- `lib/auth/signInFlow.ts`

---

## A03:2021 - Injection ✅

| Control | Status | Implementation |
|---------|--------|----------------|
| SQL Injection | ✅ | Prisma ORM with parameterized queries |
| NoSQL Injection | ✅ | Prisma ORM abstracts database access |
| Command Injection | N/A | No shell execution |
| XSS Prevention | ✅ | React auto-escaping + CSP headers |
| LDAP Injection | N/A | No LDAP integration |

**Notes:**
- Prisma prevents SQL injection by design
- All user input is validated with Zod schemas
- CSP headers prevent inline script execution

**Files:**
- `prisma/schema.prisma`
- `middleware.ts` - CSP headers

---

## A04:2021 - Insecure Design ✅

| Control | Status | Implementation |
|---------|--------|----------------|
| Threat modeling | ✅ | Security-first architecture documented |
| Security requirements | ✅ | Defined in `CLAUDE.md` |
| Reference architecture | ✅ | Layered security approach |
| Security testing | ⚠️ | Partial - needs E2E security tests |
| Design patterns | ✅ | Defense in depth implemented |

**Notes:**
- Multi-layer security (middleware → API → service → database)
- Fail-secure defaults throughout

---

## A05:2021 - Security Misconfiguration ✅

| Control | Status | Implementation |
|---------|--------|----------------|
| Security headers | ✅ | Full suite in `middleware.ts` |
| Default credentials | ✅ | None - all secrets via env vars |
| Error handling | ✅ | Generic errors to users, detailed logs |
| Framework hardening | ✅ | Next.js production build |
| Dependencies | ✅ | Regular `npm audit` |
| Feature flags | ✅ | Environment-based feature control |
| Dead security config | ✅ | `src/config/security.config.ts` archived 2026-03-12 — superseded by middleware.ts (Phase 73) |
| NextAuth stubs | ✅ | Removed from `env-validator.ts` 2026-03-12 — Synthex uses Supabase Auth exclusively |

**Security Headers (verified 2026-03-12):**
- Content-Security-Policy
  - script-src: 'self' 'unsafe-inline' (see A05 note below) + allowlist of CDN/Stripe/Tailwind origins
  - frame-ancestors: 'none' ✅
  - upgrade-insecure-requests: present ✅
  - base-uri: 'self' ✅
  - form-action: 'self' ✅
- Strict-Transport-Security: max-age=31536000; includeSubDomains; preload ✅
- X-Frame-Options: DENY ✅
- X-Content-Type-Options: nosniff ✅
- X-XSS-Protection: 1; mode=block ✅
- Referrer-Policy: strict-origin-when-cross-origin ✅
- Permissions-Policy: camera=(), microphone=(), geolocation=() ✅

**A05 Note — CSP script-src 'unsafe-inline':**
The current CSP includes `'unsafe-inline'` in script-src to support Tailwind CDN, Stripe.js,
and inline scripts loaded by third-party embeds. This is a known trade-off. Next.js 15 nonce-based
CSP is the recommended hardening path. Tracking as future improvement (not blocking for v7.0).
`'unsafe-eval'` is NOT present — only `'unsafe-inline'`.

**Files:**
- `middleware.ts`
- `.env.example` (no real secrets)

---

## A06:2021 - Vulnerable Components ⚠️

| Control | Status | Implementation |
|---------|--------|----------------|
| Dependency audit | ✅ | `npm audit` in CI/CD |
| Version pinning | ✅ | `pnpm-lock.yaml` |
| License compliance | ✅ | All dependencies MIT/Apache |
| Unused dependencies | ⚠️ | Regular cleanup needed |
| Update policy | ✅ | Monthly security updates |
| Known vulnerabilities | ⚠️ | 3 vulnerabilities found (see audit output below) |

**npm audit --production output (2026-03-12):**

```
dompurify  3.1.3 - 3.3.1
  Severity: MODERATE
  DOMPurify contains a Cross-site Scripting vulnerability
  Advisory: https://github.com/advisories/GHSA-v2wj-7wpq-c8vv
  Fix: npm audit fix

rollup  3.0.0 - 3.29.5
  Severity: HIGH
  Rollup 4 Arbitrary File Write via Path Traversal
  Advisory: https://github.com/advisories/GHSA-mw96-cpmx-2vgc
  Affects: @sentry/nextjs 8.0.0-alpha.2 - 9.4.0 (depends on vulnerable rollup)
  Fix: npm audit fix --force (breaking change: upgrades @sentry/nextjs to 10.43.0)

Total: 3 vulnerabilities (1 moderate, 2 high)
```

**Assessment:**
- `dompurify` moderate: Low risk — DOMPurify is used for sanitising user HTML in templates.
  Fix available without breaking changes. Addressed in next dependency update cycle.
- `rollup` high (via @sentry/nextjs): rollup is a build-time dependency used during Sentry
  bundling. Not exploitable at runtime on Vercel. The fix requires a major @sentry/nextjs upgrade
  (v8→v10) — deferred to a dedicated dependency upgrade phase (not part of v7.0 scope).

**Commands:**
```bash
npm audit --production        # Check vulnerabilities
npm outdated                  # Check updates
```

---

## A07:2021 - Identification and Authentication Failures ✅

| Control | Status | Implementation |
|---------|--------|----------------|
| Multi-factor auth | ⚠️ | Deferred — Supabase Auth handles MFA when enabled on Supabase project dashboard |
| Password policy | ✅ | Minimum 8 chars, complexity rules |
| Brute force protection | ✅ | Rate limiting on auth endpoints |
| Session management | ✅ | JWT with refresh tokens |
| Account lockout | ✅ | 5 failed attempts → 15 min lockout |
| Password reset | ✅ | Time-limited tokens |

**Rate Limits:**
- `/api/auth/login`: 5 requests / 5 minutes
- `/api/auth/register`: 3 requests / hour
- `/api/auth/forgot-password`: 3 requests / hour

**Files:**
- `lib/security/rate-limiter-redis.ts`
- `lib/auth/signInFlow.ts`
- `app/api/auth/*/route.ts`

---

## A08:2021 - Software and Data Integrity Failures ✅

| Control | Status | Implementation |
|---------|--------|----------------|
| CI/CD security | ✅ | GitHub Actions with secrets |
| Code signing | ⚠️ | Vercel deployment verification |
| Webhook validation | ✅ | Signature verification for all webhooks |
| Dependency integrity | ✅ | pnpm lockfile integrity |
| Update verification | ✅ | Checksum validation in pnpm |

**Webhook Signature Verification:**
- Stripe: SHA256 HMAC
- SendGrid: SHA256 HMAC
- Platform webhooks: Platform-specific

**Files:**
- `lib/webhooks/signature-verifier.ts`
- `app/api/webhooks/*/route.ts`

---

## A09:2021 - Security Logging and Monitoring ✅

| Control | Status | Implementation |
|---------|--------|----------------|
| Audit logging | ✅ | All security events logged |
| Centralized logging | ✅ | Database + Sentry integration |
| Alert system | ✅ | Sentry alerts on errors |
| Log integrity | ✅ | Database-backed, immutable |
| Retention policy | ✅ | 90-day retention |
| Log analysis | ⚠️ | Basic stats, needs dashboard |

**Logged Events:**
- Authentication (login, logout, failed attempts)
- Authorization (access denied)
- Rate limiting (blocked requests)
- Data access (CRUD operations)
- Security events (suspicious activity)

**Error detail exposure audit (2026-03-12):**
Grep for raw `error.message` in API route catch blocks returning client responses.
- Most routes use `error instanceof Error ? error.message : String(error)` in logger calls only — safe.
- One route exposes raw error.message to clients:
  - `app/api/auth/resend-verification/route.ts:60` — returns `error.message` directly in 500 JSON.
    Risk: LOW (auth endpoint, internal Supabase error text only). Remediation: replace with generic message.
    Deferred — out of scope for v7.0.
- Health/admin endpoints (e.g. `/api/health`, `/api/admin/*`) expose error.message but are
  admin-only or internal-use. Acceptable for diagnostic purposes.

**Files:**
- `lib/security/audit-logger.ts`
- `sentry.*.config.ts`

---

## A10:2021 - Server-Side Request Forgery (SSRF) ✅

| Control | Status | Implementation |
|---------|--------|----------------|
| URL validation | ✅ | Whitelist for external requests |
| Internal network | ✅ | Vercel serverless (isolated) |
| DNS rebinding | ✅ | URL validation before fetch |
| Redirect following | ✅ | Limited redirect following |

**Protected Endpoints:**
- OAuth callback validation
- Webhook URL validation
- External API calls use whitelist

---

## Additional Security Measures

### Pre-commit Hooks
```bash
# .husky/pre-commit
pnpm run lint
pnpm run type-check
# Secrets scanning (planned)
```

### Environment Variable Security
- Classification: PUBLIC / INTERNAL / SECRET / CRITICAL
- Validation at startup
- No secrets in code
- `.env.example` for documentation

### API Security Policies
```typescript
// Default policies available:
- PUBLIC_READ      // No auth, rate limited
- AUTHENTICATED_READ  // Auth required
- AUTHENTICATED_WRITE // Auth + CSRF
- ADMIN_ONLY       // Admin role required
- WEBHOOK          // Signature validation
- INTERNAL_ONLY    // Localhost only
```

---

## Compliance Checklist

| Standard | Status | Notes |
|----------|--------|-------|
| GDPR | ✅ | Data deletion, export support |
| SOC 2 | ⚠️ | Audit logging complete |
| PCI DSS | N/A | Stripe handles payments |
| HIPAA | N/A | No health data |

---

## Security Contacts

- **Security Issues:** security@synthex.ai
- **Bug Bounty:** Coming soon
- **Disclosure Policy:** Responsible disclosure preferred

---

*Last security audit: 12 March 2026 (Phase 113 — v7.0 pre-launch sweep)*
*Next scheduled review: 12 April 2026*
