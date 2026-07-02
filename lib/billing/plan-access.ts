export type PlanName =
  | 'free'
  | 'starter'
  | 'pro'
  | 'professional'
  | 'growth'
  | 'business'
  | 'scale'
  | 'custom';

const PLAN_RANK: Record<PlanName, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  professional: 2,
  growth: 3,
  business: 3,
  scale: 4,
  custom: 4,
};

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
