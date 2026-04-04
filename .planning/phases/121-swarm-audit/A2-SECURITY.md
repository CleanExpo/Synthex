# A2 — Security & Infrastructure Audit

Generated: 2026-03-18
Agent: A2 (security-hardener)
Phase-119 baseline: 107 findings

---

## Findings

---

### [A2-FINDING-001] HIGH

```
Status: CONFIRMED-OPEN
Phase-119 ref: FINDING-013 (SECURITY-04)
File: .env.example:416
Issue: NEXT_PUBLIC_BYPASS_TOKEN is still present in .env.example with a non-empty placeholder value ("dev-bypass-token-only"). Phase 120 Sprint 3 claimed removal but the variable persists. The NEXT_PUBLIC_ prefix means any value set here will be baked into the client-side JS bundle at build time.
Fix: Remove the NEXT_PUBLIC_BYPASS_TOKEN line entirely from .env.example. If a dev-only bypass is needed, document it as a comment with no variable assignment, or replace with a server-only variable name (no NEXT_PUBLIC_ prefix).
Linear: CREATE-NEW
```

---

### [A2-FINDING-002] HIGH

```
Status: NEW
Phase-119 ref: N/A
File: app/api/auth/login/route.ts:148-158
Issue: The /api/auth/login POST handler returns the JWT token in the JSON response body only ({"token": "..."}) and never sets an httpOnly auth-token cookie. All other auth flows (signup, OAuth callbacks, unified-login) correctly set an httpOnly cookie. This means clients that use the /login route must store the JWT in localStorage or a non-httpOnly cookie, exposing it to XSS attacks.
Fix: After generating the token (line 100), call response.cookies.set('auth-token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 }) on the NextResponse before returning it — mirroring the pattern in app/api/auth/unified-login/route.ts:57-60.
Linear: CREATE-NEW
```

---

### [A2-FINDING-003] MEDIUM

```
Status: NEW
Phase-119 ref: N/A
File: middleware.ts:11-13 and vercel.json:74
Issue: Both the middleware CSP and the vercel.json CSP include 'unsafe-inline' in script-src. This allows inline scripts to execute, which negates a significant portion of XSS protection offered by CSP. The middleware also adds https://cdn.tailwindcss.com to script-src (a CDN not referenced by vercel.json), widening the trusted script surface.
Fix: Replace 'unsafe-inline' in script-src with a nonce-based or hash-based approach. For Next.js 15, use the experimental nonce support in next.config.mjs. Remove https://cdn.tailwindcss.com from the middleware CSP as it appears to be a development artifact.
Linear: CREATE-NEW
```

---

### [A2-FINDING-004] MEDIUM

```
Status: NEW
Phase-119 ref: N/A
File: middleware.ts:37
Issue: The CORS Access-Control-Allow-Origin header is set to a single static origin (process.env.NEXT_PUBLIC_APP_URL or 'https://synthex.social') on ALL routes including non-API pages. This header is applied globally in middleware before the route matcher has filtered to /api/. For non-API pages it is a no-op but is unnecessarily verbose. More critically, there is no dynamic origin allowlist check — if a second domain (e.g., www.synthex.social) needs access, the current implementation would reject it.
Fix: Restrict the CORS headers to /api/ routes only in the middleware, and implement a dynamic origin-check against CORS_ALLOWED_ORIGINS env var (already defined in .env.example line 670).
Linear: CREATE-NEW
```

---

### [A2-FINDING-005] MEDIUM

```
Status: CONFIRMED-OPEN
Phase-119 ref: FINDING-037 (SECURITY-07)
File: supabase/migrations/ (all files)
Issue: Across all migration files (schema-step2-rls.sql, security_hardening, vault_secrets_management, agent_runs_and_workflow_rls), RLS is explicitly enabled on 16 distinct Supabase-native tables: profiles, personas, content, campaigns, scheduled_posts, analytics, platform_connections, api_usage, notifications, team_members, viral_patterns, agent_runs, agent_task_queue, vault_secrets, vault_access_logs, plus 1 from complete-schema.sql. The Prisma schema contains 131 models. Coverage is approximately 16/131 (~12%). The Phase-119 baseline reported ~7.6% (10/131). Coverage has improved slightly but remains very low. The gap is partially mitigated because most Prisma-managed tables are only accessed through authenticated Next.js API routes (not direct Supabase JS client), but this is an undocumented assumption.
Fix: Formally document which Prisma models are accessed via the Supabase JS client (requiring RLS) versus exclusively via server-side Prisma (where Next.js API-layer auth is the gate). Enable RLS on all tables reachable by the anon key. Track this as a living document.
Linear: CREATE-NEW
```

---

### [A2-FINDING-006] LOW

```
Status: NEW
Phase-119 ref: N/A
File: .env.example:260
Issue: FIELD_ENCRYPTION_KEY has a hardcoded all-zeros placeholder (64 zero characters: "0000...0000"). If a developer copies .env.example to .env.local without changing this value, all OAuth tokens will be "encrypted" with a well-known zero key — providing no meaningful encryption. Similarly ENCRYPTION_KEY (line 399) is also all zeros.
Fix: Replace the zero-value placeholder with a comment instructing the developer to generate a key ("# Run: openssl rand -hex 32"). Do not ship a working but insecure placeholder. Add a startup assertion in lib/security/env-validator.ts that rejects the all-zeros value.
Linear: CREATE-NEW
```

---

### [A2-FINDING-007] LOW

```
Status: NEW
Phase-119 ref: N/A
File: lib/encryption/api-key-encryption.ts:27-41
Issue: Key rotation is version-aware (ENCRYPTION_KEY_V1, ENCRYPTION_KEY_V2 per .env.example lines 83-88) but there is no migration utility to re-encrypt existing records from V1 to V2 when a key is rotated. The vault_secrets migration (20260315000001) tracks encryption_key_version on each row, which is a good foundation, but no automated re-encryption job exists. If ENCRYPTION_KEY_V1 is compromised, there is no safe rotation path.
Fix: Build a cron-triggered or manual re-encryption script that reads all rows with encryption_key_version=1, decrypts with V1, re-encrypts with V2, and updates the row. Gate it behind a CRON_SECRET-authenticated endpoint.
Linear: CREATE-NEW
```

---

### [A2-FINDING-008] LOW

```
Status: CONFIRMED-RESOLVED
Phase-119 ref: N/A
File: app/api/cron/ (all 14 routes)
Issue: All 14 cron routes (health-score, weekly-digest, publish-scheduled, fetch-mentions, insights, proactive-insights, seo-audits, revalidate-api-keys, refresh-tokens, sentinel, unite-hub-revenue, forecast-training, welcome-sequence, analyze-patterns) correctly validate CRON_SECRET via the Authorization: Bearer header before executing. No unprotected cron handlers found.
Fix: N/A — no action required.
Linear: N/A
```

---

### [A2-FINDING-009] LOW

```
Status: NEW
Phase-119 ref: N/A
File: app/api/auth/login/route.ts and app/api/auth/signup/route.ts
Issue: Both auth mutation routes correctly use authStrict (5 req/min per IP via Upstash Redis). The AI content generation route (app/api/ai/generate-content/route.ts) uses withRateLimit from lib/middleware/rate-limiter.ts. Rate limiting is confirmed present on all three sampled routes.
Fix: N/A — confirmed working. Document rate limiting tiers in CLAUDE.md as verified.
Linear: N/A
```

---

### [A2-FINDING-010] MEDIUM

```
Status: NEW
Phase-119 ref: N/A
File: lib/auth/jwt-utils.ts:46-49
Issue: Owner email addresses (phill.mcgurk@gmail.com and phill.mcgurk+test1@gmail.com) are hardcoded in source code as a ReadonlySet. These emails receive full platform bypass including skipping onboarding and API key gates. Hardcoded owner emails in source create two risks: (1) the owner's email is public in the repository, and (2) changing the owner email requires a code deploy rather than a configuration change.
Fix: Move owner emails to an environment variable (e.g., OWNER_EMAILS=email1,email2) and parse at startup. This removes personal data from the codebase and allows rotation without a deploy.
Linear: CREATE-NEW
```

---

### [A2-FINDING-011] LOW

```
Status: NEW
Phase-119 ref: N/A
File: .env.example:769-770
Issue: NEXT_PUBLIC_CRON_SECRET is defined in .env.example ("# Public cron secret for client-triggered cron calls"). Any value set here would be bundled into client-side JS. Cron secrets must never be NEXT_PUBLIC_. The comment acknowledges preferring server-only CRON_SECRET but the variable definition is present and could be accidentally populated.
Fix: Remove the NEXT_PUBLIC_CRON_SECRET variable definition from .env.example entirely. Add a validation warning in lib/security/env-validator.ts that errors if NEXT_PUBLIC_CRON_SECRET is set to a non-empty value.
Linear: CREATE-NEW
```

---

### [A2-FINDING-012] LOW

```
Status: NEW
Phase-119 ref: N/A
File: package.json
Issue: Conceptual CVE surface assessment based on knowledge as of early 2026. The following packages warrant monitoring: (a) jsonwebtoken ^9.0.2 — has had past algorithm confusion vulnerabilities; current 9.x line is patched but any downgrade or misconfiguration is risky; (b) axios ^1.11.0 — SSRF and header injection vulnerabilities have appeared in 1.x line; (c) ws ^8.14.0 — DoS vulnerability CVE-2024-37890 affected versions prior to 8.17.1; the range ^8.14.0 may resolve to a vulnerable version depending on lockfile state; (d) react-markdown ^9.0.0 — XSS risks if allowDangerousHtml is enabled (not confirmed used here). Note: this is a knowledge-based conceptual assessment, not a live npm audit run.
Fix: Run npm audit and review the lockfile for ws specifically. Pin ws to >=8.17.1 explicitly in package.json to guarantee the patched version is used.
Linear: CREATE-NEW
```

---

## Summary

| Severity  | Count  | Statuses                    |
| --------- | ------ | --------------------------- |
| CRITICAL  | 0      | —                           |
| HIGH      | 2      | 1 CONFIRMED-OPEN, 1 NEW     |
| MEDIUM    | 4      | 1 CONFIRMED-OPEN, 3 NEW     |
| LOW       | 6      | 1 CONFIRMED-RESOLVED, 5 NEW |
| **Total** | **12** |                             |

### By Status

| Status             | Count |
| ------------------ | ----- |
| NEW                | 9     |
| CONFIRMED-OPEN     | 2     |
| CONFIRMED-RESOLVED | 1     |
| REGRESSION         | 0     |

### Key Observations

1. **SECURITY-04 (NEXT_PUBLIC_BYPASS_TOKEN)** — CONFIRMED-OPEN. Phase 120 Sprint 3 did not remove this variable from `.env.example`. It appears at line 416 with the value `dev-bypass-token-only`. Immediate action required.

2. **Auth cookie gap on /api/auth/login** — The primary email/password login route is the only auth endpoint that does NOT set an httpOnly cookie. All OAuth, signup, unified-login, and refresh endpoints do set the cookie correctly. This asymmetry means email/password users are likely storing JWT in localStorage on the client, negating httpOnly XSS protection.

3. **CSP unsafe-inline** — Both middleware.ts and vercel.json ship `unsafe-inline` in script-src. This is a known future hardening target but represents a meaningful XSS risk surface reduction opportunity.

4. **CRON_SECRET enforcement** — All 14 cron routes correctly validate the secret. No regressions found here.

5. **Rate limiting** — Login, signup, and AI content generation all have rate limiting applied. Confirmed working pattern.

6. **RLS coverage** — Improved from ~7.6% (Phase 119) to ~12% (16/131 models) due to Phase 120 migrations. Still very low. Mitigation is that Prisma-only tables go through authenticated API routes, but this is undocumented.

7. **Zero-value encryption key placeholder** — The all-zeros placeholder for FIELD_ENCRYPTION_KEY and ENCRYPTION_KEY in .env.example is a silent footgun for new developers who copy the file without reading it carefully.

8. **Owner email hardcoded in source** — Personal email addresses are committed in lib/auth/jwt-utils.ts. Should be moved to env vars.

### Phase-119 SECURITY Findings Status

| Finding                   | Description                              | Status                                                      |
| ------------------------- | ---------------------------------------- | ----------------------------------------------------------- |
| FINDING-013 (SECURITY-04) | NEXT_PUBLIC_BYPASS_TOKEN in .env.example | CONFIRMED-OPEN                                              |
| FINDING-037 (SECURITY-07) | RLS policy coverage ~7.6% of 131 models  | CONFIRMED-OPEN (improved to ~12%)                           |
| FINDING-071 (SECURITY-08) | No supabase/migrations/ for RLS tracking | CONFIRMED-RESOLVED (migrations dir now exists with 5 files) |
