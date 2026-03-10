/**
 * Authority Validate Claim API — Validate a Single Claim Against Source Connectors
 *
 * POST /api/authority/validate-claim
 * Body: { claim: string }
 * Returns: { sources: SourceResult[], validated: boolean }
 *
 * Requires the Authority Ranking add-on.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 * - STRIPE_AUTHORITY_ADDON_PRICE_ID (REQUIRED — addon gate)
 *
 * @module app/api/authority/validate-claim/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { hasAuthorityAddon } from '@/lib/stripe/subscription-service';
import { searchAllConnectors } from '@/lib/authority/source-connectors/index';
import { logger } from '@/lib/logger';

const schema = z.object({
  claim: z.string().min(10).max(1000),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    // Claim validation requires the Authority add-on
    const addonActive = await hasAuthorityAddon(userId);
    if (!addonActive) {
      return NextResponse.json(
        { error: 'Authority Ranking add-on required for claim validation', upgrade: true, addon: 'authority' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
    }

    const { claim } = parsed.data;

    const sources = await searchAllConnectors(claim);
    const validated = sources.length > 0;

    return NextResponse.json({ sources, validated });
  } catch (error) {
    logger.error('Authority validate-claim error', error);
    return NextResponse.json({ error: 'Claim validation failed' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
