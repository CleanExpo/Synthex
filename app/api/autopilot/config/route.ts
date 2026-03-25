/**
 * Autopilot Config API
 *
 * GET   /api/autopilot/config — Read autopilot configuration for org
 * PATCH /api/autopilot/config — Update autopilot configuration
 *
 * @module app/api/autopilot/config/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { logger } from '@/lib/logger';

// ============================================================================
// GET — Read config
// ============================================================================

export async function GET(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
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

  const config = await prisma.autopilotConfig.findUnique({
    where: { organizationId },
  });

  if (!config) {
    return NextResponse.json({
      enabled: false,
      status: 'idle',
      postsPerDayPerPlatform: 1,
      planningHorizonDays: 7,
      minScoreThreshold: 65,
      autoApproveThreshold: 80,
      contentMix: {
        educational: 30,
        promotional: 20,
        engagement: 25,
        storytelling: 25,
      },
      enableABTesting: false,
      enableTrendContent: true,
      enableRepurposing: true,
      enabledPlatforms: [],
      lastRunAt: null,
      nextRunAt: null,
    });
  }

  return NextResponse.json(config);
}

// ============================================================================
// PATCH — Update config
// ============================================================================

const UpdateSchema = z.object({
  enabled: z.boolean().optional(),
  postsPerDayPerPlatform: z.number().int().min(1).max(5).optional(),
  planningHorizonDays: z.number().int().min(1).max(30).optional(),
  minScoreThreshold: z.number().int().min(0).max(100).optional(),
  autoApproveThreshold: z.number().int().min(0).max(100).optional(),
  contentMix: z.record(z.string(), z.number()).optional(),
  enableABTesting: z.boolean().optional(),
  enableTrendContent: z.boolean().optional(),
  enableRepurposing: z.boolean().optional(),
  enabledPlatforms: z.array(z.string()).optional(),
});

export async function PATCH(request: NextRequest) {
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
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Ensure thresholds are consistent
  if (
    data.minScoreThreshold != null &&
    data.autoApproveThreshold != null &&
    data.minScoreThreshold > data.autoApproveThreshold
  ) {
    return NextResponse.json(
      { error: 'minScoreThreshold cannot exceed autoApproveThreshold' },
      { status: 400 }
    );
  }

  const config = await prisma.autopilotConfig.upsert({
    where: { organizationId },
    create: {
      organizationId,
      ...data,
      contentMix: data.contentMix ?? {
        educational: 30,
        promotional: 20,
        engagement: 25,
        storytelling: 25,
      },
    },
    update: {
      ...data,
      ...(data.contentMix ? { contentMix: data.contentMix } : {}),
    },
  });

  logger.info('[autopilot:config] Updated', {
    orgId: organizationId,
    changes: Object.keys(data),
  });

  return NextResponse.json(config);
}
