/**
 * HERMES Calendar write (SYN-912 / HER-1d)
 *
 * Writes one HERMES-generated draft to the existing Synthex Calendar via the
 * existing /api/scheduler/posts endpoint. The endpoint requires a real userId
 * — HER-1c's resolveImpersonatedAuthor supplies that. HERMES posts as the
 * Owner-role user with source='hermes' marking the row for attribution.
 *
 * No HTTP round-trip — we call Prisma directly. The route handler's own
 * implementation just wraps prisma.post.create with auth + Zod, which we have
 * already done upstream (auth via cron secret, validation via the gate).
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { VoiceGateResult } from '@/lib/hermes/voice/gate';

export interface CalendarWriteRequest {
  organizationId: string;
  /** Owner-role userId from resolveImpersonatedAuthor. */
  userId: string;
  content: string;
  /** Default channel from BrandConfig — H-1 always 'linkedin'. */
  platform: string;
  /** When the post should be published. HER-1d schedules to "soon" so the human can review and approve. */
  scheduledAt: Date;
  gateResult: VoiceGateResult;
}

export interface CalendarWriteResult {
  postId: string;
  campaignId: string;
}

/**
 * Find or create the HERMES-owned Campaign for this org. Mirrors the
 * autopilot pattern: one campaign per org, settings.source='hermes' marks
 * it as HERMES-generated for downstream filters.
 */
async function findOrCreateHermesCampaign(
  organizationId: string,
  userId: string,
  platform: string
): Promise<string> {
  const existing = await prisma.campaign.findFirst({
    where: {
      organizationId,
      settings: { path: ['source'], equals: 'hermes' },
      status: 'active',
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.campaign.create({
    data: {
      name: 'HERMES Proposals',
      description:
        'Proactive content drafts queued by HERMES for human approval. See SYN-911 / SYN-912.',
      platform,
      status: 'active',
      userId,
      organizationId,
      settings: { source: 'hermes', createdBy: 'cron:hermes-draft' },
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * Write one HERMES draft to the Calendar as a pending_approval Post.
 * Returns null on failure — caller logs and escalates routine LINEAR.
 */
export async function writeDraftToCalendar(
  req: CalendarWriteRequest
): Promise<CalendarWriteResult | null> {
  try {
    const campaignId = await findOrCreateHermesCampaign(
      req.organizationId,
      req.userId,
      req.platform
    );

    const post = await prisma.post.create({
      data: {
        content: req.content,
        platform: req.platform,
        status: 'pending_approval',
        source: 'hermes',
        scheduledAt: req.scheduledAt,
        campaignId,
        metadata: {
          hermes: {
            voiceScore: req.gateResult.score,
            voiceGateDecision: req.gateResult.decision,
            voiceFailedRules: req.gateResult.failedRules,
            readabilityGrade: req.gateResult.readabilityGrade,
            readabilityWarning: req.gateResult.readabilityWarning,
            hardFailOverride: req.gateResult.hardFailOverride,
            generatedAt: new Date().toISOString(),
          },
        },
      },
      select: { id: true, campaignId: true },
    });

    logger.info('[hermes:calendar] draft queued', {
      orgId: req.organizationId,
      postId: post.id,
      voiceScore: req.gateResult.score,
      decision: req.gateResult.decision,
    });

    return { postId: post.id, campaignId: post.campaignId };
  } catch (err) {
    logger.error('[hermes:calendar] write failed', {
      orgId: req.organizationId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
