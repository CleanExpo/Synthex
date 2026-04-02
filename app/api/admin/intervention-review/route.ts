/**
 * GET /api/admin/intervention-review
 *
 * Returns Tier 2 intervention candidates that are still in observation mode
 * and approaching the 14-day activation window. Used for the admin review
 * workflow — Phill confirms or blocks these before they go live.
 *
 * Returns orgs where:
 *   - At least one HealthIntervention exists with tier=2 + observationMode=true
 *   - The tier2_active_from date in InterventionConfig is within the next 3 days
 *     OR already past (meaning observation period just ended)
 *
 * Protected: owner email only.
 * SYN-614
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyTokenSafe, isOwnerEmail } from '@/lib/auth/jwt-utils';
import { getUserEmailById } from '@/lib/admin/verify-admin';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
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

  // Find all Tier 2 observation-mode interventions from the last 21 days
  const twentyOneDaysAgo = new Date();
  twentyOneDaysAgo.setDate(twentyOneDaysAgo.getDate() - 21);

  const observed = await prisma.healthIntervention.findMany({
    where: {
      interventionTier: 2,
      observationMode: true,
      createdAt: { gte: twentyOneDaysAgo },
    },
    select: {
      id: true,
      organizationId: true,
      dimension: true,
      currentScore: true,
      baselineScore: true,
      declineMagnitude: true,
      wouldHaveSentAt: true,
      createdAt: true,
      organization: { select: { name: true, plan: true, slug: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Fetch tier2_active_from dates from InterventionConfig
  const configs = await prisma.interventionConfig.findMany({
    select: { dimension: true, tier2ActiveFrom: true },
  });
  const activationMap = new Map(configs.map(c => [c.dimension, c.tier2ActiveFrom]));

  const now = new Date();
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  // Build candidates — deduplicated by orgId + dimension
  const seen = new Set<string>();
  const candidates = [];

  for (const row of observed) {
    const key = `${row.organizationId}:${row.dimension}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const activationDate = activationMap.get(row.dimension);
    const activationStatus =
      !activationDate ? 'no_date'
      : activationDate <= now ? 'active'          // window passed — live now
      : activationDate <= threeDaysFromNow ? 'imminent'  // within 3 days
      : 'pending';                                 // > 3 days away

    candidates.push({
      interventionId: row.id,
      orgId: row.organizationId,
      orgName: row.organization.name,
      orgPlan: row.organization.plan,
      orgSlug: row.organization.slug,
      dimension: row.dimension,
      currentScore: row.currentScore,
      baselineScore: row.baselineScore,
      declineMagnitude: row.declineMagnitude,
      wouldHaveSentAt: row.wouldHaveSentAt,
      tier2ActivationDate: activationDate,
      activationStatus,
    });
  }

  // Sort: active first, then imminent, then pending
  const ORDER: Record<string, number> = { active: 0, imminent: 1, pending: 2, no_date: 3 };
  candidates.sort((a, b) => ORDER[a.activationStatus] - ORDER[b.activationStatus]);

  return NextResponse.json({
    total: candidates.length,
    active: candidates.filter(c => c.activationStatus === 'active').length,
    imminent: candidates.filter(c => c.activationStatus === 'imminent').length,
    candidates,
  });
}
