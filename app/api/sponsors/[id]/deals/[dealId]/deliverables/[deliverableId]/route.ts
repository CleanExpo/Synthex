/**
 * Single Deliverable API
 *
 * @description CRUD endpoints for individual deliverable.
 *
 * PUT /api/sponsors/:id/deals/:dealId/deliverables/:deliverableId - Update deliverable
 * DELETE /api/sponsors/:id/deals/:dealId/deliverables/:deliverableId - Delete deliverable
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import {
  SponsorService,
  DELIVERABLE_TYPES,
  DELIVERABLE_STATUSES,
} from '@/lib/sponsors/sponsor-service';

const updateDeliverableSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  type: z.enum(DELIVERABLE_TYPES as [string, ...string[]]).optional(),
  platform: z.string().max(64).optional(),
  status: z.enum(DELIVERABLE_STATUSES as [string, ...string[]]).optional(),
  dueDate: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  contentUrl: z.string().url().optional(),
  postId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// =============================================================================
// PUT - Update Deliverable
// =============================================================================

export async function PUT(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; dealId: string; deliverableId: string }> }
) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { deliverableId } = await params;
    const rawBody = await request.json();

    const validation = updateDeliverableSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }
    const body = validation.data;

    const sponsorService = new SponsorService();
    const deliverable = await sponsorService.updateDeliverable(
      deliverableId,
      userId,
      {
        title: body.title,
        description: body.description,
        type: body.type as (typeof DELIVERABLE_TYPES)[number] | undefined,
        platform: body.platform,
        status: body.status as
          | (typeof DELIVERABLE_STATUSES)[number]
          | undefined,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        completedAt: body.completedAt ? new Date(body.completedAt) : undefined,
        contentUrl: body.contentUrl,
        postId: body.postId,
        metadata: body.metadata,
      }
    );

    return NextResponse.json({
      success: true,
      data: deliverable,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'Deliverable not found') {
      return NextResponse.json(
        { success: false, error: 'Deliverable not found' },
        { status: 404 }
      );
    }
    logger.error('Deliverable PUT error:', { error: message });
    return NextResponse.json(
      { success: false, error: 'Failed to update deliverable' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Remove Deliverable
// =============================================================================

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; dealId: string; deliverableId: string }> }
) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { deliverableId } = await params;
    const sponsorService = new SponsorService();
    await sponsorService.deleteDeliverable(deliverableId, userId);

    return NextResponse.json({
      success: true,
      message: 'Deliverable deleted',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'Deliverable not found') {
      return NextResponse.json(
        { success: false, error: 'Deliverable not found' },
        { status: 404 }
      );
    }
    logger.error('Deliverable DELETE error:', { error: message });
    return NextResponse.json(
      { success: false, error: 'Failed to delete deliverable' },
      { status: 500 }
    );
  }
}
