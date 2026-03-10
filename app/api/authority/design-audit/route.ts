/**
 * Design Audit API — Analyse page design quality, CRO readiness, and LLM citation fitness
 *
 * POST /api/authority/design-audit
 * Body: { url?: string, content?: string, html?: string }
 * Returns: DesignAuditResult
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 * - STRIPE_AUTHORITY_ADDON_PRICE_ID (OPTIONAL — required for addon check)
 *
 * @module app/api/authority/design-audit/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { analyseDesign } from '@/lib/authority/design-audit/design-analyzer';
import { hasAuthorityAddon } from '@/lib/stripe/subscription-service';
import { logger } from '@/lib/logger';

const schema = z
  .object({
    url: z.string().url().optional(),
    content: z.string().optional(),
    html: z.string().optional(),
  })
  .refine(data => data.url || data.content || data.html, {
    message: 'At least one of url, content, or html must be provided',
  });

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const addonActive = await hasAuthorityAddon(userId);
    if (!addonActive) {
      return NextResponse.json(
        { error: 'Authority Ranking add-on required for design audits', upgrade: true, addon: 'authority' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
    }

    const result = await analyseDesign(parsed.data);

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Design audit error', { error });
    return NextResponse.json({ error: 'Design audit failed' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
