/**
 * GET /api/client/nudges
 *
 * Returns the active Tier 1 in-app nudges for the authenticated client's org.
 * Returns at most 2 nudges — the most recent non-observation interventions
 * where channel = 'in_app' and createdAt is within the last 7 days.
 *
 * The rendered text is generated server-side using the intervention_templates
 * table so copy can be updated without a deploy.
 *
 * SYN-617
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function applyMergeFields(template: string, fields: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => fields[key] ?? '');
}

async function computeHeroMetric(
  source: string | null,
  organizationId: string
): Promise<string> {
  if (!source) return '—';

  if (source === 'reviews_handled') {
    const count = await prisma.gBPReview.count({
      where: { organizationId, responseStatus: 'pending' },
    });
    return String(count);
  }

  if (source === 'reach') {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const count = await prisma.post.count({
      where: { campaign: { organizationId }, scheduledAt: { gte: thirtyDaysAgo } },
    });
    return `${count}`;
  }

  return '—';
}

export const GET = withAuth(async (_request: NextRequest, { clientId }) => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Fetch recent in-app interventions that were actually dispatched (not observation)
  const interventions = await prisma.healthIntervention.findMany({
    where: {
      organizationId: clientId,
      channel: 'in_app',
      observationMode: false,
      createdAt: { gte: sevenDaysAgo },
    },
    orderBy: { createdAt: 'desc' },
    take: 2,
    select: {
      id: true,
      dimension: true,
      currentScore: true,
      baselineScore: true,
      declineMagnitude: true,
      interventionTier: true,
      createdAt: true,
    },
  });

  if (interventions.length === 0) {
    return NextResponse.json({ nudges: [] });
  }

  // Fetch templates for all returned dimensions
  const dimensions = [...new Set(interventions.map(i => i.dimension))];
  const templates = await prisma.interventionTemplate.findMany({
    where: {
      tier: { in: [...new Set(interventions.map(i => i.interventionTier))] },
      dimension: { in: dimensions },
      channel: 'in_app',
      active: true,
    },
    select: { tier: true, dimension: true, bodyTemplate: true, heroMetricSource: true },
  });

  const templateMap = new Map(templates.map(t => [`${t.tier}:${t.dimension}`, t]));

  // Render each nudge
  const nudges = await Promise.all(
    interventions.map(async intervention => {
      const key = `${intervention.interventionTier}:${intervention.dimension}`;
      const template = templateMap.get(key);
      if (!template) return null;

      const heroMetric = await computeHeroMetric(template.heroMetricSource, clientId);

      const fields: Record<string, string> = {
        declineAmount: String(Math.abs(intervention.declineMagnitude)),
        currentScore: String(intervention.currentScore),
        baselineScore: String(intervention.baselineScore),
        dimension: intervention.dimension.replace(/_/g, ' '),
        heroMetric,
      };

      return {
        id: intervention.id,
        dimension: intervention.dimension,
        tier: intervention.interventionTier,
        text: applyMergeFields(template.bodyTemplate, fields),
        createdAt: intervention.createdAt,
      };
    })
  );

  return NextResponse.json({ nudges: nudges.filter(Boolean) });
});
