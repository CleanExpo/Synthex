/**
 * GET /api/admin/geo-citations — SYN-584 (dark run, admin-only read view).
 *
 * Read-only, paginated listing of `geo_citation_events`. ADMIN/OWNER only via
 * the shared `verifyAdmin` gate. ZERO client-facing exposure.
 *
 * Query params (all optional):
 *   userId    — filter to one user
 *   from,to   — inclusive query_date range (YYYY-MM-DD)
 *   engine    — 'google_ai_overview' | 'chatgpt' | 'perplexity'
 *   mentioned — 'true' | 'false'
 *   page      — 1-based page number (default 1); 50 rows per page
 *
 * Error shape: { error, details? }
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAdmin } from '@/lib/admin/verify-admin';
import { logger } from '@/lib/logger';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;
const VALID_ENGINES = ['google_ai_overview', 'chatgpt', 'perplexity'] as const;

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (!auth.isAdmin) {
    return NextResponse.json(
      { error: auth.error ?? 'Admin access required' },
      { status: auth.error === 'Authentication required' ? 401 : 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const userId = searchParams.get('userId')?.trim() || undefined;
    const engineParam = searchParams.get('engine')?.trim() || undefined;
    const mentionedParam = searchParams.get('mentioned')?.trim() || undefined;
    const from = searchParams.get('from')?.trim() || undefined;
    const to = searchParams.get('to')?.trim() || undefined;

    if (engineParam && !VALID_ENGINES.includes(engineParam as never)) {
      return NextResponse.json(
        { error: 'Invalid engine', details: `Expected one of ${VALID_ENGINES.join(', ')}` },
        { status: 400 }
      );
    }

    const queryDate: Prisma.DateTimeFilter = {};
    if (from) queryDate.gte = new Date(from);
    if (to) queryDate.lte = new Date(to);

    const where: Prisma.GeoCitationEventWhereInput = {
      ...(userId ? { userId } : {}),
      ...(engineParam ? { searchEngine: engineParam } : {}),
      ...(mentionedParam === 'true'
        ? { brandMentioned: true }
        : mentionedParam === 'false'
          ? { brandMentioned: false }
          : {}),
      ...(from || to ? { queryDate } : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.geoCitationEvent.count({ where }),
      prisma.geoCitationEvent.findMany({
        where,
        orderBy: [{ queryDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          userId: true,
          queryText: true,
          queryVariant: true,
          searchEngine: true,
          queryDate: true,
          brandMentioned: true,
          mentionPosition: true,
          rawSnippet: true,
          errorReason: true,
          user: { select: { email: true } },
        },
      }),
    ]);

    return NextResponse.json({
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / PAGE_SIZE),
      rows: rows.map(r => ({
        id: r.id,
        userId: r.userId,
        userEmail: r.user?.email ?? null,
        queryText: r.queryText,
        queryVariant: r.queryVariant,
        searchEngine: r.searchEngine,
        queryDate: r.queryDate,
        brandMentioned: r.brandMentioned,
        mentionPosition: r.mentionPosition,
        rawSnippet: r.rawSnippet,
        errorReason: r.errorReason,
      })),
    });
  } catch (error) {
    logger.error('admin:geo-citations:failed', error);
    return NextResponse.json(
      {
        error: 'Failed to load GEO citation events',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
