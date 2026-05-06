/**
 * HERMES weekly metrics aggregator (SYN-913 / HER-1e)
 *
 * Read-only. Aggregates the past 7 days of HERMES activity for one org.
 * The cron route (app/api/cron/hermes-digest) calls this for each enabled
 * org and sends the result to Phill's Telegram.
 *
 * Success metric (CEO directive — exact, no fudging):
 *   "hours of human work eliminated per week" is credited only when a row
 *   with posts.source='hermes' AND posts.status='published'.
 *   Pending proposals are reported separately and explicitly NOT credited.
 *
 * Calibration figure: estimatedMinutesEliminated assumes 5 minutes saved
 * per published post (brief-writing + gap-spotting that HERMES eliminated).
 * This is a pilot calibration — adjust after 2 weeks of real review data.
 */

import { prisma } from '@/lib/prisma';

/** Minutes of human work credited per published HERMES post. Pilot figure. */
export const MINUTES_ELIMINATED_PER_PUBLISHED_POST = 5;

export interface HermesWeeklyMetrics {
  orgId: string;
  windowStart: Date;
  windowEnd: Date;
  proposalsGenerated: number;
  byGateDecision: { pass: number; warn: number; fail: number };
  readabilityWarnings: number;
  hardFailBlocks: number;
  hardFailReasons: string[];
  postsPublished: number;        // source='hermes' AND status='published' ONLY
  postsPendingApproval: number;  // source='hermes' AND status='pending_approval'
  averageVoiceScore: number | null;
  estimatedMinutesEliminated: number;
}

interface ProposalMetadata {
  readabilityWarning?: boolean;
  hardFailOverride?: boolean;
  reasons?: string[];
}

/**
 * Build the weekly metrics for one org. Window: [endingAt - 7 days, endingAt].
 *
 * Pure read — never writes to any content table.
 */
export async function buildWeeklyMetrics(
  orgId: string,
  endingAt: Date = new Date()
): Promise<HermesWeeklyMetrics> {
  const windowStart = new Date(endingAt.getTime() - 7 * 24 * 60 * 60 * 1000);

  // 1. All proposals created in the window (regardless of final status).
  const proposals = await prisma.hermesProposal.findMany({
    where: {
      organizationId: orgId,
      createdAt: { gte: windowStart, lte: endingAt },
    },
    select: {
      voiceScore: true,
      voiceGateDecision: true,
      voiceFailedRules: true,
      metadata: true,
    },
  });

  const byGateDecision = { pass: 0, warn: 0, fail: 0 };
  let readabilityWarnings = 0;
  let hardFailBlocks = 0;
  const hardFailReasonCounts = new Map<string, number>();
  const voiceScores: number[] = [];

  for (const p of proposals) {
    if (p.voiceGateDecision === 'pass') byGateDecision.pass += 1;
    else if (p.voiceGateDecision === 'warn') byGateDecision.warn += 1;
    else if (p.voiceGateDecision === 'fail') byGateDecision.fail += 1;

    if (typeof p.voiceScore === 'number') voiceScores.push(p.voiceScore);

    const meta = (p.metadata ?? {}) as ProposalMetadata;
    if (meta.readabilityWarning === true) readabilityWarnings += 1;
    if (meta.hardFailOverride === true) {
      hardFailBlocks += 1;
      for (const rule of p.voiceFailedRules ?? []) {
        hardFailReasonCounts.set(rule, (hardFailReasonCounts.get(rule) ?? 0) + 1);
      }
    }
  }

  // 2. Credited metric — published HERMES posts in the window.
  //    Filters by Post.source AND Post.status (introduced in HER-1a, SYN-909).
  //    Posts are scoped via Campaign.organizationId.
  const postsPublished = await prisma.post.count({
    where: {
      source: 'hermes',
      status: 'published',
      campaign: { organizationId: orgId },
      publishedAt: { gte: windowStart, lte: endingAt },
    },
  });

  // 3. Awaiting approval — informational, NOT credited until approved+published.
  const postsPendingApproval = await prisma.post.count({
    where: {
      source: 'hermes',
      status: 'pending_approval',
      campaign: { organizationId: orgId },
      createdAt: { gte: windowStart, lte: endingAt },
    },
  });

  const averageVoiceScore =
    voiceScores.length > 0
      ? Math.round(voiceScores.reduce((a, b) => a + b, 0) / voiceScores.length)
      : null;

  const hardFailReasons = Array.from(hardFailReasonCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => `${reason} (×${count})`);

  return {
    orgId,
    windowStart,
    windowEnd: endingAt,
    proposalsGenerated: proposals.length,
    byGateDecision,
    readabilityWarnings,
    hardFailBlocks,
    hardFailReasons,
    postsPublished,
    postsPendingApproval,
    averageVoiceScore,
    // Calibration: 5 min per published post. Adjust per CEO review after 2 weeks.
    estimatedMinutesEliminated:
      postsPublished * MINUTES_ELIMINATED_PER_PUBLISHED_POST,
  };
}

/**
 * Format the metrics as a plain-text digest for Telegram.
 * No markdown, no bullet points, Grade 4 reading level.
 *
 * Pure — exported for tests.
 */
export function formatWeeklyDigest(
  m: HermesWeeklyMetrics,
  brandDisplayName: string
): string {
  const dateStr = m.windowEnd.toISOString().slice(0, 10);
  const avgScoreStr =
    m.averageVoiceScore !== null ? `${m.averageVoiceScore}/100` : 'n/a';

  const lines = [
    `HERMES Weekly — ${brandDisplayName}`,
    `Week ending ${dateStr}`,
    '',
    `Proposals generated: ${m.proposalsGenerated}`,
    `Posts published (credited): ${m.postsPublished}`,
    `Posts awaiting approval: ${m.postsPendingApproval}`,
    `Average voice score: ${avgScoreStr}`,
    `Readability warnings: ${m.readabilityWarnings}`,
    `Hard-fail blocks: ${m.hardFailBlocks}`,
  ];

  if (m.hardFailReasons.length > 0) {
    lines.push(`Top failure reasons: ${m.hardFailReasons.join(', ')}`);
  }

  lines.push(
    '',
    `Human work eliminated this week: ${m.postsPublished} posts × ${MINUTES_ELIMINATED_PER_PUBLISHED_POST} min = ${m.estimatedMinutesEliminated} min`,
    'Counted only from published posts. Pending posts not yet credited.'
  );

  return lines.join('\n');
}
