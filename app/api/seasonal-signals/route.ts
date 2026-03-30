/**
 * GET /api/seasonal-signals
 *
 * Returns upcoming seasonal opportunity windows for the authenticated user's
 * organisation. Calls the get_seasonal_signals SQL function which handles
 * state-level → national (AU) fallback automatically.
 *
 * Query params:
 *   industrySlug  — e.g. "plumbing-hvac", "cafe-coffee" (default: "general")
 *   locationState — e.g. "VIC", "NSW" (default: "AU")
 *   limit         — max signals to return (default: 10, max: 50)
 *
 * @task SYN-547
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import prisma from '@/lib/prisma';

const QuerySchema = z.object({
  industrySlug: z.string().min(1).max(100).default('general'),
  locationState: z
    .string()
    .min(2)
    .max(10)
    .transform(s => s.toUpperCase())
    .default('AU'),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

interface SeasonalSignalRow {
  id: string;
  industry_slug: string;
  location_state: string;
  signal_type: string;
  opportunity_label: string;
  window_start: Date;
  window_end: Date;
  confidence_score: number;
  source: string;
}

export async function GET(request: NextRequest) {
  // Auth
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  // Parse query params
  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    industrySlug: searchParams.get('industrySlug') ?? undefined,
    locationState: searchParams.get('locationState') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { industrySlug, locationState, limit } = parsed.data;

  try {
    // Call the SQL function — handles state→AU fallback internally
    const rows = await prisma.$queryRaw<SeasonalSignalRow[]>`
      SELECT * FROM get_seasonal_signals(
        ${industrySlug}::TEXT,
        ${locationState}::TEXT,
        ${limit}::INTEGER
      )
    `;

    const signals = rows.map(row => ({
      id: row.id,
      industrySlug: row.industry_slug,
      locationState: row.location_state,
      signalType: row.signal_type,
      opportunityLabel: row.opportunity_label,
      windowStart: row.window_start,
      windowEnd: row.window_end,
      confidenceScore: row.confidence_score,
      source: row.source,
    }));

    return NextResponse.json({ signals });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Failed to fetch signals', reason },
      { status: 500 }
    );
  }
}
