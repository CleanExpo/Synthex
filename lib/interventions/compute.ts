/**
 * Client Retention Engine — Intervention Computation — SYN-615/620
 *
 * Runs nightly after Health Score computation.
 * For each active client, compares current dimension scores against
 * their personal 30-day rolling baseline and dispatches (or logs in
 * observation mode) interventions when decline exceeds thresholds.
 *
 * Staged activation (SYN-620):
 *   Tier 3 → active from deployment date (immediate)
 *   Tier 2 → active from deployment + 14 days
 *   Tier 1 → active from deployment + 30 days
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendValueProofEmail, getOrgContactEmail } from './email-renderer';

// ── Types ─────────────────────────────────────────────────────────────────────

const DIMENSIONS = [
  'content_consistency',
  'engagement_trajectory',
  'review_responsiveness',
  'authority_momentum',
  'advisor_engagement',
  'platform_usage',
] as const;

type Dimension = (typeof DIMENSIONS)[number];

interface DimensionScore {
  score: number;
  description: string;
}

interface InterventionCandidate {
  organizationId: string;
  dimension: Dimension;
  currentScore: number;
  baselineScore: number;
  declineMagnitude: number; // negative = decline
  tier: 1 | 2 | 3;
  interventionType: string;
  channel: string;
  isObservation: boolean;
}

// ── Config Helpers ────────────────────────────────────────────────────────────

interface TierConfig {
  tier1Threshold: number;
  tier2Threshold: number;
  tier3Threshold: number;
  tier1ActiveFrom: Date | null;
  tier2ActiveFrom: Date | null;
  tier3ActiveFrom: Date | null;
}

async function getInterventionConfig(): Promise<Map<Dimension, TierConfig>> {
  const rows = await prisma.interventionConfig.findMany();
  const map = new Map<Dimension, TierConfig>();
  for (const row of rows) {
    map.set(row.dimension as Dimension, {
      tier1Threshold: row.tier1Threshold,
      tier2Threshold: row.tier2Threshold,
      tier3Threshold: row.tier3Threshold,
      tier1ActiveFrom: row.tier1ActiveFrom,
      tier2ActiveFrom: row.tier2ActiveFrom,
      tier3ActiveFrom: row.tier3ActiveFrom,
    });
  }
  return map;
}

/** Returns true if this tier is past its activation date (not in observation) */
function isTierActive(activeFrom: Date | null): boolean {
  if (!activeFrom) return false;
  return activeFrom <= new Date();
}

// ── Baseline Computation ──────────────────────────────────────────────────────

/**
 * Returns the 30-day rolling average score for each dimension for an org.
 * Uses the last 4 weekly scores (4 weeks ≈ 28 days).
 */
async function getBaselines(
  organizationId: string
): Promise<Map<Dimension, number>> {
  const scores = await prisma.clientHealthScore.findMany({
    where: { organizationId },
    orderBy: { weekStart: 'desc' },
    take: 5, // latest + 4 prior for averaging
    select: { dimensions: true, weekStart: true },
  });

  const baselines = new Map<Dimension, number>();
  if (scores.length < 2) return baselines; // need at least 2 weeks of data

  // Use weeks 2-5 (skip the latest) as the baseline window
  const baselineScores = scores.slice(1);

  for (const dim of DIMENSIONS) {
    const values = baselineScores
      .map(s => {
        const d = (s.dimensions as Record<string, DimensionScore | null>)[dim];
        return d?.score ?? null;
      })
      .filter((v): v is number => v !== null);

    if (values.length > 0) {
      baselines.set(dim, Math.round(values.reduce((a, b) => a + b, 0) / values.length));
    }
  }

  return baselines;
}

// ── Cooldown Check ────────────────────────────────────────────────────────────

/**
 * Returns the set of dimensions that are within the 7-day cooldown window.
 * No intervention fires within 7 days of the previous one for the same dimension.
 */
async function getCooldownDimensions(organizationId: string): Promise<Set<Dimension>> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);

  const recent = await prisma.healthIntervention.findMany({
    where: {
      organizationId,
      createdAt: { gte: cutoff },
    },
    select: { dimension: true },
    distinct: ['dimension'],
  });

  return new Set(recent.map(r => r.dimension as Dimension));
}

// ── Intervention Selection ────────────────────────────────────────────────────

function selectInterventionType(
  tier: 1 | 2 | 3,
  dimension: Dimension
): { interventionType: string; channel: string } {
  if (tier === 3) {
    return { interventionType: 'founder_outreach', channel: 'founder_queue' };
  }
  if (tier === 2) {
    return { interventionType: 'value_proof_email', channel: 'email' };
  }
  // Tier 1 — dimension-specific micro-intervention
  const TIER1_TYPES: Record<Dimension, string> = {
    content_consistency:   'quick_win_post',
    engagement_trajectory: 'optimal_posting_window',
    review_responsiveness: 'review_waiting',
    authority_momentum:    'next_milestone',
    advisor_engagement:    'simplified_advisor_brief',
    platform_usage:        'value_proof_email', // platform_usage ↓ → Tier 2 email per SYN-617
  };
  return { interventionType: TIER1_TYPES[dimension], channel: 'in_app' };
}

// ── Main Computation ──────────────────────────────────────────────────────────

/**
 * Compute intervention candidates for a single org.
 * Returns candidates sorted by tier descending (most urgent first).
 */
async function computeInterventionsForOrg(
  organizationId: string,
  config: Map<Dimension, TierConfig>
): Promise<InterventionCandidate[]> {
  // Get the latest health score
  const latestScore = await prisma.clientHealthScore.findFirst({
    where: { organizationId },
    orderBy: { weekStart: 'desc' },
    select: { dimensions: true },
  });
  if (!latestScore) return [];

  const dims = latestScore.dimensions as Record<string, DimensionScore | null>;
  const [baselines, cooldowns] = await Promise.all([
    getBaselines(organizationId),
    getCooldownDimensions(organizationId),
  ]);

  const candidates: InterventionCandidate[] = [];
  const now = new Date();

  for (const dimension of DIMENSIONS) {
    const current = dims[dimension]?.score;
    const baseline = baselines.get(dimension);
    if (current === undefined || current === null || baseline === undefined) continue;

    const decline = baseline - current; // positive = decline
    if (decline <= 0) continue; // no decline → no intervention

    if (cooldowns.has(dimension)) continue; // within cooldown window

    const cfg = config.get(dimension) ?? {
      tier1Threshold: 15,
      tier2Threshold: 25,
      tier3Threshold: 35,
      tier1ActiveFrom: null,
      tier2ActiveFrom: null,
      tier3ActiveFrom: null,
    };

    // Determine tier (highest applicable)
    let tier: 1 | 2 | 3 | null = null;
    if (decline >= cfg.tier3Threshold) tier = 3;
    else if (decline >= cfg.tier2Threshold) tier = 2;
    else if (decline >= cfg.tier1Threshold) tier = 1;

    if (!tier) continue;

    // Staged activation: check if this tier is past its active date
    const activeFrom = tier === 3 ? cfg.tier3ActiveFrom
      : tier === 2 ? cfg.tier2ActiveFrom
      : cfg.tier1ActiveFrom;
    const isObservation = !isTierActive(activeFrom);

    const { interventionType, channel } = selectInterventionType(tier, dimension);

    candidates.push({
      organizationId,
      dimension,
      currentScore: current,
      baselineScore: baseline,
      declineMagnitude: -decline, // store as negative
      tier,
      interventionType,
      channel,
      isObservation,
    });
  }

  // Sort: most severe tier first, then largest decline
  return candidates.sort((a, b) => b.tier - a.tier || a.declineMagnitude - b.declineMagnitude);
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

async function dispatchIntervention(candidate: InterventionCandidate): Promise<void> {
  const now = new Date();

  // Log to health_interventions (always — observation or not)
  await prisma.healthIntervention.create({
    data: {
      organizationId: candidate.organizationId,
      dimension: candidate.dimension,
      currentScore: candidate.currentScore,
      baselineScore: candidate.baselineScore,
      declineMagnitude: candidate.declineMagnitude,
      interventionTier: candidate.tier,
      interventionType: candidate.interventionType,
      channel: candidate.channel,
      observationMode: candidate.isObservation,
      wouldHaveSentAt: now,
      actuallySentAt: candidate.isObservation ? null : now,
    },
  });

  if (candidate.isObservation) return; // observation mode — log only

  // Live dispatch
  if (candidate.tier === 3) {
    await dispatchFounderOutreach(candidate);
  } else if (candidate.tier === 2 || candidate.interventionType === 'value_proof_email') {
    await dispatchValueProofEmail(candidate);
  }
  // Tier 1 in-app nudges are surfaced at render time — no async dispatch needed
}

async function dispatchFounderOutreach(candidate: InterventionCandidate): Promise<void> {
  // Get org name + recent score trend for talking points
  const [org, recentScores] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: candidate.organizationId },
      select: { name: true },
    }),
    prisma.clientHealthScore.findMany({
      where: { organizationId: candidate.organizationId },
      orderBy: { weekStart: 'desc' },
      take: 4,
      select: { overallScore: true, riskLevel: true, weekStart: true },
    }),
  ]);

  const trend = recentScores.map(s => ({
    week: s.weekStart,
    score: s.overallScore,
    risk: s.riskLevel,
  }));

  const talkingPoints = [
    `${candidate.dimension.replace(/_/g, ' ')} has declined ${Math.abs(candidate.declineMagnitude)} points from their personal baseline`,
    `Current score: ${candidate.currentScore} (baseline was ${candidate.baselineScore})`,
    `4-week trend: ${trend.map(t => t.score).join(' → ')}`,
    'Suggested opening: Ask about their current marketing priorities — avoid mentioning the platform directly',
  ].join('\n');

  await prisma.founderOutreachQueue.create({
    data: {
      organizationId: candidate.organizationId,
      healthScoreTrend: trend,
      talkingPoints,
    },
  });

  logger.info(`[interventions] Tier 3 queued for ${org?.name ?? candidate.organizationId}`);
}

async function dispatchValueProofEmail(candidate: InterventionCandidate): Promise<void> {
  const [contactEmail, org] = await Promise.all([
    getOrgContactEmail(candidate.organizationId),
    prisma.organization.findUnique({
      where: { id: candidate.organizationId },
      select: { name: true },
    }),
  ]);

  if (!contactEmail) {
    logger.warn(
      `[interventions] No contact email for org ${candidate.organizationId} — skipping Tier 2 email`
    );
    return;
  }

  await sendValueProofEmail({
    to: contactEmail,
    clientName: org?.name ?? 'there',
    dimension: candidate.dimension,
    currentScore: candidate.currentScore,
    baselineScore: candidate.baselineScore,
    declineMagnitude: candidate.declineMagnitude,
    organizationId: candidate.organizationId,
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface InterventionRunResult {
  processed: number;
  candidatesFound: number;
  dispatched: number;
  observed: number;
  errors: Array<{ organizationId: string; error: string }>;
}

/**
 * Run intervention computation for all active orgs.
 * Designed to run nightly after compute-health-scores completes.
 */
export async function runInterventions(): Promise<InterventionRunResult> {
  const config = await getInterventionConfig();

  const orgs = await prisma.organization.findMany({
    where: { status: 'active' },
    select: { id: true },
  });

  let candidatesFound = 0;
  let dispatched = 0;
  let observed = 0;
  const errors: Array<{ organizationId: string; error: string }> = [];

  const BATCH = 5;
  for (let i = 0; i < orgs.length; i += BATCH) {
    const batch = orgs.slice(i, i + BATCH);
    await Promise.allSettled(
      batch.map(async org => {
        try {
          const candidates = await computeInterventionsForOrg(org.id, config);
          candidatesFound += candidates.length;

          for (const candidate of candidates) {
            await dispatchIntervention(candidate);
            if (candidate.isObservation) observed++;
            else dispatched++;
          }
        } catch (err) {
          errors.push({
            organizationId: org.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      })
    );
  }

  return {
    processed: orgs.length - errors.length,
    candidatesFound,
    dispatched,
    observed,
    errors,
  };
}
