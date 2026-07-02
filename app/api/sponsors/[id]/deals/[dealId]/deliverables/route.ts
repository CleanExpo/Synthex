/**
 * Deal Deliverables API
 *
 * @description CRUD endpoints for deliverables within a deal.
 *
 * GET /api/sponsors/:id/deals/:dealId/deliverables - List deliverables
 * POST /api/sponsors/:id/deals/:dealId/deliverables - Create deliverable
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

const createDeliverableSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  type: z.enum(DELIVERABLE_TYPES as [string, ...string[]]),
  platform: z.string().max(64).optional(),
  status: z.enum(DELIVERABLE_STATUSES as [string, ...string[]]).optional(),
  dueDate: z.string().datetime().optional(),
  contentUrl: z.string().url().optional(),
  postId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

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
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
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
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { dealId } = await params;
    const rawBody = await request.json();

    const validation = createDeliverableSchema.safeParse(rawBody);
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
    const deliverable = await sponsorService.createDeliverable(dealId, userId, {
      title: body.title,
      description: body.description,
      type: body.type as (typeof DELIVERABLE_TYPES)[number],
      platform: body.platform,
      status: body.status as (typeof DELIVERABLE_STATUSES)[number] | undefined,
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
