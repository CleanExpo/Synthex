/**
 * GET /api/admin/intervention-logs
 *
 * Returns intervention frequency aggregated by dimension, tier, and channel.
 * Includes both dispatched and observation-mode records.
 *
 * Query params:
 *   days  — lookback window in days (default: 30, max: 90)
 *   orgId — filter to a single organisation (optional)
 *
 * Protected: owner email only.
 * SYN-614
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromCookies, verifyTokenSafe, isOwnerEmail } from '@/lib/auth/jwt-utils';
import { getUserEmailById } from '@/lib/admin/verify-admin';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

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

  const interventions = await prisma.healthIntervention.findMany({
    where: {
      createdAt: { gte: since },
      ...(orgId ? { organizationId: orgId } : {}),
    },
    select: {
      dimension: true,
      interventionTier: true,
      channel: true,
      observationMode: true,
      actuallySentAt: true,
      organization: { select: { name: true, plan: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Aggregate by dimension + tier + channel
  const aggregateKey = (i: {
    dimension: string;
    interventionTier: number;
    channel: string;
  }) => `${i.dimension}|${i.interventionTier}|${i.channel}`;

  type Agg = {
    dimension: string;
    tier: number;
    channel: string;
    total: number;
    dispatched: number;
    observed: number;
  };

  const aggMap = new Map<string, Agg>();
  for (const i of interventions) {
    const key = aggregateKey(i);
    const existing = aggMap.get(key) ?? {
      dimension: i.dimension,
      tier: i.interventionTier,
      channel: i.channel,
      total: 0,
      dispatched: 0,
      observed: 0,
    };
    existing.total++;
    if (i.observationMode) existing.observed++;
    else existing.dispatched++;
    aggMap.set(key, existing);
  }

  const summary = Array.from(aggMap.values()).sort(
    (a, b) => b.total - a.total
  );

  // Org-level counts (top 10 most-intervened)
  const orgCounts = new Map<string, { name: string; plan: string; count: number }>();
  for (const i of interventions) {
    const name = i.organization.name;
    const plan = i.organization.plan;
    const existing = orgCounts.get(name) ?? { name, plan, count: 0 };
    existing.count++;
    orgCounts.set(name, existing);
  }
  const topOrgs = Array.from(orgCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return NextResponse.json({
    windowDays: days,
    totalInterventions: interventions.length,
    dispatched: interventions.filter(i => !i.observationMode).length,
    observed: interventions.filter(i => i.observationMode).length,
    byDimension: summary,
    topOrgs,
  });
}
