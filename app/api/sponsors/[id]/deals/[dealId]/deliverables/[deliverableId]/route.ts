/**
 * Single Deliverable API
 *
 * @description CRUD endpoints for individual deliverable.
 *
 * PUT /api/sponsors/:id/deals/:dealId/deliverables/:deliverableId - Update deliverable
 * DELETE /api/sponsors/:id/deals/:dealId/deliverables/:deliverableId - Delete deliverable
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import {
  SponsorService,
  DELIVERABLE_TYPES,
  DELIVERABLE_STATUSES,
} from '@/lib/sponsors/sponsor-service';


// =============================================================================
// PUT - Update Deliverable
// =============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dealId: string; deliverableId: string }> }
) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { deliverableId } = await params;
    const body = await request.json();

    // Validate type if provided
    if (body.type && !DELIVERABLE_TYPES.includes(body.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid type' },
        { status: 400 }
      );
    }

    // Validate status if provided
    if (body.status && !DELIVERABLE_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status' },
        { status: 400 }
      );
    }

    const sponsorService = new SponsorService();
    const deliverable = await sponsorService.updateDeliverable(deliverableId, userId, {
      title: body.title,
      description: body.description,
      type: body.type,
      platform: body.platform,
      status: body.status,
      dueDate: body.dueDate ? new Date(body.dueDate) : body.dueDate,
      completedAt: body.completedAt ? new Date(body.completedAt) : body.completedAt,
      contentUrl: body.contentUrl,
      postId: body.postId,
      metadata: body.metadata,
    });

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
  { params }: { params: Promise<{ id: string; dealId: string; deliverableId: string }> }
) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
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
