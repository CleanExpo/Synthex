/**
 * GET /api/admin/roi-attribution
 *
 * Returns ROI attribution data aggregated from recommended_actions that have
 * attribution_context populated. Until SYN-622 validates the model, this
 * returns whatever data exists (may be sparse).
 *
 * Query params:
 *   days  — lookback window (default: 30, max: 90)
 *   orgId — filter to a single organisation (optional)
 *
 * Protected: owner email only.
 * SYN-624
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyTokenSafe, isOwnerEmail } from '@/lib/auth/jwt-utils';
import { getUserEmailById } from '@/lib/admin/verify-admin';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

interface ContentTypeBreakdown {
  contentType: string;
  actionCount: number;
  totalRevenue: number;
  totalEnquiries: number;
  avgConfidence: number;
}

export async function GET(request: NextRequest) {
  // Auth — owner only
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const payload = verifyTokenSafe(token);
  if (!payload?.userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const email = await getUserEmailById(payload.userId);
  if (!email || !isOwnerEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const rawDays = parseInt(searchParams.get('days') ?? '30', 10);
  const days = Math.min(Math.max(rawDays, 1), 90);
  const orgId = searchParams.get('orgId') ?? undefined;

  const since = new Date();
  since.setDate(since.getDate() - days);

  // Fetch all recommended_actions with attribution_context populated
  const actions = await prisma.recommendedAction.findMany({
    where: {
      createdAt: { gte: since },
      ...(orgId ? { organizationId: orgId } : {}),
      NOT: { attributionContext: { equals: {} } },
    },
    select: {
      id: true,
      dollarAttribution: true,
      weekStart: true,
      status: true,
      createdAt: true,
      organizationId: true,
      attributionContext: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  // Aggregate by content type
  const byType = new Map<string, ContentTypeBreakdown>();
  let totalRevenue = 0;
  let totalEnquiries = 0;
  let totalWithConfidence = 0;
  let sumConfidence = 0;

  for (const action of actions) {
    const ctx = action.attributionContext as Record<string, unknown> | null;
    if (!ctx) continue;

    const contentType = (ctx.contentType as string) ?? 'unknown';
    const revenue = (ctx.trackedRevenue as number) ?? 0;
    const enquiries = (ctx.trackedEnquiries as number) ?? 0;
    const confidence = ctx.predictedConversionProbability as number | undefined;

    totalRevenue += revenue;
    totalEnquiries += enquiries;
    if (confidence != null) {
      totalWithConfidence++;
      sumConfidence += confidence;
    }

    const existing = byType.get(contentType) ?? {
      contentType,
      actionCount: 0,
      totalRevenue: 0,
      totalEnquiries: 0,
      avgConfidence: 0,
    };
    existing.actionCount++;
    existing.totalRevenue += revenue;
    existing.totalEnquiries += enquiries;
    if (confidence != null) {
      existing.avgConfidence =
        (existing.avgConfidence * (existing.actionCount - 1) + confidence) /
        existing.actionCount;
    }
    byType.set(contentType, existing);
  }

  // Find top-performing content type
  const breakdown = Array.from(byType.values()).sort(
    (a, b) => b.totalRevenue - a.totalRevenue || b.actionCount - a.actionCount
  );

  return NextResponse.json({
    summary: {
      totalActions: actions.length,
      totalRevenue,
      totalEnquiries,
      avgConfidence: totalWithConfidence > 0 ? sumConfidence / totalWithConfidence : null,
      topContentType: breakdown[0]?.contentType ?? null,
      lookbackDays: days,
    },
    breakdown,
    actions: actions.slice(0, 50).map(a => ({
      id: a.id,
      dollarAttribution: a.dollarAttribution,
      weekStart: a.weekStart,
      status: a.status,
      createdAt: a.createdAt,
      organizationId: a.organizationId,
      attribution: a.attributionContext,
    })),
  });
}
