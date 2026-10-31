/**
 * POST /api/portfolio-calendar/video-delivery
 *
 * Machine hand-off from the short-form engine: attaches a finished, SDA-passed
 * video to a portfolio calendar slot by slotKey. The slot stays a draft
 * pending Phill's approval; nothing is scheduled or published here.
 *
 * Auth: X-Delivery-Token must equal SHORTFORM_DELIVERY_TOKEN (its own secret,
 * not the shared cross-product service token). Unset = 503 not provisioned.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { notProvisionedResponse } from '@/lib/api/not-provisioned';
import { logger } from '@/lib/logger';
import {
  DELIVERY_TOKEN_ENV,
  attachVideoToSlot,
  checkDeliveryToken,
  videoDeliverySchema,
} from '@/lib/marketing-calendar/video-delivery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Rate limit first; SERVICE_WRITE does not authenticate, the token below does.
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.SERVICE_WRITE
  );
  if (!security.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const token = checkDeliveryToken(
    request.headers.get('x-delivery-token'),
    process.env[DELIVERY_TOKEN_ENV]
  );
  if (token === 'not_provisioned') {
    return notProvisionedResponse(
      `Short-form video delivery is not available: ${DELIVERY_TOKEN_ENV} is not set on this deployment.`
    );
  }
  if (token === 'invalid') {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = videoDeliverySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await attachVideoToSlot(parsed.data);
    switch (result.outcome) {
      case 'not_found':
        return NextResponse.json(
          { error: 'No portfolio slot with that slotKey' },
          { status: 404 }
        );
      case 'conflict':
        return NextResponse.json({ error: result.reason }, { status: 409 });
      case 'refused':
        return NextResponse.json({ error: result.reason }, { status: 422 });
      default:
        logger.info('[video-delivery] video attached', {
          slotKey: parsed.data.slotKey,
          postId: result.postId,
          outcome: result.outcome,
          sdaVerdictId: parsed.data.sdaVerdictId,
        });
        return NextResponse.json({
          outcome: result.outcome,
          postId: result.postId,
          status: 'draft',
          approval: 'pending_approval',
        });
    }
  } catch (err) {
    logger.error('[video-delivery] failed', {
      slotKey: parsed.data.slotKey,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Video delivery failed' },
      { status: 500 }
    );
  }
}
