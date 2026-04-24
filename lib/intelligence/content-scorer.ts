/**
 * Content Scorer — lib/intelligence/content-scorer.ts
 *
 * Computes a weekly Content Score (0–100) for each organisation from:
 *   - ContentPerformanceProfile.confidenceLevel → data availability (0–40 pts)
 *   - ContentImprovementTracking.improvementRate → engagement lift (0–40 pts)
 *   - ContentPerformanceProfile.postCount → volume bonus (0–20 pts)
 *
 * Persists to `content_score_history` via Supabase admin client and records
 * to `score_accuracy_events` for accuracy-gate calibration.
 *
 * @task SYN-664
 */

import { createClient } from '@supabase/supabase-js';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ── Supabase admin client (service role — bypasses RLS) ───────────────────────

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ── Score computation ─────────────────────────────────────────────────────────

export interface ContentScoreComponents {
  data_availability: number; // 0–40
  engagement_lift: number; // 0–40 (20 = baseline, no change)
  volume_bonus: number; // 0–20
}

export interface ComputedContentScore {
  organizationId: string;
  weekStart: string; // ISO date string YYYY-MM-DD
  score: number;
  delta: number;
  components: ContentScoreComponents;
  dataPoints: number;
}

/**
 * Compute Content Score for a single organisation.
 * Returns null if the org has no ContentPerformanceProfile (skip).
 */
export async function computeContentScore(
  organizationId: string,
  weekStart: Date
): Promise<ComputedContentScore | null> {
  // 1. Fetch content performance profile
  const profile = await prisma.contentPerformanceProfile.findUnique({
    where: { organizationId },
    select: { confidenceLevel: true, postCount: true },
  });

  if (!profile) return null;

  // 2. Fetch latest improvement tracking row (within last 14 days)
  const cutoff = new Date(weekStart.getTime() - 14 * 24 * 60 * 60 * 1000);
  const improvement = await prisma.contentImprovementTracking.findFirst({
    where: {
      organizationId,
      weekStart: { gte: cutoff },
    },
    orderBy: { weekStart: 'desc' },
    select: { improvementRate: true },
  });

  // 3. Component scoring
  const dataAvailability = Math.round(
    Math.min(40, profile.confidenceLevel * 40)
  );

  // Improvement rate: null/0 → 20 (baseline); positive → up to 40; negative → down to 0
  const improvementRate = improvement?.improvementRate ?? null;
  const engagementLift =
    improvementRate === null
      ? 20
      : Math.round(Math.max(0, Math.min(40, improvementRate * 100 + 20)));

  const volumeBonus = Math.min(20, Math.round(profile.postCount / 5));

  const score = dataAvailability + engagementLift + volumeBonus;
  const components: ContentScoreComponents = {
    data_availability: dataAvailability,
    engagement_lift: engagementLift,
    volume_bonus: volumeBonus,
  };

  // 4. Compute delta vs previous week
  const prevWeekStart = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const supabaseAdmin = getSupabaseAdmin();

  let delta = 0;
  if (supabaseAdmin) {
    const { data: prevRow } = await supabaseAdmin
      .from('content_score_history')
      .select('score')
      .eq('organization_id', organizationId)
      .gte('week_start', prevWeekStart.toISOString().substring(0, 10))
      .lt('week_start', weekStart.toISOString().substring(0, 10))
      .limit(1)
      .maybeSingle();

    if (prevRow) {
      delta = score - prevRow.score;
    }
  }

  return {
    organizationId,
    weekStart: weekStart.toISOString().substring(0, 10),
    score,
    delta,
    components,
    dataPoints: profile.postCount,
  };
}

/**
 * Persist a computed content score to `content_score_history` and
 * the `score_accuracy_events` ledger for calibration.
 */
export async function saveContentScore(
  computed: ComputedContentScore
): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    logger.warn('content-scorer: Supabase admin unavailable — skipping save', {
      organizationId: computed.organizationId,
    });
    return;
  }

  const { error } = await supabaseAdmin.from('content_score_history').upsert(
    {
      organization_id: computed.organizationId,
      week_start: computed.weekStart,
      score: computed.score,
      delta: computed.delta,
      components: computed.components,
      data_points: computed.dataPoints,
    },
    { onConflict: 'organization_id,week_start' }
  );

  if (error) {
    logger.error('content-scorer: upsert failed', {
      organizationId: computed.organizationId,
      error: error.message,
    });
    return;
  }

  // TODO SYN-666: wire into accuracy-ledger.recordScoreIssued once SYN-669 merges
}
