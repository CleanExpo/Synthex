/**
 * Approval assignees — who may act on a new approval request's steps.
 *
 * Steps are assigned to named people, never the '*' wildcard: the approval
 * routes treat '*' as "any authenticated user", which let anyone, in any
 * organisation, open and approve the request.
 *
 * Operators are the organisation's durable owners, read from the same two
 * signals issuer-rank.ts trusts: an active BusinessOwnership, or an accepted
 * TeamMember whose role is 'owner' and who is still linked to the organisation. With no organisation, or no operator on
 * record (a sole-operator org), the submitter is the assignee so the request
 * is never left with nobody able to clear it.
 */
import { prisma } from '@/lib/prisma';

export async function resolveApprovalAssignees(
  organizationId: string | null,
  submitterId: string
): Promise<string[]> {
  if (!organizationId) return [submitterId];

  const [ownerships, ownerMembers] = await Promise.all([
    prisma.businessOwnership.findMany({
      where: { organizationId, isActive: true },
      select: { ownerId: true },
    }),
    prisma.teamMember.findMany({
      where: {
        organizationId,
        role: { equals: 'owner', mode: 'insensitive' },
        // Removing a member only unlinks User.organizationId and leaves the
        // TeamMember row, so a removed owner must not stay an assignee. Only
        // accepted memberships of people still in this organisation count.
        acceptedAt: { not: null },
        user: { organizationId },
      },
      select: { userId: true },
    }),
  ]);

  const operators = new Set<string>([
    ...(ownerships ?? []).map(o => o.ownerId),
    ...(ownerMembers ?? []).map(m => m.userId),
  ]);

  return operators.size > 0 ? [...operators] : [submitterId];
}
