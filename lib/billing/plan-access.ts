import prisma from '@/lib/prisma';
import { isOwnerEmail } from '@/lib/auth/owner-email';

export type PlanName =
  | 'free'
  | 'starter'
  | 'pro'
  | 'professional'
  | 'growth'
  | 'business'
  | 'scale'
  | 'enterprise'
  | 'custom';

const PLAN_RANK: Record<PlanName, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  professional: 2,
  growth: 3,
  business: 3,
  scale: 4,
  // Enterprise is a top-tier plan — it must clear every lower-tier gate
  // (professional, business, …). Omitting it made hasProfessionalAccess/
  // hasBusinessAccess('enterprise') return false and denied enterprise users
  // lower-tier features.
  enterprise: 4,
  custom: 4,
};

/**
 * Subscription statuses under which a PAID plan actually grants entitlements.
 * Everything else (incomplete, past_due, unpaid, paused, cancelled, inactive)
 * fails closed to free-tier entitlements.
 */
const ACTIVE_ENTITLEMENT_STATUSES = new Set(['active', 'trialing']);

/**
 * Resolve the plan a subscription is *entitled* to given its billing status.
 * A paid plan is only effective while the subscription is active or trialing;
 * for any unpaid/incomplete/past-due/paused state it falls back to 'free'.
 * The 'free' plan is always effective regardless of status.
 *
 * Centralised here so every feature gate that resolves entitlements inherits
 * the status check instead of trusting `subscription.plan` alone.
 */
export function entitledPlan(
  plan: string | null | undefined,
  status: string | null | undefined
): string {
  const normalisedPlan = (plan ?? 'free').toLowerCase();
  if (normalisedPlan === 'free') return 'free';
  const normalisedStatus = (status ?? '').toLowerCase();
  return ACTIVE_ENTITLEMENT_STATUSES.has(normalisedStatus)
    ? normalisedPlan
    : 'free';
}

export function hasPlanAccess(
  userPlan: string | null | undefined,
  requiredPlan: PlanName
): boolean {
  if (!userPlan) return false;
  const userRank = PLAN_RANK[userPlan as PlanName];
  const requiredRank = PLAN_RANK[requiredPlan];
  return typeof userRank === 'number' && userRank >= requiredRank;
}

export function hasProfessionalAccess(
  userPlan: string | null | undefined
): boolean {
  return hasPlanAccess(userPlan, 'professional');
}

export function hasBusinessAccess(
  userPlan: string | null | undefined
): boolean {
  return hasPlanAccess(userPlan, 'business');
}

/**
 * A "full access" principal is a platform owner (OWNER_EMAILS) or an admin
 * (preferences.role === 'admin' | 'superadmin'). Synthex is an internal Unite
 * Group tool — these principals are never subject to subscription/feature-tier
 * gating and always resolve to the top-tier ('scale') plan.
 *
 * Pure: pass the already-fetched user fields; performs no database query.
 */
export function isFullAccessUser(
  user: { email?: string | null; preferences?: unknown } | null | undefined
): boolean {
  if (!user) return false;
  if (isOwnerEmail(user.email)) return true;
  const prefs = user.preferences as { role?: string } | null;
  return prefs?.role === 'admin' || prefs?.role === 'superadmin';
}

/**
 * Resolve the effective plan for a user, applying the owner/admin full-access
 * bypass. Owners and admins always resolve to 'scale' (top tier); everyone else
 * gets their raw plan, lower-cased and defaulted to 'free'.
 *
 * Use at every org-plan gate so feature-tier checks inherit the internal-tool
 * full-access rule without each call site re-implementing it.
 */
export async function resolveEffectivePlan(
  userId: string,
  rawPlan: string | null | undefined
): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, preferences: true },
  });
  if (isFullAccessUser(user)) return 'scale';
  return (rawPlan ?? 'free').toLowerCase();
}
