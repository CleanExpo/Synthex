/**
 * The one answer to "which organisations are the portfolio brands?".
 *
 * Organisation slugs are global, so a slug alone proves nothing: an org with
 * a brand's slug is that brand only when the Unite Group workspace org is an
 * active root (no parent of its own) and the org is that root or an active
 * child of it. Apply, verify, the owner calendar read and video delivery all
 * decide membership here, so no path can write to or read from an org
 * outside the workspace.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { PORTFOLIO_BRANDS, PORTFOLIO_PARENT_SLUG } from './portfolio-brands';

export interface WorkspaceOrgFields {
  id: string;
  slug: string;
  status: string;
  parentOrgId: string | null;
}

/** The workspace org may only anchor the portfolio as an active root. */
export function isActiveWorkspaceRoot(org: WorkspaceOrgFields): boolean {
  return (
    org.slug === PORTFOLIO_PARENT_SLUG &&
    org.status === 'active' &&
    org.parentOrgId === null
  );
}

/** An org is a portfolio brand only as the validated root or its active child. */
export function inWorkspace(
  org: WorkspaceOrgFields,
  root: WorkspaceOrgFields
): boolean {
  return (
    isActiveWorkspaceRoot(root) &&
    org.status === 'active' &&
    (org.id === root.id || org.parentOrgId === root.id)
  );
}

export class LeftWorkspaceError extends Error {
  constructor(readonly orgId: string) {
    super(`organisation ${orgId} is no longer in the workspace`);
    this.name = 'LeftWorkspaceError';
  }
}

/**
 * Inside a transaction: share-lock an org and the workspace root by id, then
 * re-check membership on the locked rows. Until the transaction ends neither
 * row can be deleted, deactivated or re-parented, so a write made after this
 * call is made to a member. The locked org must still carry expectedSlug:
 * a brand renamed after its lookup is not that brand any more. Throws
 * LeftWorkspaceError otherwise. Pass the root's id and slug to check the
 * root alone.
 */
export async function lockWorkspaceMember(
  tx: Pick<Prisma.TransactionClient, '$queryRaw'>,
  orgId: string,
  rootId: string,
  expectedSlug: string
): Promise<WorkspaceOrgFields> {
  const rows = await tx.$queryRaw<WorkspaceOrgFields[]>`
    SELECT id, slug, status, parent_org_id AS "parentOrgId"
    FROM organizations WHERE id IN (${orgId}, ${rootId})
    ORDER BY id FOR SHARE`;
  const org = rows.find(r => r.id === orgId);
  const root = rows.find(r => r.id === rootId);
  if (!org || !root || org.slug !== expectedSlug || !inWorkspace(org, root))
    throw new LeftWorkspaceError(orgId);
  return org;
}

/** Portfolio brand orgs that are workspace members, by slug. Others are absent. */
export async function loadWorkspaceOrgs(
  db: Pick<typeof prisma, 'organization'> = prisma
): Promise<Map<string, WorkspaceOrgFields>> {
  const rows = await db.organization.findMany({
    where: { slug: { in: PORTFOLIO_BRANDS.map(b => b.orgSlug) } },
    select: { id: true, slug: true, status: true, parentOrgId: true },
  });
  const root = rows.find(r => r.slug === PORTFOLIO_PARENT_SLUG);
  const members = new Map<string, WorkspaceOrgFields>();
  if (!root) return members;
  for (const row of rows)
    if (inWorkspace(row, root)) members.set(row.slug, row);
  return members;
}
