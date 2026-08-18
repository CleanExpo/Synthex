/**
 * POST /api/profile-analyser
 *
 * Scrapes a LinkedIn or Facebook profile via Apify and returns a structured
 * analysis: engagement metrics, content mix, a score out of 100, and ranked
 * recommendations.
 *
 * Auth: JWT cookie or Authorization: Bearer header (required)
 * Rate: standard API rate limit
 *
 * Body:
 *   { platform: 'linkedin' | 'facebook', profileUrl: string }
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - APIFY_API_TOKEN (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { analyseProfile } from '@/lib/profile-analyser/service';
import { validateProfileUrl } from '@/lib/profile-analyser/urls';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Apify runs can take up to 5 min — set a generous timeout
export const maxDuration = 300;

const bodySchema = z.object({
  platform: z.enum(['linkedin', 'facebook']),
  profileUrl: z.string().url({ message: 'profileUrl must be a valid URL' }),
});

export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) return unauthorizedResponse();

  // ── Parse + validate ──────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Validation error',
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { platform, profileUrl } = parsed.data;

  const urlCheck = validateProfileUrl(platform, profileUrl);
  if (!urlCheck.ok) {
    return NextResponse.json({ error: urlCheck.error }, { status: 400 });
  }

  // ── Guard: Apify must be configured ──────────────────────────────────────
  if (!process.env.APIFY_API_TOKEN?.trim()) {
    return NextResponse.json(
      {
        error: 'Profile analysis is not configured (missing APIFY_API_TOKEN).',
      },
      { status: 503 }
    );
  }

  // ── Run analysis ──────────────────────────────────────────────────────────
  try {
    const result = await analyseProfile({
      platform,
      profileUrl: urlCheck.url,
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[profile-analyser] analysis failed', {
      userId,
      platform,
      profileUrl,
      error: message,
    });

    // Surface scraper-specific errors clearly so callers can act on them
    if (
      message.includes('returned no data') ||
      message.includes('returned no items') ||
      message.includes('All Apify actors failed')
    ) {
      return NextResponse.json(
        {
          error:
            'Could not retrieve profile. Make sure the URL is public and correct.',
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { error: 'Profile analysis failed. Please try again.' },
      { status: 500 }
    );
  }
}
