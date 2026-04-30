/**
 * Billing Subscription API — alias for /api/user/subscription
 *
 * The authority dashboard calls /api/billing/subscription.
 * This route re-exports the same GET handler to avoid duplicating logic.
 *
 * Auth: inherited from /api/user/subscription which uses APISecurityChecker
 * with `@/lib/security/api-security-checker` (JWT + session).
 *
 * @module app/api/billing/subscription/route
 */

export { GET } from '@/app/api/user/subscription/route';

export const runtime = 'nodejs';
