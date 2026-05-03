/**
 * GET /api/admin/health
 *
 * Returns the latest Client Health Score for every active organisation,
 * sorted by overall_score ascending (most at-risk first).
 *
 * Protected: admin / owner email only (verified server-side).
 * SYN-611
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getUserIdFromCookies,
  verifyTokenSafe,
  isOwnerEmail,
} from '@/lib/auth/jwt-utils';
import { getUserEmailById } from '@/lib/admin/verify-admin';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  // Auth guard — owner only
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token)
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const payload = verifyTokenSafe(token);
  if (!payload?.userId)
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const email = await getUserEmailById(payload.userId);
  if (!email || !isOwnerEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch all active orgs with their latest health score
  const orgs = await prisma.organization.findMany({
    where: { status: 'active' },
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      createdAt: true,
      clientHealthScores: {
        orderBy: { weekStart: 'desc' },
        take: 1,
        select: {
          overallScore: true,
          scoreDelta: true,
          riskLevel: true,
          dimensions: true,
          weekStart: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  // Build response — sort at-risk first
  const rows = orgs.map(org => {
    const latest = org.clientHealthScores[0] ?? null;
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      createdAt: org.createdAt,
      healthScore: latest
        ? {
            overallScore: latest.overallScore,
            scoreDelta: latest.scoreDelta,
            riskLevel: latest.riskLevel,
            dimensions: latest.dimensions,
            weekStart: latest.weekStart,
          }
        : null,
    };
  });

  const RISK_ORDER: Record<string, number> = {
    critical: 0,
    at_risk: 1,
    watch: 2,
    healthy: 3,
  };

  rows.sort((a, b) => {
    const rA = RISK_ORDER[a.healthScore?.riskLevel ?? ''] ?? 4;
    const rB = RISK_ORDER[b.healthScore?.riskLevel ?? ''] ?? 4;
    if (rA !== rB) return rA - rB;
    return (
      (a.healthScore?.overallScore ?? 101) -
      (b.healthScore?.overallScore ?? 101)
    );
  });

  return NextResponse.json({ rows, total: rows.length });
}

/**
 * POST /api/admin/health/trigger
 * Manually triggers a health score computation run (admin only).
 */
export async function POST(_request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token)
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const payload = verifyTokenSafe(token);
  if (!payload?.userId)
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const email = await getUserEmailById(payload.userId);
  if (!email || !isOwnerEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fire computation as background task
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3008';
  const resp = await fetch(`${appUrl}/api/internal/compute-health-scores`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
    },
  });

  const body = await resp.json();
  return NextResponse.json(body, { status: resp.status });
}
