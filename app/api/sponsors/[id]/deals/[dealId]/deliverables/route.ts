/**
 * Deal Deliverables API
 *
 * @description CRUD endpoints for deliverables within a deal.
 *
 * GET /api/sponsors/:id/deals/:dealId/deliverables - List deliverables
 * POST /api/sponsors/:id/deals/:dealId/deliverables - Create deliverable
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
// GET - List Deliverables for Deal
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dealId: string }> }
) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { dealId } = await params;
    const sponsorService = new SponsorService();
    const deliverables = await sponsorService.getDeliverables(dealId, userId);

    return NextResponse.json({
      success: true,
      data: deliverables,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'Deal not found') {
      return NextResponse.json(
        { success: false, error: 'Deal not found' },
        { status: 404 }
      );
    }
    logger.error('Deliverables GET error:', { error: message });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch deliverables' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Create Deliverable for Deal
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dealId: string }> }
) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { dealId } = await params;
    const body = await request.json();

    // Validate required fields
    if (!body.title || typeof body.title !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid title' },
        { status: 400 }
      );
    }

    if (!body.type || !DELIVERABLE_TYPES.includes(body.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing type' },
        { status: 400 }
      );
    }

    if (body.status && !DELIVERABLE_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status' },
        { status: 400 }
      );
    }

    const sponsorService = new SponsorService();
    const deliverable = await sponsorService.createDeliverable(dealId, userId, {
      title: body.title,
      description: body.description,
      type: body.type,
      platform: body.platform,
      status: body.status,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
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
    if (message === 'Deal not found') {
      return NextResponse.json(
        { success: false, error: 'Deal not found' },
        { status: 404 }
      );
    }
    logger.error('Deliverables POST error:', { error: message });
    return NextResponse.json(
      { success: false, error: 'Failed to create deliverable' },
      { status: 500 }
    );
  }
}
