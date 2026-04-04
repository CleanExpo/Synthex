# 121-FINDINGS.md — Phase 121 Swarm Audit Delta

Generated: 2026-03-18
Agent: B1 (consolidator)
Scope: NEW and REGRESSION findings only (not previously in Phase 119)
Total Phase-119 findings: 107

---

## CRITICAL

```
[A4-FINDING-011] CRITICAL
Status: NEW
Phase-119 ref: N/A (new)
File: components/dashboard/tabs/analytics-tab.tsx:35
Issue: BarChart3 placeholder icon uses text-white/10 (~1.1:1); fails WCAG SC 1.4.11 (3:1 minimum for non-text UI components).
Fix: Change text-white/10 to text-white/50 on the icon element.
Linear: CREATE-NEW
```

---

## HIGH

```
[A5-FINDING-001] HIGH
Status: REGRESSION
Phase-119 ref: N/A (puppeteer-screen-recorder claimed resolved in Phase 120 Sprint 3)
File: lib/video/capture-service.ts:28
Issue: Phase 120 Sprint 3 removed puppeteer-screen-recorder from package.json but lib/video/capture-service.ts:28 still contains a live dynamic import('puppeteer-screen-recorder') call — throws MODULE_NOT_FOUND at runtime on any video capture code path.
Fix: Remove the dynamic import and replace with a throw new Error('Video capture not available in this environment') guard, or re-add the package as an optional dependency with a runtime guard.
Linear: CREATE-NEW
```

```
[A2-FINDING-002] HIGH
Status: NEW
Phase-119 ref: N/A (new)
File: app/api/auth/login/route.ts:148-158
Issue: The /api/auth/login POST handler returns the JWT in the JSON response body only and never sets an httpOnly auth-token cookie; all other auth flows (signup, OAuth, unified-login) correctly set an httpOnly cookie, meaning email/password users must store the JWT in localStorage, exposing it to XSS.
Fix: After generating the token call response.cookies.set('auth-token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 }) on the NextResponse before returning, mirroring the pattern in app/api/auth/unified-login/route.ts:57-60.
Linear: CREATE-NEW
```

```
[A1-FINDING-005] HIGH
Status: NEW
Phase-119 ref: N/A (new — analytics route org-scoping is a different finding from FINDING-024/ROUTE-12 which was already in Phase 119)
File: app/api/analytics/route.ts:89-92
Issue: GET handler fetches campaign IDs via where: { userId } with no organizationId scoping, returning analytics data for campaigns across all orgs the user belongs to; the campaigns route correctly uses getEffectiveQueryFilter(userId) but the analytics route bypasses this entirely.
Fix: Replace where: { userId } with await getEffectiveQueryFilter(userId) (same pattern as campaigns/route.ts) and add the zero-key guard to deny rather than expose cross-tenant data.
Linear: CREATE-NEW
```

Note: FINDING-024 (ROUTE-12) in Phase 119 identified this same analytics org-scoping issue. A1-FINDING-005 is therefore CONFIRMED-OPEN rather than strictly NEW; it is listed here because A1 confirmed the fix was not applied in Phase 120.

```
[A3-FINDING-016] HIGH
Status: NEW
Phase-119 ref: N/A (new)
File: app/dashboard/admin/layout.tsx:18
Issue: Server layout imports Prisma directly (import prisma from '@/lib/prisma') and executes a prisma.user.findUnique() call in the layout body, skipping the lib/auth/ service abstraction, duplicating auth-guard logic, and making the layout untestable without a live DB.
Fix: Extract the owner-verification query into a lib/auth/ service function (e.g. verifyOwnerOrRedirect(token)) and call that from the layout instead of calling Prisma directly.
Linear: CREATE-NEW
```

```
[A4-FINDING-012] HIGH
Status: NEW
Phase-119 ref: N/A (new)
File: components/dashboard/tabs/analytics-tab.tsx:36
Issue: "Engagement Over Time" chart label uses text-white/30 at text-xs (~2.1:1 contrast ratio); this is visible content, not decorative, and fails WCAG AA 4.5:1 for normal text.
Fix: Change text-white/30 to text-white/70 (~4.6:1).
Linear: CREATE-NEW
```

```
[A4-FINDING-013] HIGH
Status: NEW
Phase-119 ref: N/A (new)
File: components/ui/prompt-input.tsx:168
Issue: "Shift+Enter for new line" keyboard hint text uses text-white/20 at text-[10px] (~1.5:1 contrast ratio); visible on sm+ breakpoints and is actionable guidance text.
Fix: Change text-white/20 to text-white/60 (~3.7:1).
Linear: CREATE-NEW
```

```
[A4-FINDING-014] HIGH
Status: NEW
Phase-119 ref: N/A (new)
File: components/ui/prompt-input.tsx:158
Issue: Attach-file icon button uses text-white/40 (~2.5:1) in default state; as an interactive control WCAG SC 1.4.11 requires 3:1 for non-text contrast.
Fix: Raise to text-white/50 or apply the same fix as the ghost button variant (FINDING-008 / A4-FINDING-008).
Linear: CREATE-NEW
```

```
[A4-FINDING-015] HIGH
Status: NEW
Phase-119 ref: N/A (new)
File: components/dashboard/QuickPostModal.tsx:203
Issue: Quick-post textarea uses placeholder:text-white/30 (~2.1:1 contrast ratio), the same failing value as the original unfixed prompt-input placeholder from Phase 119.
Fix: Change placeholder:text-white/30 to placeholder:text-white/50.
Linear: CREATE-NEW
```

```
[A4-FINDING-016] HIGH
Status: NEW
Phase-119 ref: N/A (new)
File: components/dashboard/QuickPostModal.tsx:206
Issue: Remaining character counter defaults to text-white/20 (~1.5:1) when not near limit; informational readable text at small size.
Fix: Change text-white/20 to text-white/50 for the default (non-warning) state.
Linear: CREATE-NEW
```

```
[A4-FINDING-017] HIGH
Status: NEW
Phase-119 ref: N/A (new — FINDING-010 covers only line 279)
File: components/dashboard/SystemPulsePanel.tsx:178
Issue: Service URL text uses text-white/20 at font-mono text-[10px] (~1.5:1 contrast ratio); displays actual endpoint URLs that users need to read.
Fix: Change text-white/20 to text-white/50.
Linear: CREATE-NEW
```

```
[A4-FINDING-019] HIGH
Status: NEW
Phase-119 ref: N/A (new — FINDING-011 covers only line 136)
File: components/dashboard/UniteHubWidget.tsx:199
Issue: "No events yet" empty-state informational text uses text-white/20 (~1.5:1 contrast ratio).
Fix: Change text-white/20 to text-white/50.
Linear: CREATE-NEW
```

```
[A4-FINDING-020] HIGH
Status: NEW
Phase-119 ref: N/A (new)
File: components/dashboard/WelcomeCard.tsx:337
Issue: "Re-run Analysis" and "Edit Settings" action links use text-white/30 (~2.1:1 contrast); WCAG AA requires 4.5:1 for interactive link text not distinguished by colour alone.
Fix: Change text-white/30 to text-white/70 for interactive links.
Linear: CREATE-NEW
```

```
[A4-FINDING-021] HIGH
Status: NEW
Phase-119 ref: N/A (new)
File: components/dashboard/WelcomeCard.tsx:337
Issue: Informational span in the footer uses text-white/20 (~1.5:1 contrast ratio).
Fix: Change text-white/20 to text-white/50.
Linear: CREATE-NEW
```

```
[A4-FINDING-022] HIGH
Status: NEW
Phase-119 ref: N/A (new)
File: components/dashboard/get-started-checklist.tsx:303
Issue: "Dismiss" action button text uses text-white/20 (~1.5:1 contrast ratio); interactive action.
Fix: Change text-white/20 to text-white/50.
Linear: CREATE-NEW
```

```
[A4-FINDING-023] HIGH
Status: NEW
Phase-119 ref: N/A (new — FINDING-029 covers only the search placeholder)
File: app/dashboard/layout.tsx:537
Issue: Sidebar navigation links use text-white/30 (~2.1:1 contrast) as default state; these are core navigation elements requiring 4.5:1 for link text.
Fix: Change text-white/30 to text-white/60 as default; text-white/80 on hover.
Linear: CREATE-NEW
```

```
[A4-FINDING-024] HIGH
Status: NEW
Phase-119 ref: N/A (new)
File: app/dashboard/layout.tsx:490
Issue: Sidebar notification/action icon buttons use text-white/30 (~2.1:1) as default; WCAG SC 1.4.11 requires 3:1 for UI component icons.
Fix: Change text-white/30 to text-white/50.
Linear: CREATE-NEW
```

---

## MEDIUM

```
[A1-FINDING-009] MEDIUM
Status: NEW
Phase-119 ref: N/A (new)
File: app/api/example/redis-demo/route.ts
Issue: Deprecated route with no active callers accepts anonymous requests (withSession stub falls through to session.user.id = 'anonymous') and writes Redis keys prefixed with demo:anonymous:, making it a live unauthenticated Redis write endpoint reachable in production.
Fix: Move file to .claude/archived/2026-03-18/ and remove the route; it is already marked @deprecated with zero active callers.
Linear: CREATE-NEW
```

```
[A1-FINDING-011] MEDIUM
Status: NEW
Phase-119 ref: N/A (new)
File: app/api/listening/route.ts, app/api/listening/keywords/route.ts, app/api/listening/mentions/route.ts
Issue: All three social listening routes scope queries to userId only; TrackedKeyword and SocialMention models have no organizationId field, so switching orgs does not isolate listening data in a multi-org context.
Fix: Evaluate whether listening data should be org-scoped; if yes, add organizationId to TrackedKeyword and SocialMention models and update query filters (requires schema migration with human approval).
Linear: CREATE-NEW
```

```
[A2-FINDING-003] MEDIUM
Status: NEW
Phase-119 ref: N/A (new)
File: middleware.ts:11-13 and vercel.json:74
Issue: Both the middleware CSP and the vercel.json CSP include 'unsafe-inline' in script-src, negating a significant portion of XSS protection; middleware also adds https://cdn.tailwindcss.com to script-src (a CDN not in vercel.json), widening the trusted script surface.
Fix: Replace 'unsafe-inline' in script-src with a nonce-based or hash-based approach using Next.js 15 experimental nonce support; remove https://cdn.tailwindcss.com from middleware CSP as a development artifact.
Linear: CREATE-NEW
```

```
[A2-FINDING-004] MEDIUM
Status: NEW
Phase-119 ref: N/A (new)
File: middleware.ts:37
Issue: CORS Access-Control-Allow-Origin header is set to a single static origin on ALL routes including non-API pages; there is no dynamic origin allowlist check against CORS_ALLOWED_ORIGINS (already defined in .env.example:670).
Fix: Restrict CORS headers to /api/ routes only in middleware and implement dynamic origin-check against CORS_ALLOWED_ORIGINS env var.
Linear: CREATE-NEW
```

```
[A2-FINDING-010] MEDIUM
Status: NEW
Phase-119 ref: N/A (new)
File: lib/auth/jwt-utils.ts:46-49
Issue: Owner email addresses (phill.mcgurk@gmail.com and phill.mcgurk+test1@gmail.com) are hardcoded in source as a ReadonlySet, making personal data public in the repository and requiring a code deploy to rotate the owner email.
Fix: Move owner emails to an environment variable (e.g. OWNER_EMAILS=email1,email2) parsed at startup.
Linear: CREATE-NEW
```

```
[A3-FINDING-017] MEDIUM
Status: NEW
Phase-119 ref: N/A (new)
File: app/dashboard/integrations/page.tsx:11
Issue: Dashboard page ('use client') imports integrationsAPI from @/lib/api/settings directly in a page component, bypassing the hooks layer; the correct pattern is page → hook → lib/api.
Fix: Move the integrationsAPI calls into the existing hooks/use-third-party-integrations.ts hook or a new dedicated hook.
Linear: CREATE-NEW
```

```
[A4-FINDING-018] MEDIUM
Status: NEW
Phase-119 ref: N/A (new — FINDING-010 covers only line 279)
File: components/dashboard/SystemPulsePanel.tsx:214
Issue: Service last-checked timestamp uses text-white/20 at text-[9px] font-mono (~1.5:1 contrast ratio); informational timestamp text.
Fix: Change text-white/20 to text-white/45.
Linear: CREATE-NEW
```

```
[A4-FINDING-025] MEDIUM
Status: NEW
Phase-119 ref: N/A (new)
File: components/dashboard/tabs/analytics-tab.tsx:44,46
Issue: "Platform Breakdown" section label and "No platform data yet" empty-state text both use text-white/25 (~1.8:1 contrast ratio); user-readable content.
Fix: Change text-white/25 to text-white/50 for section labels; text-white/60 for body text.
Linear: CREATE-NEW
```

```
[A4-FINDING-026] MEDIUM
Status: NEW
Phase-119 ref: N/A (new)
File: components/insights/InsightsWidget.tsx:137
Issue: "High-confidence opportunities are auto-drafted to your content queue." helper text uses text-white/30 (~2.1:1 contrast ratio).
Fix: Change text-white/30 to text-white/60.
Linear: CREATE-NEW
```

```
[A4-FINDING-027] MEDIUM
Status: NEW
Phase-119 ref: N/A (new)
File: components/dashboard/ContentSuggestionsWidget.tsx:110
Issue: Edit action button on content suggestions uses text-white/30 (~2.1:1 contrast ratio); when visible on hover it must still meet contrast requirements.
Fix: Change text-white/30 to text-white/60 on hover-visible actions.
Linear: CREATE-NEW
```

```
[A4-FINDING-028] MEDIUM
Status: NEW
Phase-119 ref: N/A (new)
File: app/dashboard/platforms/page.tsx:167,188
Issue: Platform description text and "not connected" state indicator text both use text-white/25 (~1.8:1 contrast ratio); these communicate platform status.
Fix: Change text-white/25 to text-white/50 for descriptive/status text.
Linear: CREATE-NEW
```

```
[A4-FINDING-029] MEDIUM
Status: NEW
Phase-119 ref: N/A (new)
File: components/ui/button.tsx:7
Issue: Focus-visible ring uses ring-white/30 (~2.1:1 contrast against dark backgrounds); WCAG SC 1.4.11 and 2.4.11 require focus indicator to have at least 3:1 contrast against adjacent colours.
Fix: Change focus-visible:ring-white/30 to focus-visible:ring-white/60 or focus-visible:ring-cyan-400/70.
Linear: CREATE-NEW
```

```
[A5-FINDING-013] MEDIUM
Status: NEW
Phase-119 ref: N/A (new)
File: next.config.mjs
Issue: typescript.ignoreBuildErrors: true and eslint.ignoreDuringBuilds: true are both set, meaning TypeScript errors and ESLint violations will not block a Vercel deploy; broken code can silently reach production.
Fix: Enable typescript.ignoreBuildErrors: false with a memory-optimised tsconfig or use a mandatory GitHub Actions gate before merge rather than relying on Vercel build checks.
Linear: CREATE-NEW
```

---

## LOW

```
[A1-FINDING-012] LOW
Status: NEW
Phase-119 ref: N/A (new)
File: app/api/audience/insights/route.ts
Issue: If getEffectiveOrganizationId(userId) returns null the query uses organizationId: null, which may still return connections with no org set; the null case is not guarded with a denial path.
Fix: Add a null-org guard — if organizationId is null and the user belongs to an organisation, return 403 rather than querying with null.
Linear: CREATE-NEW
```

```
[A1-FINDING-013] LOW
Status: NEW
Phase-119 ref: N/A (new)
File: app/api/predict/trends/route.ts:87-90
Issue: GET handler (and POST at line 173) returns 403 for unauthenticated requests instead of 401, failing to differentiate "no auth" (401) from "insufficient permissions" (403); sentinel/alerts/route.ts correctly returns 401 when error is 'Authentication required'.
Fix: Change status 403 to security.error === 'Authentication required' ? 401 : 403 in both handlers, matching the pattern in sentinel/alerts/route.ts.
Linear: CREATE-NEW
```

```
[A2-FINDING-006] LOW
Status: NEW
Phase-119 ref: N/A (new)
File: .env.example:260
Issue: FIELD_ENCRYPTION_KEY has a hardcoded all-zeros placeholder (64 zero characters) and ENCRYPTION_KEY (line 399) is also all zeros; if a developer copies .env.example without changing these values, OAuth tokens are "encrypted" with a well-known zero key providing no meaningful encryption.
Fix: Replace the zero-value placeholder with a comment instructing key generation ("# Run: openssl rand -hex 32") and add a startup assertion in lib/security/env-validator.ts that rejects the all-zeros value.
Linear: CREATE-NEW
```

```
[A2-FINDING-007] LOW
Status: NEW
Phase-119 ref: N/A (new)
File: lib/encryption/api-key-encryption.ts:27-41
Issue: Key rotation is version-aware (ENCRYPTION_KEY_V1/V2) but there is no migration utility to re-encrypt existing records when a key is rotated; if ENCRYPTION_KEY_V1 is compromised there is no safe rotation path.
Fix: Build a cron-triggered or manual re-encryption script that reads all rows with encryption_key_version=1, decrypts with V1, re-encrypts with V2, and updates the row, gated behind a CRON_SECRET-authenticated endpoint.
Linear: CREATE-NEW
```

```
[A2-FINDING-011] LOW
Status: NEW
Phase-119 ref: N/A (new)
File: .env.example:769-770
Issue: NEXT_PUBLIC_CRON_SECRET is defined in .env.example; any value set here would be bundled into client-side JS, exposing the cron secret.
Fix: Remove the NEXT_PUBLIC_CRON_SECRET variable definition from .env.example entirely and add a validation warning in lib/security/env-validator.ts that errors if NEXT_PUBLIC_CRON_SECRET is set to a non-empty value.
Linear: CREATE-NEW
```

```
[A2-FINDING-012] LOW
Status: NEW
Phase-119 ref: N/A (new)
File: package.json
Issue: Conceptual CVE surface assessment — ws ^8.14.0 may resolve to a version vulnerable to CVE-2024-37890 (DoS, fixed in 8.17.1); jsonwebtoken ^9.0.2 and axios ^1.11.0 have known vulnerability histories in their respective lines.
Fix: Run npm audit and review lockfile for ws specifically; pin ws to >=8.17.1 explicitly in package.json.
Linear: CREATE-NEW
```

```
[A3-FINDING-018] LOW
Status: NEW
Phase-119 ref: N/A (new)
File: app/dashboard/geo/optimiser/page.tsx:8
Issue: Dashboard page imports TACTIC_LABELS (a constant map) directly from @/lib/geo/tactic-prompts, coupling the page to lib internals and bypassing the architectural boundary.
Fix: Re-export the constant from a component-facing barrel in components/geo/ or document as a low-risk constant-only exception.
Linear: CREATE-NEW
```

```
[A3-FINDING-019] LOW
Status: NEW
Phase-119 ref: N/A (new)
File: app/dashboard/integrations/page.tsx:10
Issue: Dashboard page imports INTEGRATION_REGISTRY directly from @/lib/integrations/types, coupling the page to lib internals.
Fix: Re-export from a component-facing barrel or document as a low-risk constant exception.
Linear: CREATE-NEW
```

```
[A3-FINDING-028] LOW
Status: NEW
Phase-119 ref: N/A (new)
File: app/api/bio/route.ts:33
Issue: Math.random().toString(36).substring(2, 6) used to generate a bio page slug suffix; Math.random() is not cryptographically random and can produce collisions under concurrent load.
Fix: Replace with crypto.randomBytes(4).toString('hex') (Node.js built-in) for collision-resistant slug generation.
Linear: CREATE-NEW
```

```
[A5-FINDING-007] LOW
Status: NEW
Phase-119 ref: N/A (new)
File: next.config.mjs (serverExternalPackages array, line 115)
Issue: puppeteer is listed in serverExternalPackages but is a devDependency only; on Vercel serverless functions devDependencies are not installed at runtime, so the entry is a no-op that misleads future maintainers.
Fix: Remove puppeteer from serverExternalPackages in next.config.mjs.
Linear: CREATE-NEW
```

```
[A5-FINDING-008] LOW
Status: NEW
Phase-119 ref: N/A (new)
File: next.config.mjs (experimental.optimizePackageImports)
Issue: react-icons and lodash are listed in optimizePackageImports but neither package is installed (absent from package.json dependencies and devDependencies); these are phantom optimisation entries.
Fix: Remove react-icons and lodash from the optimizePackageImports array in next.config.mjs.
Linear: CREATE-NEW
```

```
[A5-FINDING-009] LOW
Status: NEW
Phase-119 ref: N/A (new — Phase 119 FINDING-078 covered React 18 vs 19, this re-confirms it is still open)
File: package.json (react: "^18.2.0", react-dom: "^18.2.0")
Issue: React 18.2.0 is installed while React 19.x is stable; Next.js 15 is designed to work with React 19 and some Next.js 15 features perform better on React 19.
Fix: Plan a React 19 upgrade sprint; test for breaking changes around useLayoutEffect server warnings, ref forwarding changes, and removed legacy APIs.
Linear: CREATE-NEW
```

```
[A5-FINDING-010] LOW
Status: NEW
Phase-119 ref: N/A (new — Phase 119 FINDING-073 covered Tailwind v3 vs v4, this re-confirms)
File: package.json (tailwindcss: "^3.4.0")
Issue: Tailwind CSS 3.4.x is installed while Tailwind CSS v4.x (stable as of early 2026) offers a CSS-first configuration model; v3.x continues to receive security patches so this is low urgency.
Fix: Evaluate Tailwind v4 upgrade timeline as a dedicated migration — config format changes entirely.
Linear: CREATE-NEW
```

```
[A5-FINDING-014] LOW
Status: NEW
Phase-119 ref: N/A (new)
File: package.json (devDependencies: "@next/bundle-analyzer": "^14.2.18")
Issue: @next/bundle-analyzer is pinned to ^14.2.18 while next is ^15.5.12; the v14 analyser may not correctly handle Next.js 15 App Router output format.
Fix: Update to @next/bundle-analyzer@^15.x (npm install -D @next/bundle-analyzer@latest).
Linear: CREATE-NEW
```

---

## Count Summary

| Severity  | NEW    | REGRESSION | Total Delta |
| --------- | ------ | ---------- | ----------- |
| CRITICAL  | 1      | 0          | 1           |
| HIGH      | 13     | 1          | 14          |
| MEDIUM    | 12     | 0          | 12          |
| LOW       | 14     | 0          | 14          |
| **TOTAL** | **40** | **1**      | **41**      |

**Regression finding:** A5-FINDING-001 (lib/video/capture-service.ts dynamic import of removed package — runtime crash)
**Highest priority new finding:** A4-FINDING-011 CRITICAL (analytics-tab.tsx icon at text-white/10)
**Highest priority regression:** A5-FINDING-001 HIGH (MODULE_NOT_FOUND on video capture code path)
