/**
 * Command Centre — connection-health spine API (SYN-1030).
 *
 * GET /api/command-centre/connection-spine
 * Reports unified operational health for Linear intake, Obsidian / 2nd-brain
 * writeback, Unite-Group CRM / Hermes handoff, and social credential references.
 *
 * Only presence/health signals (booleans + counts) are read — no secret value is
 * ever read, printed, or stored. Social credentials stay reference-only.
 *
 * @module app/api/command-centre/connection-spine/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { isEnabled as obsidianEnabled } from '@/lib/obsidian/client';
import { getQueueStats, QUEUE_NAMES } from '@/lib/queue/bull-queue';
import { buildHermesHandoffPacket } from '@/lib/unite-command-center';
import { mapConnectionSpineHealth } from '@/lib/connection-spine/health';

export async function GET(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );
  if (!security.allowed) {
    return NextResponse.json({ error: security.error }, { status: 401 });
  }

  const organizationId = await getEffectiveOrganizationId(security.context.userId!);
  if (!organizationId) {
    return NextResponse.json({ error: 'No organisation found' }, { status: 400 });
  }

  // Linear intake: webhook configured + queue reachable.
  const webhookConfigured = Boolean(process.env.LINEAR_WEBHOOK_SECRET);
  let queueReachable = true;
  try {
    await getQueueStats(QUEUE_NAMES.AUTONOMOUS_TASKS);
  } catch {
    queueReachable = false;
  }

  // Hermes runtime — presence booleans only, never token values.
  const hermesPacket = buildHermesHandoffPacket({
    gatewayRunning: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    telegramConfigured:
      Boolean(process.env.TELEGRAM_BOT_TOKEN) && Boolean(process.env.TELEGRAM_CHAT_ID),
    whatsappConfigured: false,
    scheduledJobsActive: 0,
  });

  // Social credentials — reference-only counts (never selects token columns).
  const [referenceCount, needsReauthCount] = await Promise.all([
    prisma.platformConnection.count({ where: { organizationId, isActive: true } }),
    prisma.platformConnection.count({
      where: { organizationId, isActive: true, expiresAt: { lt: new Date() } },
    }),
  ]);

  const health = mapConnectionSpineHealth({
    linear: { webhookConfigured, queueReachable },
    obsidian: { enabled: obsidianEnabled() },
    hermes: { status: hermesPacket.status },
    social: { referenceCount, needsReauthCount },
  });

  return NextResponse.json(health);
}
