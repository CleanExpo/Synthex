# CTO Audit — API Security Gate Findings

**Date:** 2026-03-26 | **Auditor:** CTO (route-auditor + senior-reviewer skills)

## BLOCKER violations (must fix before any release)

| Route                          | Gate         | Issue                                                                                                                  | Fix                                                         |
| ------------------------------ | ------------ | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `app/api/admin/users/route.ts` | G2 Org-scope | API-key authenticated admins bypass org-scope guard (JWT path guards but API-key path does not)                        | Add org-scope check BEFORE JWT/API-key branch               |
| `app/api/social/post/route.ts` | G2 Org-scope | Campaign creation uses `userId` only, no `organizationId` — User B (different org) could claim campaign by ID guessing | Add `organizationId` to campaign creation + verify in route |

## HIGH violations (fix this sprint)

| Route                                  | Gate           | Issue                                                                                                            | Fix                                                                 |
| -------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `app/api/ai/generate-content/route.ts` | G1 Auth        | GET handler doesn't validate user permissions before `generateContentCalendar()`                                 | Add `getUserIdFromRequestOrCookies()` check                         |
| `app/api/analytics/dashboard/route.ts` | G2 Org-scope   | `analyticsTracker.getDashboardMetrics(userId)` — no explicit org-scope validation in route layer                 | Add org-scope verification before delegating to service             |
| Multiple routes                        | G5 Error shape | Error responses inconsistent: some `{ error, message }`, some `{ error, details }`, some `{ error }` only        | Standardise to `{ error: string, details?: unknown }`               |
| `app/api/webhooks/stripe/route.ts`     | G1 Auth        | Signature existence checked but `webhookHandler.receiveAndProcess()` not verified to actually validate signature | Add explicit `stripe.webhooks.constructEvent()` call before handler |

## MEDIUM violations (fix next sprint)

| Route                              | Gate         | Issue                                                                                | Fix                                                                  |
| ---------------------------------- | ------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `app/api/content/route.ts`         | G3 Zod       | Pagination uses `Math.min()` clamping instead of Zod `z.coerce.number().positive()`  | Add positive number validation in schema                             |
| `app/api/scheduler/posts/route.ts` | G5 Error     | Hard-delete via query param without confirmation body                                | Require explicit `{ confirm: true }` body for destructive operations |
| `app/api/user/profile/route.ts`    | G5 Error     | Hard-deletes user (cascade) with no soft-delete fallback                             | Implement `status: 'deleted'` soft-delete before hard delete         |
| `app/api/campaigns/route.ts`       | G2 Org-scope | Cache key uses `orgId ?? userId` — could cross-tenant if userId non-unique           | Use only `organizationId` as cache key; fallback after verification  |
| `lib/admin/verify-admin.ts`        | G1 Auth      | Unclear if `verifyAdmin()` delegates to `getUserIdFromRequestOrCookies()` or raw JWT | Verify and document; refactor to use centralised auth if needed      |

## Routes audited

| Route file                       | G1 Auth | G2 OrgScope | G3 Zod | G4 RateLimit | G5 ErrorShape |
| -------------------------------- | ------- | ----------- | ------ | ------------ | ------------- |
| `content/route.ts`               | ✅      | ✅          | ✅     | ✅           | ⚠️            |
| `content/[id]/route.ts`          | ✅      | ✅          | ✅     | ✅           | ✅            |
| `content/generate/route.ts`      | ✅      | ✅          | ✅     | ✅           | ✅            |
| `ai/generate-content/route.ts`   | ⚠️      | ✅          | ✅     | ✅           | ✅            |
| `analytics/dashboard/route.ts`   | ✅      | ⚠️          | N/A    | N/A          | ✅            |
| `analytics/insights/route.ts`    | ✅      | ✅          | ✅     | ✅           | ✅            |
| `user/profile/route.ts`          | ✅      | ✅          | ✅     | ✅           | ✅            |
| `organizations/route.ts`         | ✅      | ✅          | ✅     | ✅           | ✅            |
| `auth/login/route.ts`            | ✅      | N/A         | ✅     | ✅           | ✅            |
| `admin/users/route.ts`           | ⚠️      | 🚫          | ✅     | ✅           | ✅            |
| `scheduler/posts/route.ts`       | ✅      | ✅          | ✅     | ✅           | ⚠️            |
| `social/post/route.ts`           | ✅      | 🚫          | ✅     | ✅           | ✅            |
| `campaigns/route.ts`             | ✅      | ⚠️          | ✅     | ✅           | ✅            |
| `webhooks/stripe/route.ts`       | ⚠️      | N/A         | N/A    | N/A          | ✅            |
| `ai/chat/conversations/route.ts` | ✅      | ✅          | ✅     | ✅           | ✅            |

## Summary

- **Blockers:** 2 (admin org-scope bypass, social post org-scope missing)
- **High:** 4 (AI GET auth, analytics org-scope, error shape, Stripe sig)
- **Medium:** 5 (pagination Zod, soft-delete, cache key, admin verify clarity)
- **Routes audited:** 15 representative routes across all domains
- **Overall security posture:** Good — centralised auth pattern used throughout, Zod on all mutations sampled; 2 blockers need immediate fix
