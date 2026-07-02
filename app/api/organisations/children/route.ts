/**
 * Multi-Client Console — Child Organisations (Item #4)
 *
 *   GET /api/organisations/children
 *     Returns the child (sub-account) organisations whose parent workspace is
 *     the CALLER's own organisation, resolved from the authenticated session
 *     via withAuth (clientId = the user's org). Read-only, org-scoped: a caller
 *     only ever sees children of their OWN org — never another org's children.
 *
 * This is the parent org's consolidated view of its CHILD ORGS via
 * Organization.parentOrgId (SYN-847 workspace umbrella). Distinct from:
 *   - /dashboard/businesses  → BusinessOwnership (multi-business owner model)
 *   - /dashboard/clients     → Supabase `clients` agency-client list (#471)
 *
 * @module app/api/organisations/children/route
 */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/auth/with-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET — list the caller-org's child organisations (read-only).
 *
 * Scoped to `clientId` (the caller's resolved org) so the query can only ever
 * return children of the org the session belongs to. No request parameter
 * selects the parent — it is the authenticated org, full stop.
 */
export const GET = withAuth(async (_request, { clientId }) => {
  const children = await prisma.organization.findMany({
    where: { parentOrgId: clientId },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      website: true,
      logo: true,
      industry: true,
      status: true,
      plan: true,
      _count: {
        select: {
          campaigns: true,
          platformConnections: true,
          users: true,
        },
      },
    },
  });

  return NextResponse.json({
    children: children.map(c => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      website: c.website,
      logo: c.logo,
      industry: c.industry,
      status: c.status,
      plan: c.plan,
      stats: {
        campaigns: c._count.campaigns,
        platformConnections: c._count.platformConnections,
        teamSize: c._count.users,
      },
    })),
  });
});
