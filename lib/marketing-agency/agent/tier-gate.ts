/**
 * Tier gate for the Marketing Agency agentic loop feature.
 *
 * Reads from the canonical `PLAN_LIMITS` map in lib/geo/feature-limits.ts
 * (instead of a parallel hardcoded map) so legacy plan aliases like
 * 'business', 'professional', and 'custom' that PLAN_LIMITS already
 * handles are honored here too. Previously a separate
 * MARKETING_AGENT_LIMITS map omitted those aliases and rejected paying
 * customers whose org row carried a legacy plan string.
 *
 *   -1 in PLAN_LIMITS.marketingAgents = unlimited
 *    0 = feature unavailable on this plan
 *    N = up to N active (non-archived) agents per org
 */
import prisma from '@/lib/prisma';
import { PLAN_LIMITS } from '@/lib/geo/feature-limits';

export function getMarketingAgentLimitForPlan(plan: string | null | undefined): number {
  if (!plan) return 0;
  const limits = PLAN_LIMITS[plan.toLowerCase()];
  if (!limits) return 0;
  return limits.marketingAgents;
}

export interface TierCheckResult {
  allowed: boolean;
  reason?: string;
  limit: number;
  current: number;
  plan: string;
}

export async function checkMarketingAgentTier(organizationId: string): Promise<TierCheckResult> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true },
  });
  const plan = (org?.plan ?? 'free').toLowerCase();
  const limit = getMarketingAgentLimitForPlan(plan);
  const current = await prisma.marketingAgent.count({
    where: { organizationId, status: { not: 'archived' } },
  });

  if (limit === -1) return { allowed: true, limit, current, plan };
  if (current >= limit) {
    return {
      allowed: false,
      reason:
        limit === 0
          ? `Marketing Agents are not available on the ${plan} plan. Upgrade to Growth or Scale.`
          : `You've reached your plan limit of ${limit} agent${limit === 1 ? '' : 's'}. Upgrade your plan to create more.`,
      limit,
      current,
      plan,
    };
  }
  return { allowed: true, limit, current, plan };
}
