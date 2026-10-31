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

/** Portfolio brand orgs that are workspace members, by slug. Others are absent. */
export async function loadWorkspaceOrgs(): Promise<
  Map<string, WorkspaceOrgFields>
> {
  const rows = await prisma.organization.findMany({
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
