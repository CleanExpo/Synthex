/**
 * safetyChecks — lib/publish/safetyChecks.ts
 *
 * Five-gate safety layer that must pass before any post is auto-published.
 * A single failing gate aborts the publish with a typed reason.
 *
 * Gates (in order):
 *  1. Subscription active — status in ['active', 'trialing']
 *  2. Calendar mode is 'live' — shadow mode must never auto-publish
 *  3. Slot is approved — reject/draft slots are never published autonomously
 *  4. Campaign authority manifest approved — evidence, claims, rights, QA, human approval
 *  5. Platform token valid — connection exists, isActive, not expired
 *  6. Cold-start gate — org has ≥ MIN_DIGESTS_REQUIRED AIWeeklyDigests
 *
 * @task SYN-523
 */

import prisma from '@/lib/prisma';
import { MIN_DIGESTS_REQUIRED } from '@/lib/calendar/digestReader';
import type { CalendarSlot } from '@/lib/calendar/types';
import type { ContentCalendarData } from '@/lib/calendar/types';
import { extractCampaignAuthorityManifest } from '@/lib/marketing-agency/campaign-authority-manifest';
import { assertCampaignPublishable } from '@/lib/marketing-agency/publish-gate';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SafetyGate =
  | 'subscription_inactive'
  | 'shadow_mode'
  | 'slot_not_approved'
  | 'campaign_authority_blocked'
  | 'token_invalid'
  | 'insufficient_digests';

export interface SafetyCheckResult {
  pass: boolean;
  failedGate?: SafetyGate;
  reason?: string;
}

export interface SafetyCheckInput {
  organizationId: string;
  calendarId: string;
  slotId: string;
  platform: string;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Run all five safety gates for a pending publish queue item.
 * Returns { pass: true } if all gates clear, or { pass: false, failedGate, reason }.
 */
export async function runSafetyChecks(
  input: SafetyCheckInput
): Promise<SafetyCheckResult> {
  const { organizationId, calendarId, slotId, platform } = input;

  // ── Gate 1: Subscription active ────────────────────────────────────────────
  // Look up users in this org → find any active subscription
  const orgUsers = await prisma.user.findMany({
    where: { organizationId },
    select: { id: true },
  });
  const userIds = orgUsers.map(u => u.id);

  if (userIds.length > 0) {
    const activeSub = await prisma.subscription.findFirst({
      where: {
        userId: { in: userIds },
        status: { in: ['active', 'trialing'] },
      },
      select: { id: true },
    });

    if (!activeSub) {
      return {
        pass: false,
        failedGate: 'subscription_inactive',
        reason: 'No active subscription found for this organisation',
      };
    }
  }

  // ── Gate 2: Calendar mode is 'live' ────────────────────────────────────────
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { calendarMode: true },
  });

  if (org?.calendarMode !== 'live') {
    return {
      pass: false,
      failedGate: 'shadow_mode',
      reason: `Organisation calendar mode is '${org?.calendarMode ?? 'shadow'}' — only 'live' allows auto-publish`,
    };
  }

  // ── Gate 3: Slot is approved ────────────────────────────────────────────────
  const calendar = await prisma.contentCalendar.findFirst({
    where: { id: calendarId, organizationId },
    select: { slots: true },
  });

  const calendarData = calendar?.slots as unknown as ContentCalendarData | null;
  const slot = calendarData?.slots?.find(
    (s: CalendarSlot & { status?: string }) => s.id === slotId
  ) as (CalendarSlot & { status?: string }) | undefined;

  if (!slot) {
    return {
      pass: false,
      failedGate: 'slot_not_approved',
      reason: `Slot ${slotId} not found in calendar ${calendarId}`,
    };
  }

  if (slot.status !== 'approved') {
    return {
      pass: false,
      failedGate: 'slot_not_approved',
      reason: `Slot status is '${slot.status ?? 'draft'}' — must be 'approved' to auto-publish`,
    };
  }

  // ── Gate 4: Campaign authority manifest approved ─────────────────────────
  const authorityManifest = extractCampaignAuthorityManifest(slot, calendarData);
  const publishGate = assertCampaignPublishable({
    manifest: authorityManifest,
    platforms: [platform],
    requestedAction: 'publish_queue_external_publish',
  });

  if (!publishGate.allowed) {
    return {
      pass: false,
      failedGate: 'campaign_authority_blocked',
      reason: `Campaign authority gate blocked publish: ${publishGate.blockers.join(', ')}`,
    };
  }

  // ── Gate 5: Platform token valid ─────────────────────────────────────────
  const connection = await prisma.platformConnection.findFirst({
    where: {
      organizationId,
      platform,
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      accessToken: true,
      expiresAt: true,
      isActive: true,
    },
  });

  if (!connection) {
    return {
      pass: false,
      failedGate: 'token_invalid',
      reason: `No active platform connection found for '${platform}'`,
    };
  }

  if (connection.expiresAt && connection.expiresAt < new Date()) {
    return {
      pass: false,
      failedGate: 'token_invalid',
      reason: `Platform token for '${platform}' expired at ${connection.expiresAt.toISOString()}`,
    };
  }

  // ── Gate 6: Cold-start — sufficient digests ───────────────────────────────
  const digestCount =
    userIds.length > 0
      ? await prisma.aIWeeklyDigest.count({
          where: { userId: { in: userIds } },
        })
      : 0;

  if (digestCount < MIN_DIGESTS_REQUIRED) {
    return {
      pass: false,
      failedGate: 'insufficient_digests',
      reason: `Organisation has ${digestCount} digest(s) — ${MIN_DIGESTS_REQUIRED} required before autonomous publishing`,
    };
  }

  return { pass: true };
}
