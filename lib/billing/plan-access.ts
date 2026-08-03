import prisma from '@/lib/prisma';
import { isFullAccessUser } from './plan-access-core';

export * from './plan-access-core';

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
