/**
 * Admin API: Organisation Brand Profile Management
 *
 * GET    /api/admin/org-brand-profile?orgId=xxx — Get any org's brand profile
 * PATCH  /api/admin/org-brand-profile           — Update any org's brand profile by orgId
 *
 * OWNER-ONLY: Gated to platform owner(s) via isOwnerEmail().
 * Allows the platform owner to populate/update brand profiles for any org
 * without being limited to their own session org.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { isOwnerEmail } from '@/lib/auth/jwt-utils';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function requireOwner(request: NextRequest): Promise<
  { userId: string } | { error: NextResponse }
> {
  const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_READ);
  if (!security.allowed) {
    return { error: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) };
  }

  const userId = security.context.userId!;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user || !isOwnerEmail(user.email)) {
    return { error: NextResponse.json({ error: 'Owner access required' }, { status: 403 }) };
  }

  return { userId };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const updateSchema = z.object({
  orgId: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().or(z.literal('')),
  website: z.string().url().max(200).optional().or(z.literal('')),
  industry: z.string().max(100).optional(),
  teamSize: z.string().max(50).optional(),
  abn: z.string().max(20).optional().or(z.literal('')),
  logo: z.string().url().max(500).optional().or(z.literal('')),
  favicon: z.string().url().max(500).optional().or(z.literal('')),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().or(z.literal('')),
  socialHandles: z.record(z.string().max(200)).optional(),
});

const ORG_SELECT = {
  id: true, name: true, slug: true, description: true, website: true,
  industry: true, teamSize: true, abn: true, logo: true, favicon: true,
  primaryColor: true, socialHandles: true, updatedAt: true,
} as const;

// ---------------------------------------------------------------------------
// GET /api/admin/org-brand-profile?orgId=xxx
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireOwner(request);
  if ('error' in auth) return auth.error;

  const orgId = request.nextUrl.searchParams.get('orgId');
  if (!orgId) {
    return NextResponse.json({ error: 'orgId query param required' }, { status: 400 });
  }

  try {
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: ORG_SELECT });
    if (!org) return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
    return NextResponse.json({ data: org }, { status: 200 });
  } catch (error) {
    logger.error('[admin/org-brand-profile] GET failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/org-brand-profile
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const auth = await requireOwner(request);
  if ('error' in auth) return auth.error;

  let rawBody: unknown;
  try { rawBody = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = updateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { orgId, ...fields } = parsed.data;

  // Build update object — only include provided fields
  const updateData: Record<string, unknown> = {};
  if (fields.name !== undefined) updateData.name = fields.name;
  if (fields.description !== undefined) updateData.description = fields.description || null;
  if (fields.website !== undefined) updateData.website = fields.website || null;
  if (fields.industry !== undefined) updateData.industry = fields.industry;
  if (fields.teamSize !== undefined) updateData.teamSize = fields.teamSize;
  if (fields.abn !== undefined) updateData.abn = fields.abn || null;
  if (fields.logo !== undefined) updateData.logo = fields.logo || null;
  if (fields.favicon !== undefined) updateData.favicon = fields.favicon || null;
  if (fields.primaryColor !== undefined) updateData.primaryColor = fields.primaryColor || null;
  if (fields.socialHandles !== undefined) updateData.socialHandles = fields.socialHandles;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    // Verify org exists first
    const exists = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true, name: true } });
    if (!exists) return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: updateData,
      select: ORG_SELECT,
    });

    logger.info(`[admin/org-brand-profile] Updated brand profile for org ${orgId} (${exists.name})`);
    return NextResponse.json({ data: updated, orgName: exists.name }, { status: 200 });
  } catch (error) {
    logger.error('[admin/org-brand-profile] PATCH failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
