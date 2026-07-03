/**
 * Web Projects API Route
 * CRUD operations for web design projects
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { z } from 'zod';
import { logger } from '@/lib/logger';

/**
 * Brand-scoped ownership filter for Project queries.
 *
 * A multi-business owner who switches their active brand must only see/mutate
 * the web-design projects belonging to that brand — not every project they own
 * across ALL their brands. Scope by BOTH the user (ownership) AND the active
 * brand (organizationId), while preserving legacy projects created before
 * brand-scoping existed (organizationId === null) so nothing the user
 * legitimately owns disappears.
 *
 * - effectiveOrgId set (multi-business owner on a brand, or single-org user):
 *     { userId, OR: [{ organizationId: effectiveOrgId }, { organizationId: null }] }
 * - no org context (legacy user with no organisation): { userId }
 */
function buildProjectOwnershipWhere(
  userId: string,
  effectiveOrgId: string | null
): Record<string, unknown> {
  if (!effectiveOrgId) {
    return { userId };
  }
  return {
    userId,
    OR: [{ organizationId: effectiveOrgId }, { organizationId: null }],
  };
}

const projectCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(1000).optional(),
  websiteUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
  domain: z.string().max(253).optional(),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
});

// GET /api/web-projects — list projects of type "webdesign" for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) return unauthorizedResponse();

    // Scope the list to the user's ACTIVE brand, not every brand they own.
    const effectiveOrgId = await getEffectiveOrganizationId(userId);
    const projects = await prisma.project.findMany({
      where: {
        ...buildProjectOwnershipWhere(userId, effectiveOrgId),
        type: 'webdesign',
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ projects });
  } catch (error: unknown) {
    logger.error('Get web-projects error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

// POST /api/web-projects — create a new web design project
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) return unauthorizedResponse();

    const body = await request.json();
    const parsed = projectCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { name, description, websiteUrl, domain, status } = parsed.data;

    // Stamp the new project with the user's ACTIVE brand so it is isolated to
    // that brand on subsequent reads/mutations (a multi-business owner who
    // switches brands must not see this project under another brand).
    const effectiveOrgId = await getEffectiveOrganizationId(userId);

    const project = await prisma.project.create({
      data: {
        name,
        description,
        type: 'webdesign',
        status,
        websiteUrl: websiteUrl || null,
        domain: domain || null,
        pages: 0,
        colors: [],
        userId,
        organizationId: effectiveOrgId,
      },
    });

    return NextResponse.json({ success: true, project }, { status: 201 });
  } catch (error: unknown) {
    logger.error('Create web-project error:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
