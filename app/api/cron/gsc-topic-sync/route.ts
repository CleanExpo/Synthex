/**
 * GSC Topic Sync Cron
 *
 * Runs weekly (Sunday 8pm UTC = Monday 6am AEST).
 * For each org with a primary GSC property:
 *   1. Fetch top keyword opportunities (impressions ≥ 100, position 5–20)
 *   2. Upsert into ContentTopicSuggestion
 *   3. Calculate opportunityScore = (impressions / 100) * (20 - position)
 *
 * This seeds the content generator's auto-topic feature (SYN-472).
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTopKeywordOpportunities } from '@/lib/google/search-console';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = verifyCronRequest(request, 'GSC_TOPIC_SYNC');
  if (!auth.ok) return auth.response;

  let processed = 0;
  let upserted = 0;
  let errors = 0;

  try {
    // Find all orgs with a primary GSC property
    const properties = await prisma.gSCProperty.findMany({
      where: { isPrimary: true },
      select: { organizationId: true, siteUrl: true },
    });

    for (const property of properties) {
      try {
        const opportunities = await getTopKeywordOpportunities(
          property.siteUrl,
          10
        );

        for (const opp of opportunities) {
          await prisma.contentTopicSuggestion.upsert({
            where: {
              organizationId_keyword: {
                organizationId: property.organizationId,
                keyword: opp.keyword,
              },
            },
            update: {
              impressions: opp.impressions,
              currentRank: opp.position,
              opportunityScore: opp.opportunityScore,
              // Reset usedAt so it can be suggested again after a week
              usedAt: null,
            },
            create: {
              organizationId: property.organizationId,
              keyword: opp.keyword,
              impressions: opp.impressions,
              currentRank: opp.position,
              opportunityScore: opp.opportunityScore,
            },
          });
          upserted++;
        }

        processed++;
      } catch (err) {
        errors++;
        logger.error('gsc-topic-sync:org-failed', {
          organizationId: property.organizationId,
          siteUrl: property.siteUrl,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info('gsc-topic-sync:complete', { processed, upserted, errors });

    return NextResponse.json({ success: true, processed, upserted, errors });
  } catch (error) {
    logger.error('gsc-topic-sync:fatal', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'GSC topic sync failed' },
      { status: 500 }
    );
  }
}
