/**
 * Owner Email Check (client-safe)
 *
 * Pure owner-email lookup with NO server-only dependencies (no `next/headers`,
 * no `next/server`). Lives in its own module so client bundles that only need
 * the owner check (e.g. `lib/billing/plan-access.ts` → `hooks/useSubscription`)
 * don't drag the cookie-using `jwt-utils` module — and therefore `next/headers`
 * — into the client bundle.
 *
 * @module lib/auth/owner-email
 */

/**
 * Owner email(s) that get full platform access without Stripe or onboarding gates.
 * These users receive `onboardingComplete: true` and `apiKeyConfigured: true` in
 * their JWT regardless of DB state — and the DB is auto-updated on login.
 */
export const OWNER_EMAILS: ReadonlySet<string> = new Set(
  (process.env.OWNER_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
);

/**
 * Check if an email belongs to a platform owner.
 * Owners bypass onboarding and API key requirements.
 */
export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return OWNER_EMAILS.has(email.toLowerCase());
}
