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
  enterprise: 4,
  custom: 4,
};

const ACTIVE_ENTITLEMENT_STATUSES = new Set(['active', 'trialing']);

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

export function isFullAccessUser(
  user: { email?: string | null; preferences?: unknown } | null | undefined
): boolean {
  if (!user) return false;
  if (isOwnerEmail(user.email)) return true;
  const prefs = user.preferences as { role?: string } | null;
  return prefs?.role === 'admin' || prefs?.role === 'superadmin';
}
