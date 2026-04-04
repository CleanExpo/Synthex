/**
 * Autopilot Preview API
 *
 * POST /api/autopilot/preview — Dry-run preview of what the autopilot would generate
 *
 * Returns content slots and themes without creating any records.
 *
 * @module app/api/autopilot/preview/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { planDailyContent } from '@/lib/autopilot/daily-planner';
import type { ContentMix } from '@/lib/autopilot/types';

const PreviewSchema = z.object({
  horizonDays: z.number().int().min(1).max(30).optional().default(7),
  postsPerDayPerPlatform: z.number().int().min(1).max(5).optional().default(1),
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
  const parsed = PreviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Load config for mix + platforms
  const config = await prisma.autopilotConfig.findUnique({
    where: { organizationId },
    select: {
      enabledPlatforms: true,
      contentMix: true,
      postsPerDayPerPlatform: true,
      planningHorizonDays: true,
    },
  });

  const platforms = config?.enabledPlatforms ?? [];
  if (platforms.length === 0) {
    return NextResponse.json({
      slots: [],
      message:
        'No platforms enabled for autopilot. Connect platforms and enable autopilot first.',
    });
  }

  const contentMix = (config?.contentMix as ContentMix) ?? undefined;
  const horizonDays = parsed.data.horizonDays;
  const postsPerDay = parsed.data.postsPerDayPerPlatform;

  const plan = await planDailyContent(
    organizationId,
    platforms,
    horizonDays,
    postsPerDay,
    contentMix
  );

  return NextResponse.json({
    preview: true,
    platforms,
    horizonDays,
    postsPerDayPerPlatform: postsPerDay,
    totalExistingPosts: plan.totalExisting,
    slotsToGenerate: plan.totalNeeded,
    slots: plan.slots.map(s => ({
      platform: s.platform,
      date: s.date.toISOString(),
      theme: s.theme,
      reason: s.reason,
    })),
  });
}
