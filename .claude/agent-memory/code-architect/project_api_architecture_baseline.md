---
name: project-api-architecture-baseline
description: Verified baseline of Synthex API-route architecture conventions (auth, scoping, rate-limit, error handling) as of 2026-05-29 audit
metadata:
  type: project
---

Verified state of `app/api/` conventions from the 2026-05-29 architecture audit (664 route.ts files, 438 with mutation handlers).

**Auth:** Canonical util is `getUserIdFromRequestOrCookies` in `lib/auth/jwt-utils.ts` (299 routes use it). A divergent minority (5 routes) authenticate via Supabase `supabase.auth.getUser(token)` instead — e.g. `app/api/user/change-password`, `app/api/integrations/[integrationId]/connect`, `app/api/patterns/analyze`. These are authenticated but break auth centralisation.

**Rate limiting:** `APISecurityChecker` + `DEFAULT_POLICIES` (lib/security/api-security-checker.ts) carries per-policy rate limits, but the underlying `RateLimiter.check` uses an in-memory `Map` (line ~154) — per-instance only, ineffective across Vercel serverless instances / resets on cold start. Distributed limiting exists separately via `lib/middleware/api-rate-limit.ts` (Upstash Redis) used by admin/mutation helpers.

**Org/user scoping:** Strong discipline — queries build a `where`/`whereClause` variable containing `userId`/`organizationId` then pass it to Prisma. A naive inline-window grep produces ~125 false positives; verify by reading the where-variable construction, not the findMany call site.

**Error handling:** Deliberate "degrade gracefully" pattern in GET routes returns HTTP 200 with empty/default payload inside catch (e.g. dashboard cards return `{ success: true, data: EMPTY_PAYLOAD }`). `app/api/admin/vault` does it correctly (swallows only `isMissingTableError`, re-throws the rest); dashboard routes swallow ALL errors.

**Cross-layer:** Largely respected. `page.tsx` lib imports are mostly `@/lib/utils`, `@/lib/seo/metadata`, `@/lib/fetcher`. Server-component public pages (`app/clients/[slug]`, `app/bio/[slug]`) import `@/lib/prisma` directly — legitimate App Router server-component data fetching, NOT a violation.

**Why:** Establishes what "normal" looks like so future audits flag real drift, not noise.
**How to apply:** When auditing routes, treat Supabase-auth, in-memory rate-limit reliance, all-error swallow in catch, and missing ownership checks (not just missing auth) as the genuine risk classes. See [[project-comments-idor]].
