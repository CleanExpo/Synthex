/**
 * POST /api/seo/displacement/competitors
 * Adds a tracked competitor and seeds an initial keyword gap entry for the org.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import prisma from '@/lib/prisma';

const AddCompetitorSchema = z.object({
  name: z.string().min(1).max(100),
  domain: z.string().min(1).max(255),
  keyword: z.string().min(1).max(255),
  competitorPosition: z.number().positive().optional(),
});

export async function POST(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );
  if (!security.allowed) {
    return NextResponse.json({ error: security.error }, { status: 401 });
  }

  const userId = security.context.userId!;
  const organizationId = await getEffectiveOrganizationId(userId);
  if (!organizationId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 400 }
    );
  }

  const body = await request.json();
  const parsed = AddCompetitorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, domain, keyword, competitorPosition } = parsed.data;

  // TrackedCompetitor is user-scoped (@@unique [userId, domain])
  // Find or create the competitor for this user
  let competitor = await prisma.trackedCompetitor.findFirst({
    where: { userId, domain },
  });

  if (!competitor) {
    competitor = await prisma.trackedCompetitor.create({
      data: {
        userId,
        name,
        domain,
        isActive: true,
        trackPosts: false,
        trackMetrics: false,
        alertsEnabled: false,
        trackingFrequency: 'weekly',
        tags: [],
      },
    });
  } else if (!competitor.isActive) {
    competitor = await prisma.trackedCompetitor.update({
      where: { id: competitor.id },
      data: { isActive: true, name },
    });
  }

  // Seed an initial keyword gap entry for this org + competitor + keyword
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const gap = await prisma.competitorKeywordGap.upsert({
    where: {
      competitorId_keyword_snapshotDate: {
        competitorId: competitor.id,
        keyword,
        snapshotDate: today,
      },
    },
    update: {
      competitorPosition: competitorPosition ?? null,
    },
    create: {
      organizationId,
      competitorId: competitor.id,
      keyword,
      competitorPosition: competitorPosition ?? null,
      snapshotDate: today,
    },
  });

  return NextResponse.json({ success: true, competitor, gap }, { status: 201 });
}
