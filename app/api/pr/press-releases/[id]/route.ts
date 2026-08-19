/**
 * PR Journalist CRM — Press Release Detail, Update, Archive (Phase 92)
 *
 * GET    /api/pr/press-releases/[id] — Get press release
 * PATCH  /api/pr/press-releases/[id] — Update press release (publish sets publishedAt)
 * DELETE /api/pr/press-releases/[id] — Archive (soft delete — sets status = archived)
 *
 * @module app/api/pr/press-releases/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { orgIdScope } from '@/lib/auth/org-id-scope';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { enforceAgencyPermission } from '@/lib/agency/agency-api-auth';
import {
  isPrExportCleared,
  PR_EXPORT_APPROVE_PERMISSIONS,
  prExportBlockedResponse,
} from '@/lib/pr/export-gate';

// ─── Validation ────────────────────────────────────────────────────────────────

const UpdatePressReleaseSchema = z.object({
  headline: z.string().min(1).max(500).optional(),
  body: z.string().min(1).optional(),
  slug: z.string().max(100).optional(),
  subheading: z.string().max(500).optional(),
  boilerplate: z.string().max(5000).optional(),
  contactName: z.string().max(200).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(50).optional(),
  datePublished: z.string().datetime().optional(),
  location: z.string().max(200).optional(),
  category: z
    .enum(['funding', 'product', 'partnership', 'award', 'other'])
    .optional(),
  keywords: z.array(z.string()).optional(),
  imageUrl: z.string().url().optional(),
  /** `approved` = AT-014 export clearance (owner/admin). */
  status: z.enum(['draft', 'approved', 'published', 'archived']).optional(),
  distributedTo: z.array(z.string()).optional(),
});

// ─── Route params type ─────────────────────────────────────────────────────────

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─── GET /api/pr/press-releases/[id] ──────────────────────────────────────────

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const organizationId = await getEffectiveOrganizationId(userId);
    if (!organizationId) {
      return NextResponse.json(
        { error: 'No organisation context' },
        { status: 403 }
      );
    }

    const { id } = await params;

    const release = await prisma.pressRelease.findFirst({
      where: { id, ...orgIdScope(organizationId, userId) },
    });

    if (!release) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ release });
  } catch (error) {
    console.error('[PR press-releases/[id] GET]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/pr/press-releases/[id] ────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const organizationId = await getEffectiveOrganizationId(userId);
    if (!organizationId) {
      return NextResponse.json(
        { error: 'No organisation context' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Verify ownership
    const existing = await prisma.pressRelease.findFirst({
      where: { id, ...orgIdScope(organizationId, userId) },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = UpdatePressReleaseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // AT-014: stamping approved requires owner/admin (posts:approve | org:manage)
    if (data.status === 'approved' && existing.status !== 'approved') {
      const permDenied = await enforceAgencyPermission(
        userId,
        organizationId,
        PR_EXPORT_APPROVE_PERMISSIONS
      );
      if (permDenied) return permDenied;
    }

    // AT-014: publish is export — fail closed unless already cleared
    if (data.status === 'published' && existing.status !== 'published') {
      if (!isPrExportCleared(existing.status)) {
        return prExportBlockedResponse(existing.status);
      }
      const permDenied = await enforceAgencyPermission(
        userId,
        organizationId,
        PR_EXPORT_APPROVE_PERMISSIONS
      );
      if (permDenied) return permDenied;
    }

    // Set publishedAt when status changes to published
    const publishedAt =
      data.status === 'published' && existing.status !== 'published'
        ? new Date()
        : undefined;

    const release = await prisma.pressRelease.update({
      where: { id },
      data: {
        ...data,
        datePublished: data.datePublished
          ? new Date(data.datePublished)
          : undefined,
        ...(publishedAt ? { publishedAt } : {}),
      },
    });

    return NextResponse.json({ release });
  } catch (error) {
    console.error('[PR press-releases/[id] PATCH]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/pr/press-releases/[id] ───────────────────────────────────────

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const organizationId = await getEffectiveOrganizationId(userId);
    if (!organizationId) {
      return NextResponse.json(
        { error: 'No organisation context' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Verify ownership
    const existing = await prisma.pressRelease.findFirst({
      where: { id, ...orgIdScope(organizationId, userId) },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Soft delete — archive (never hard delete per CLAUDE.md)
    await prisma.pressRelease.update({
      where: { id },
      data: { status: 'archived' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PR press-releases/[id] DELETE]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
