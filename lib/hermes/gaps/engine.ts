/**
 * HERMES gap engine (SYN-911 / HER-1c)
 *
 * Reads recent unprocessed discovery_signal rows + the org's recent post
 * history → asks Haiku 4.5 to identify content gaps → writes
 * hermes_gap_candidate rows.
 *
 * The gap engine produces up to a SOFT CAP of CANDIDATE_BENCH_MULTIPLIER ×
 * dailyQuota candidates. HER-1d picks the top dailyQuota for actual drafting.
 * The bench depth is what gives HER-1d a fallback when a candidate is
 * hard-fail rejected by the voice gate.
 *
 * Tunable per Implementer Note 2 (SYN-911): if hard-fail rate > 75% in
 * early pilot, bump CANDIDATE_BENCH_MULTIPLIER. No migration, no schema
 * change, redeploy only.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { routedCall } from '@/lib/ai/model-router';
import type { DiscoveredSignal } from '@/lib/hermes/discovery/sweep';

/**
 * Soft cap multiplier for daily candidate generation.
 * candidates_per_day_max = CANDIDATE_BENCH_MULTIPLIER × HermesConfig.dailyQuota
 *
 * Increase to 6 if early-pilot hard-fail rate exceeds 75% and HER-1d's
 * daily quota is consistently under-filled. See SYN-911 Implementer Note 2.
 */
export const CANDIDATE_BENCH_MULTIPLIER = 4;

/** Window (days) in which an existing post on the same topic blocks a new candidate. */
export const DEDUP_WINDOW_DAYS = 14;

export interface GapEngineResult {
  candidatesCreated: number;
  signalsConsidered: number;
  skippedDuplicates: number;
  skippedSoftCap: number;
  fallbackUsed: boolean;
}

interface GapClassification {
  topic: string;
  rationale: string;
  priority: number; // 0..100
  signalIds: string[];
}

interface RecentPost {
  id: string;
  content: string;
  publishedAt: Date | null;
}

/**
 * Pure normalisation for topic deduplication.
 * Lowercase, strip punctuation, collapse whitespace, take first 80 chars.
 * Exported for tests.
 */
export function normaliseTopic(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

/**
 * Run the gap engine for one org. Returns counts; writes to hermes_gap_candidate.
 */
export async function runGapEngineForOrg(
  orgId: string,
  dailyQuota: number
): Promise<GapEngineResult> {
  const softCap = CANDIDATE_BENCH_MULTIPLIER * dailyQuota;

  // 1. Count today's existing candidates — respect the soft cap before we
  //    bother classifying anything.
  const todayStart = startOfUtcDay(new Date());
  const existingToday = await prisma.hermesGapCandidate.count({
    where: { organizationId: orgId, createdAt: { gte: todayStart } },
  });

  if (existingToday >= softCap) {
    logger.info('[hermes:gaps] Soft cap reached — skipping classification', {
      orgId,
      softCap,
      existingToday,
    });
    return {
      candidatesCreated: 0,
      signalsConsidered: 0,
      skippedDuplicates: 0,
      skippedSoftCap: 0,
      fallbackUsed: false,
    };
  }

  const remainingCapacity = softCap - existingToday;

  // 2. Gather unprocessed signals (last 48h, urgency >= routine).
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const signals = await prisma.hermesDiscoverySignal.findMany({
    where: {
      organizationId: orgId,
      createdAt: { gte: since },
      processedAt: null,
    },
    orderBy: { createdAt: 'desc' },
    take: 50, // bound the LLM context
  });

  if (signals.length === 0) {
    return {
      candidatesCreated: 0,
      signalsConsidered: 0,
      skippedDuplicates: 0,
      skippedSoftCap: 0,
      fallbackUsed: false,
    };
  }

  // 3. Pull recent posts for the dedup window.
  const dedupSince = new Date(
    Date.now() - DEDUP_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );
  const recentPosts = await prisma.post.findMany({
    where: {
      campaign: { organizationId: orgId },
      publishedAt: { gte: dedupSince },
    },
    select: { id: true, content: true, publishedAt: true },
    take: 200,
  });

  // 4. Classify via Haiku → fallback to deterministic heuristic on failure.
  let classifications: GapClassification[];
  let fallbackUsed = false;
  try {
    classifications = await classifyGapsViaLlm(orgId, signals, recentPosts);
  } catch (err) {
    fallbackUsed = true;
    logger.warn(
      '[hermes:gaps] LLM classification failed — using deterministic fallback',
      { orgId, error: String(err) }
    );
    classifications = classifyGapsDeterministic(signals);
  }

  if (classifications.length === 0) {
    return {
      candidatesCreated: 0,
      signalsConsidered: signals.length,
      skippedDuplicates: 0,
      skippedSoftCap: 0,
      fallbackUsed,
    };
  }

  // 5. Dedup against recent posts and against existing open candidates.
  const recentNormalised = new Set(
    recentPosts.map(p => normaliseTopic(p.content.slice(0, 200)))
  );
  const openCandidates = await prisma.hermesGapCandidate.findMany({
    where: { organizationId: orgId, status: 'open' },
    select: { topic: true },
    take: 100,
  });
  const openNormalised = new Set(
    openCandidates.map(c => normaliseTopic(c.topic))
  );

  let skippedDuplicates = 0;
  let skippedSoftCap = 0;
  const toCreate: GapClassification[] = [];

  for (const c of classifications.sort((a, b) => b.priority - a.priority)) {
    if (toCreate.length >= remainingCapacity) {
      skippedSoftCap += 1;
      continue;
    }
    const norm = normaliseTopic(c.topic);
    if (recentNormalised.has(norm) || openNormalised.has(norm)) {
      skippedDuplicates += 1;
      continue;
    }
    toCreate.push(c);
    openNormalised.add(norm); // prevent intra-batch dups
  }

  if (toCreate.length === 0) {
    return {
      candidatesCreated: 0,
      signalsConsidered: signals.length,
      skippedDuplicates,
      skippedSoftCap,
      fallbackUsed,
    };
  }

  // 6. Write candidates + mark consumed signals as processed in one transaction.
  const consumedSignalIds = Array.from(
    new Set(toCreate.flatMap(c => c.signalIds))
  );

  await prisma.$transaction([
    ...toCreate.map(c =>
      prisma.hermesGapCandidate.create({
        data: {
          organizationId: orgId,
          topic: c.topic,
          rationale: c.rationale,
          signalIds: c.signalIds,
          priority: Math.max(0, Math.min(100, Math.round(c.priority))),
          status: 'open',
        },
      })
    ),
    prisma.hermesDiscoverySignal.updateMany({
      where: { id: { in: consumedSignalIds } },
      data: { processedAt: new Date() },
    }),
  ]);

  return {
    candidatesCreated: toCreate.length,
    signalsConsidered: signals.length,
    skippedDuplicates,
    skippedSoftCap,
    fallbackUsed,
  };
}

// ============================================================================
// Classifiers
// ============================================================================

/**
 * Haiku-led gap classifier. Bound to 'content_strategy' task type so cost
 * routing can quietly tune the model tier.
 */
async function classifyGapsViaLlm(
  orgId: string,
  signals: Array<{
    id: string;
    signalType: string;
    source: string;
    payload: unknown;
    severity: string;
    createdAt: Date;
  }>,
  recentPosts: RecentPost[]
): Promise<GapClassification[]> {
  // Estimate input tokens — cap signals to most recent 25 for the prompt.
  const promptSignals = signals.slice(0, 25);
  const signalSummary = promptSignals
    .map(
      s =>
        `[${s.id}] ${s.signalType} (severity ${s.severity}): ${JSON.stringify(s.payload).slice(0, 200)}`
    )
    .join('\n');

  const recentTopics = recentPosts
    .slice(0, 30)
    .map(p => `- ${p.content.slice(0, 120)}`)
    .join('\n');

  const systemPrompt = `You are a content gap analyst for a single organisation's marketing automation platform. Identify topic gaps where the org has signals indicating audience interest but no recent post on that topic.

Output strict JSON: an array of gap objects, each with:
  - "topic":     short title (≤ 80 chars), specific to the signal cluster
  - "rationale": one sentence (≤ 280 chars) explaining why this is a gap
  - "priority":  integer 0..100 — 100 = urgent, 0 = trivial
  - "signalIds": array of signal ids that motivated this gap (use the [id] tags)

Return at most 12 gaps. Lower priority = drop it. No markdown, no commentary, JSON only.`;

  const userPrompt = `Signals (last 48h):
${signalSummary || '(none)'}

Recent published posts (last ${DEDUP_WINDOW_DAYS} days):
${recentTopics || '(none — first-time pilot org)'}

Identify the gaps.`;

  const inputTokenEstimate = Math.ceil(
    (systemPrompt.length + userPrompt.length) / 4
  );

  const raw = await routedCall<string>({
    task: {
      taskType: 'content_strategy',
      inputTokenEstimate,
      qualityThreshold: 'medium',
      clientId: orgId,
      runId: `hermes-gaps-${Date.now()}`,
    },
    execute: async (modelId: string) => {
      const { AnthropicProvider } = await import(
        '@/lib/ai/providers/anthropic-provider'
      );
      const provider = new AnthropicProvider();
      const response = await provider.complete({
        model: modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 2000,
        temperature: 0.4,
      });
      const text = response.choices[0]?.message?.content ?? '';
      if (!text.trim()) throw new Error('Empty LLM response');
      return text;
    },
  });

  return parseLlmGapResponse(raw);
}

/**
 * Pure parser for the Haiku JSON output. Tolerates surrounding whitespace and
 * accidental code-fence wrapping. Exported for tests.
 */
export function parseLlmGapResponse(raw: string): GapClassification[] {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const parsed: unknown = JSON.parse(stripped);
  if (!Array.isArray(parsed)) {
    throw new Error('LLM response was not an array');
  }

  const out: GapClassification[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const topic = typeof obj.topic === 'string' ? obj.topic.trim() : '';
    const rationale =
      typeof obj.rationale === 'string' ? obj.rationale.trim() : '';
    const priority =
      typeof obj.priority === 'number' && Number.isFinite(obj.priority)
        ? obj.priority
        : 0;
    const signalIds = Array.isArray(obj.signalIds)
      ? obj.signalIds.filter((s): s is string => typeof s === 'string')
      : [];
    if (!topic || !rationale) continue;
    out.push({ topic, rationale, priority, signalIds });
  }
  return out;
}

/**
 * Deterministic fallback used when Haiku is unavailable. One candidate per
 * urgent signal — uses the signal's source as the topic. Crude but
 * non-empty so the pipeline keeps moving.
 */
export function classifyGapsDeterministic(
  signals: Array<{
    id: string;
    signalType: string;
    source: string;
    payload: unknown;
    severity: string;
  }>
): GapClassification[] {
  return signals
    .filter(s => s.severity === 'urgent')
    .slice(0, 5)
    .map(s => ({
      topic: `${s.signalType.replace(/_/g, ' ')} — ${s.source.slice(0, 60)}`,
      rationale: `Deterministic fallback gap from urgent ${s.signalType} signal. Review and rewrite.`,
      priority: 50,
      signalIds: [s.id],
    }));
}

// ============================================================================
// Helpers
// ============================================================================

function startOfUtcDay(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

// Re-export for tests that want to construct fixtures with the same type as
// the sweep produces.
export type { DiscoveredSignal };
