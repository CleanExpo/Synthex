/**
 * Tier gate for the Marketing Agency agentic loop feature.
 *
 * Per AGENT_SPEC.md §6:
 *   free / starter / pro  → 0 agents (feature unavailable)
 *   growth                → 1 agent
 *   scale                 → 3 agents
 *
 * -1 = unlimited (reserved; not used for any current plan).
 *
 * Mirrors the PLAN_LIMITS shape used in lib/geo/feature-limits.ts so
 * callers can read either source consistently.
 */
import prisma from '@/lib/prisma';

const MARKETING_AGENT_LIMITS: Record<string, number> = {
  free: 0,
  starter: 0,
  pro: 0,
  growth: 1,
  scale: 3,
};

export function getMarketingAgentLimitForPlan(plan: string | null | undefined): number {
  if (!plan) return 0;
  return MARKETING_AGENT_LIMITS[plan] ?? 0;
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
