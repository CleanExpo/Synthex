/**
 * PR Journalist CRM — Hunter.io Email Enrichment (Phase 92)
 *
 * POST /api/pr/journalists/[id]/enrich — Enrich journalist email via Hunter.io
 *
 * Graceful 200 response if HUNTER_API_KEY not configured.
 *
 * @module app/api/pr/journalists/[id]/enrich/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { enrichJournalist } from '@/lib/pr/hunter-enricher';

// ─── Route params type ─────────────────────────────────────────────────────────

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─── POST /api/pr/journalists/[id]/enrich ─────────────────────────────────────

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { id } = await params;

    // Fetch the journalist
    const journalist = await prisma.journalistContact.findFirst({
      where: { id, orgId: userId },
    });
    if (!journalist) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Check if Hunter.io is configured
    if (!process.env.HUNTER_API_KEY) {
      return NextResponse.json({
        message: 'Hunter.io not configured — add HUNTER_API_KEY to use email enrichment',
        email: null,
        confidence: null,
      });
    }

    // Already has verified email — skip lookup
    if (journalist.email && journalist.emailVerified) {
      return NextResponse.json({
        message: 'Email already verified',
        email: journalist.email,
        confidence: journalist.emailScore,
      });
    }

    // Run Hunter.io lookup
    const result = await enrichJournalist(
      journalist.name,
      journalist.outletDomain,
      process.env.HUNTER_API_KEY
    );

    if (!result.email) {
      return NextResponse.json({
        message: 'Email not found via Hunter.io',
        email: null,
        confidence: null,
      });
    }

    // Update the journalist record with the discovered email
    await prisma.journalistContact.update({
      where: { id },
      data: {
        email: result.email,
        emailScore: result.confidence ?? null,
        emailVerified: (result.confidence ?? 0) >= 80,
      },
    });

    return NextResponse.json({
      message: 'Email enriched successfully',
      email: result.email,
      confidence: result.confidence,
    });
  } catch (error) {
    console.error('[PR journalists/[id]/enrich POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
