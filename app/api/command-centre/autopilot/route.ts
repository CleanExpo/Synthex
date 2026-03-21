/**
 * Command Centre — Autopilot Toggle API
 *
 * POST /api/command-centre/autopilot
 * Toggle autopilot on/off for the organisation.
 *
 * @module app/api/command-centre/autopilot/route
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

const ToggleSchema = z.object({
  enabled: z.boolean(),
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
  const parsed = ToggleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { enabled } = parsed.data;

  const config = await prisma.autopilotConfig.upsert({
    where: { organizationId },
    create: {
      organizationId,
      enabled,
      status: enabled ? 'idle' : 'paused',
      nextRunAt: enabled ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
    },
    update: {
      enabled,
      status: enabled ? 'idle' : 'paused',
      nextRunAt: enabled ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
      lastErrorMessage: enabled ? null : undefined,
    },
  });

  logger.info('[command-centre] Autopilot toggled', {
    orgId: organizationId,
    enabled,
    userId,
  });

  return NextResponse.json({
    enabled: config.enabled,
    status: config.status,
    nextRunAt: config.nextRunAt,
  });
}
