/**
 * Topic extractor — lib/content-intelligence/topic-extractor.ts
 *
 * Classifies a batch of published posts into structured topics using
 * Claude Haiku via OpenRouter. Runs in batches of 20 posts per API call
 * to keep latency low and token costs minimal.
 *
 * Returns graceful fallback (empty classification) on any AI error —
 * profile computation must never fail just because classification failed.
 *
 * SYN-631
 */

import { getAIProvider } from '@/lib/ai/providers';
import { logger } from '@/lib/logger';
import type { ContentFormat, PostClassification, PostForClassification } from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_TOKENS = 2048;
const BATCH_SIZE = 20;
/** Per-batch timeout budget — preserves the previous AbortSignal.timeout(30s). */
const BATCH_TIMEOUT_MS = 30_000;

// ── Prompts ───────────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are a content analytics assistant. Classify social media posts by topic.
For each post, return a JSON array where each element is:
{
  "postId": "<the exact id provided>",
  "topics": ["topic1", "topic2"],
  "format": "video"|"image"|"carousel"|"text",
  "dayOfWeek": "MON"|"TUE"|"WED"|"THU"|"FRI"|"SAT"|"SUN",
  "hourUtc": 0-23,
  "engagementRate": <the exact engagementRate provided>,
  "hashtags": ["tag1", "tag2"]
}
Topics must be short slugs like "before-after", "team-story", "tip", "promotion", "case-study", "behind-scenes", "testimonial", "educational", "seasonal".
Return ONLY the JSON array. No preamble, no markdown.`;
}

function buildUserPrompt(posts: PostForClassification[]): string {
  const lines = posts.map((p) =>
    JSON.stringify({
      postId: p.id,
      content: p.content.slice(0, 300), // keep prompt lean
      hashtags: p.hashtags,
      engagementRate: p.engagementRate,
      format: p.format,
      publishedAt: p.publishedAt,
    })
  );
  return `Classify these posts:\n${lines.join('\n')}`;
}

// ── Parser ────────────────────────────────────────────────────────────────────

function parseClassifications(
  raw: string,
  posts: PostForClassification[]
): PostClassification[] {
  try {
    const cleaned = raw.replace(/```[a-z]*\n?/gi, '').trim();
    const parsed = JSON.parse(cleaned) as unknown;

    if (!Array.isArray(parsed)) return fallbackClassifications(posts);

    return (parsed as Record<string, unknown>[]).map((item) => ({
      postId: String(item['postId'] ?? ''),
      topics: Array.isArray(item['topics'])
        ? (item['topics'] as string[]).map(String)
        : ['general'],
      format: isValidFormat(item['format'])
        ? (item['format'] as ContentFormat)
        : 'text',
      dayOfWeek: String(item['dayOfWeek'] ?? 'MON'),
      hourUtc: typeof item['hourUtc'] === 'number' ? item['hourUtc'] : 9,
      engagementRate:
        typeof item['engagementRate'] === 'number' ? item['engagementRate'] : 0,
      hashtags: Array.isArray(item['hashtags'])
        ? (item['hashtags'] as string[]).map(String)
        : [],
    }));
  } catch {
    return fallbackClassifications(posts);
  }
}

function isValidFormat(val: unknown): boolean {
  return ['video', 'image', 'carousel', 'text'].includes(String(val));
}

function fallbackClassifications(
  posts: PostForClassification[]
): PostClassification[] {
  return posts.map((p) => ({
    postId: p.id,
    topics: ['general'],
    format: p.format,
    dayOfWeek: dayFromIso(p.publishedAt),
    hourUtc: hourFromIso(p.publishedAt),
    engagementRate: p.engagementRate,
    hashtags: p.hashtags,
  }));
}

function dayFromIso(iso: string): string {
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  try {
    return days[new Date(iso).getUTCDay()] ?? 'MON';
  } catch {
    return 'MON';
  }
}

function hourFromIso(iso: string): number {
  try {
    return new Date(iso).getUTCHours();
  } catch {
    return 9;
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Classify a batch of posts into topics via Claude Haiku.
 * Processes in chunks of BATCH_SIZE to stay within token limits.
 * Falls back to empty classifications on any failure — never throws.
 */
export async function classifyPosts(
  posts: PostForClassification[]
): Promise<PostClassification[]> {
  // Route through the shared provider factory (OpenAI by default; OpenRouter
  // still selectable via AI_PROVIDER). The factory's fast model replaces the
  // previous hardcoded OpenRouter `fetch`, which silently degraded to generic
  // fallbackClassifications on this OpenAI-only deployment (OPENROUTER_API_KEY unset).
  const ai = getAIProvider();
  const results: PostClassification[] = [];

  // Process in batches to keep prompt size manageable
  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE);

    try {
      // Preserve the previous per-batch 30s timeout budget via Promise.race —
      // the provider interface does not expose an abort signal.
      const response = await Promise.race([
        ai.complete({
          model: ai.models.fast,
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            { role: 'user', content: buildUserPrompt(batch) },
          ],
          max_tokens: MAX_TOKENS,
          temperature: 0,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('topic-extractor: batch timed out')),
            BATCH_TIMEOUT_MS
          )
        ),
      ]);

      const raw = response.choices?.[0]?.message?.content ?? '';
      results.push(...parseClassifications(raw, batch));
    } catch (err) {
      logger.warn('topic-extractor: batch classification failed', {
        error: err instanceof Error ? err.message : String(err),
        batchStart: i,
      });
      results.push(...fallbackClassifications(batch));
    }
  }

  return results;
}
