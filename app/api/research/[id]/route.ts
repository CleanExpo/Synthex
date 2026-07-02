/**
 * Research Report API — Get, Update, Delete single report
 *
 * GET /api/research/:id
 * PATCH /api/research/:id
 * DELETE /api/research/:id
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/research/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { logger } from '@/lib/logger';

/**
 * Brand-scoped ownership filter for GEOResearchReport lookups.
 *
 * BUG (audit #6): every single-report route scoped GEOResearchReport by `userId`
 * ALONE, even though the model carries an `organizationId` column. A
 * multi-business owner who switched their active brand could therefore read,
 * update, or delete the SAME user's reports across ALL their brands — no brand
 * isolation. Scope by BOTH the owning user AND the active brand
 * (organizationId), while preserving legacy reports created before brand-scoping
 * (organizationId === null) so nothing the user legitimately owns disappears.
 *
 * - effectiveOrgId set (multi-business owner on a brand, or single-org user):
 *     { userId, OR: [{ organizationId: effectiveOrgId }, { organizationId: null }] }
 * - no org context (legacy user with no organisation): { userId }
 *
 * Mirrors app/api/ab-testing/tests/route.ts (PR #442) and keeps this route
 * consistent with the already-brand-scoped sibling app/api/research/route.ts.
 */
function buildReportOwnershipWhere(
  userId: string,
  effectiveOrgId: string | null
): Prisma.GEOResearchReportWhereInput {
  if (!effectiveOrgId) {
    return { userId };
  }
  return {
    userId,
    OR: [{ organizationId: effectiveOrgId }, { organizationId: null }],
  };
}

const updateReportSchema = z.object({
  title: z.string().min(5).max(200).optional(),
  status: z.enum(['draft', 'review', 'published']).optional(),
  executiveSummary: z.string().optional(),
  methodology: z.string().optional(),
  findings: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        data: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .optional(),
  fullContent: z.string().optional(),
  dataSources: z
    .array(
      z.object({
        name: z.string(),
        url: z.string().url().optional(),
        type: z.string().optional(),
      })
    )
    .optional(),
  citations: z
    .array(
      z.object({
        text: z.string(),
        source: z.string(),
        url: z.string().url().optional(),
      })
    )
    .optional(),
  metaTitle: z.string().max(70).optional(),
  metaDescription: z.string().max(160).optional(),
  sasScore: z.number().min(0).max(10).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const reportId = parseInt(id, 10);
    if (isNaN(reportId))
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    // Scope the lookup to the user's ACTIVE brand, not every brand they own.
    const effectiveOrgId = await getEffectiveOrganizationId(userId);
    const report = await prisma.gEOResearchReport.findFirst({
      where: {
        id: reportId,
        ...buildReportOwnershipWhere(userId, effectiveOrgId),
      },
      include: { visuals: true },
    });

    if (!report)
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    return NextResponse.json(report);
  } catch (error) {
    logger.error('Get report error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId)
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );

    const { id } = await params;
    const reportId = parseInt(id, 10);
    if (isNaN(reportId))
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    // Verify ownership scoped to the active brand before mutating.
    const effectiveOrgId = await getEffectiveOrganizationId(userId);
    const existing = await prisma.gEOResearchReport.findFirst({
      where: {
        id: reportId,
        ...buildReportOwnershipWhere(userId, effectiveOrgId),
      },
    });
    if (!existing)
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });

    const body = await request.json();
    const validation = updateReportSchema.safeParse(body);
    if (!validation.success)
      return NextResponse.json(
        { error: 'Validation Error', details: validation.error.issues },
        { status: 400 }
      );

    const data = validation.data;
    const updated = await prisma.gEOResearchReport.update({
      where: { id: reportId },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.status && { status: data.status }),
        ...(data.executiveSummary !== undefined && {
          executiveSummary: data.executiveSummary,
        }),
        ...(data.methodology !== undefined && {
          methodology: data.methodology,
        }),
        ...(data.findings && {
          findings: data.findings as Prisma.InputJsonValue,
        }),
        ...(data.fullContent !== undefined && {
          fullContent: data.fullContent,
        }),
        ...(data.dataSources && {
          dataSources: data.dataSources as Prisma.InputJsonValue,
        }),
        ...(data.citations && {
          citations: data.citations as Prisma.InputJsonValue,
        }),
        ...(data.metaTitle !== undefined && { metaTitle: data.metaTitle }),
        ...(data.metaDescription !== undefined && {
          metaDescription: data.metaDescription,
        }),
        ...(data.sasScore !== undefined && { sasScore: data.sasScore }),
        ...(data.status === 'published' && { publishedAt: new Date() }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    logger.error('Update report error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId)
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );

    const { id } = await params;
    const reportId = parseInt(id, 10);
    if (isNaN(reportId))
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    // Verify ownership scoped to the active brand before deleting.
    const effectiveOrgId = await getEffectiveOrganizationId(userId);
    const existing = await prisma.gEOResearchReport.findFirst({
      where: {
        id: reportId,
        ...buildReportOwnershipWhere(userId, effectiveOrgId),
      },
    });
    if (!existing)
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });

    await prisma.gEOResearchReport.delete({ where: { id: reportId } });
    return NextResponse.json({
      success: true,
      message: 'Research report deleted',
    });
  } catch (error) {
    logger.error('Delete report error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
