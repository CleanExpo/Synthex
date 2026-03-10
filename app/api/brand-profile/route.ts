/**
 * Brand Profile API
 *
 * Self-service endpoint for reading and updating the current user's
 * organisation brand identity. Scoped to the caller's active organisation.
 *
 * Routes:
 * - GET  /api/brand-profile — Return brand profile for authenticated user's org
 * - PATCH /api/brand-profile — Update brand profile fields (partial update)
 *
 * Linear: SYN-55
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: For authentication (CRITICAL)
 *
 * SECURITY: Requires authentication. Any org member can update their org's brand identity.
 *
 * @module app/api/brand-profile/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import type { BrandProfileResponse } from './types';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

// =============================================================================
// Validation schema
// =============================================================================

const brandProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().or(z.literal('')),
  website: z.string().url().max(200).optional().or(z.literal('')),
  industry: z.string().max(100).optional(),
  teamSize: z.string().max(50).optional(),
  abn: z.string().max(20).optional().or(z.literal('')),
  logo: z.string().url().max(500).optional().or(z.literal('')),
  favicon: z.string().url().max(500).optional().or(z.literal('')),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional()
    .or(z.literal('')),
  socialHandles: z.record(z.string().max(100)).optional(),
});

// =============================================================================
// Helpers
// =============================================================================

const ORG_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  website: true,
  industry: true,
  teamSize: true,
  abn: true,
  logo: true,
  favicon: true,
  primaryColor: true,
  socialHandles: true,
  updatedAt: true,
} as const;

function formatBrandProfile(org: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  website: string | null;
  industry: string | null;
  teamSize: string | null;
  abn: string | null;
  logo: string | null;
  favicon: string | null;
  primaryColor: string | null;
  socialHandles: unknown;
  updatedAt: Date;
}): BrandProfileResponse {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    description: org.description,
    website: org.website,
    industry: org.industry,
    teamSize: org.teamSize,
    abn: org.abn,
    logo: org.logo,
    favicon: org.favicon,
    primaryColor: org.primaryColor,
    socialHandles:
      org.socialHandles && typeof org.socialHandles === 'object' && !Array.isArray(org.socialHandles)
        ? (org.socialHandles as Record<string, string>)
        : {},
    updatedAt: org.updatedAt.toISOString(),
  };
}

/**
 * Resolve the authenticated user's active organisation ID.
 * Returns { userId, organizationId } on success, or a NextResponse on failure.
 */
async function resolveUserOrg(request: NextRequest): Promise<
  | { userId: string; organizationId: string }
  | NextResponse
> {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });

  if (!user?.organizationId) {
    return NextResponse.json(
      { error: 'No organisation found. Complete onboarding first.' },
      { status: 404 }
    );
  }

  return { userId, organizationId: user.organizationId };
}

// =============================================================================
// GET /api/brand-profile
// =============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const resolved = await resolveUserOrg(request);
  if (resolved instanceof NextResponse) return resolved;

  const { organizationId } = resolved;

  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: ORG_SELECT,
    });

    if (!org) {
      return NextResponse.json(
        { error: 'Organisation not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: formatBrandProfile(org) }, { status: 200 });
  } catch (error) {
    logger.error('[brand-profile] GET failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =============================================================================
// PATCH /api/brand-profile
// =============================================================================

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const resolved = await resolveUserOrg(request);
  if (resolved instanceof NextResponse) return resolved;

  const { organizationId } = resolved;

  // Parse and validate request body
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const validation = brandProfileSchema.safeParse(rawBody);
  if (!validation.success) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        details: validation.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const body = validation.data;

  // Build partial update — only include explicitly provided fields
  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.description !== undefined) updateData.description = body.description || null;
  if (body.website !== undefined) updateData.website = body.website || null;
  if (body.industry !== undefined) updateData.industry = body.industry;
  if (body.teamSize !== undefined) updateData.teamSize = body.teamSize;
  if (body.abn !== undefined) updateData.abn = body.abn || null;
  if (body.logo !== undefined) updateData.logo = body.logo || null;
  if (body.favicon !== undefined) updateData.favicon = body.favicon || null;
  if (body.primaryColor !== undefined) updateData.primaryColor = body.primaryColor || null;
  if (body.socialHandles !== undefined) updateData.socialHandles = body.socialHandles;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No fields provided to update' }, { status: 400 });
  }

  try {
    const updated = await prisma.organization.update({
      where: { id: organizationId },
      data: updateData,
      select: ORG_SELECT,
    });

    return NextResponse.json({ data: formatBrandProfile(updated) }, { status: 200 });
  } catch (error) {
    logger.error('[brand-profile] PATCH failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
