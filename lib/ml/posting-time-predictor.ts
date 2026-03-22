/**
 * lib/ml/posting-time-predictor.ts
 *
 * ML model that predicts optimal posting times based on historical engagement data.
 *
 * IMPORTANT: Supabase client is created LAZILY (inside functions, not at module load).
 * This is required for:
 *   - Jest tests (env vars may not be set when module is imported)
 *   - Edge runtime compatibility
 *   - Tree-shaking (avoids pulling in the full Supabase client for pages that don't need it)
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PostingTimeSlot {
  hour: number;         // 0–23 UTC
  dayOfWeek: number;    // 0 = Sunday, 6 = Saturday
  score: number;        // 0–1 predicted engagement score
  confidence: number;   // 0–1 model confidence
}

export interface PostingTimePrediction {
  userId: string;
  platform: string;
  slots: PostingTimeSlot[];
  generatedAt: string;
  modelVersion: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lazy Supabase client factory
// ─────────────────────────────────────────────────────────────────────────────

/** Returns a Supabase client initialised at call-time (not at module load). */
function getSupabaseClient(): SupabaseClient {
  // Deferred require so the module can be imported without env vars present
  // (e.g. during Jest module graph construction)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'PostingTimePredictor: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.'
    );
  }

  return createClient(url, key);
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature extraction helpers
// ─────────────────────────────────────────────────────────────────────────────

interface EngagementRow {
  posted_at: string;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
}

function extractFeatures(row: EngagementRow): { hour: number; dayOfWeek: number; score: number } {
  const date = new Date(row.posted_at);
  const hour = date.getUTCHours();
  const dayOfWeek = date.getUTCDay();
  const engagement = row.likes + row.comments * 2 + row.shares * 3;
  const score = row.reach > 0 ? Math.min(engagement / row.reach, 1) : 0;
  return { hour, dayOfWeek, score };
}

/** Normalises a score array to [0, 1]. */
function normalise(scores: number[]): number[] {
  const max = Math.max(...scores, 1);
  return scores.map((s) => s / max);
}

// ─────────────────────────────────────────────────────────────────────────────
// Core prediction logic
// ─────────────────────────────────────────────────────────────────────────────

const MODEL_VERSION = '1.1.0';

/**
 * Predicts the top posting time slots for a user/platform combination.
 *
 * @param userId   - Supabase user UUID
 * @param platform - e.g. 'twitter', 'linkedin', 'instagram'
 * @param topN     - number of slots to return (default 5)
 */
export async function predictPostingTimes(
  userId: string,
  platform: string,
  topN = 5
): Promise<PostingTimePrediction> {
  // ── 1. Lazily create the Supabase client ────────────────────────────────
  const supabase = getSupabaseClient();

  // ── 2. Fetch historical engagement data ────────────────────────────────
  const { data, error } = await supabase
    .from('post_analytics')
    .select('posted_at, likes, comments, shares, reach')
    .eq('user_id', userId)
    .eq('platform', platform)
    .gte('posted_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()) // last 90 days
    .order('posted_at', { ascending: false })
    .limit(500);

  if (error) {
    throw new Error(`PostingTimePredictor: Supabase query failed — ${error.message}`);
  }

  const rows = (data ?? []) as EngagementRow[];

  // ── 3. Aggregate scores by (dayOfWeek, hour) ───────────────────────────
  const buckets = new Map<string, { total: number; count: number }>();

  for (const row of rows) {
    const { hour, dayOfWeek, score } = extractFeatures(row);
    const key = `${dayOfWeek}:${hour}`;
    const existing = buckets.get(key) ?? { total: 0, count: 0 };
    buckets.set(key, { total: existing.total + score, count: existing.count + 1 });
  }

  // ── 4. Convert buckets → scored slots ──────────────────────────────────
  const slots: PostingTimeSlot[] = [];

  for (const [key, { total, count }] of buckets.entries()) {
    const [dayStr, hourStr] = key.split(':');
    slots.push({
      hour: parseInt(hourStr, 10),
      dayOfWeek: parseInt(dayStr, 10),
      score: total / count,
      confidence: Math.min(count / 10, 1), // confidence grows with sample size (max at 10)
    });
  }

  // ── 5. Fallback: if no data, return generic prime-time slots ───────────
  if (slots.length === 0) {
    return {
      userId,
      platform,
      generatedAt: new Date().toISOString(),
      modelVersion: MODEL_VERSION,
      slots: [
        { hour: 9, dayOfWeek: 2, score: 0.8, confidence: 0.1 },   // Tuesday 9am
        { hour: 12, dayOfWeek: 2, score: 0.75, confidence: 0.1 },  // Tuesday noon
        { hour: 17, dayOfWeek: 4, score: 0.7, confidence: 0.1 },   // Thursday 5pm
        { hour: 10, dayOfWeek: 3, score: 0.65, confidence: 0.1 },  // Wednesday 10am
        { hour: 8, dayOfWeek: 1, score: 0.6, confidence: 0.1 },    // Monday 8am
      ],
    };
  }

  // ── 6. Normalise scores and sort ───────────────────────────────────────
  const rawScores = slots.map((s) => s.score);
  const normalisedScores = normalise(rawScores);
  const scoredSlots = slots
    .map((s, i) => ({ ...s, score: normalisedScores[i] }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  return {
    userId,
    platform,
    generatedAt: new Date().toISOString(),
    modelVersion: MODEL_VERSION,
    slots: scoredSlots,
  };
}

/**
 * Lightweight version that returns only the single best posting time.
 */
export async function getBestPostingTime(
  userId: string,
  platform: string
): Promise<PostingTimeSlot | null> {
  const prediction = await predictPostingTimes(userId, platform, 1);
  return prediction.slots[0] ?? null;
}
