/**
 * Workspace Umbrella API — SYN-847
 *
 * GET /api/workspaces/[parentSlug]
 *   Returns parent workspace org + all child brand orgs the authenticated user
 *   is a member of. Master admin (member of parent) sees ALL children;
 *   brand-only members see only the children they're explicitly a member of.
 *
 * AUTH: APISecurityChecker.AUTHENTICATED_READ
 *
 * @module app/api/workspaces/[parentSlug]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ parentSlug: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );
  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error ?? 'Authentication required' },
      security.error?.includes('Rate limit') ? 429 : 401,
      security.context
    );
  }

  const userId = security.context.userId;
  if (!userId) {
    return APISecurityChecker.createSecureResponse(
      { error: 'User ID is required' },
      400,
      security.context
    );
  }

  const { parentSlug } = await params;

  // ── Lookup parent workspace ───────────────────────────────────────────────
  const parent = await prisma.organization.findUnique({
    where: { slug: parentSlug },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      website: true,
      logo: true,
      status: true,
      domain: true,
      settings: true,
      users: { select: { id: true } },
    },
  });

  if (!parent) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  // ── Authorisation: user must be a member of the parent OR of any child ──
  const isMasterAdmin = parent.users.some(u => u.id === userId);

  // ── Lookup children visible to this user ──────────────────────────────────
  const children = await prisma.organization.findMany({
    where: {
      parentOrgId: parent.id,
      // Master admin sees all children; non-master sees only those they're a member of
      ...(isMasterAdmin ? {} : { users: { some: { id: userId } } }),
    },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      website: true,
      logo: true,
      industry: true,
      status: true,
      domain: true,
      settings: true,
      _count: {
        select: {
          campaigns: true,
          platformConnections: true,
          users: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  if (!isMasterAdmin && children.length === 0) {
    return NextResponse.json(
      { error: 'Forbidden — not a member of this workspace' },
      { status: 403 }
    );
  }

  logger.info('[workspaces] GET', {
    parentSlug,
    userId,
    isMasterAdmin,
    childCount: children.length,
  });

  return NextResponse.json({
    parent: {
      id: parent.id,
      slug: parent.slug,
      name: parent.name,
      description: parent.description,
      website: parent.website,
      logo: parent.logo,
      status: parent.status,
      domain: parent.domain,
      isMasterAdmin,
    },
    children: children.map(c => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      website: c.website,
      logo: c.logo,
      industry: c.industry,
      status: c.status,
      domain: c.domain,
      stats: {
        campaigns: c._count.campaigns,
        platformConnections: c._count.platformConnections,
        teamSize: c._count.users,
      },
    })),
  });
}
