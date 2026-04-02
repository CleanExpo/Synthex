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

import { logger } from '@/lib/logger';
import type { ContentFormat, PostClassification, PostForClassification } from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

const MODEL = 'anthropic/claude-haiku-4-5';
const MAX_TOKENS = 2048;
const BATCH_SIZE = 20;

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
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    logger.warn('topic-extractor: OPENROUTER_API_KEY missing — using fallback classifications');
    return fallbackClassifications(posts);
  }

  const results: PostClassification[] = [];

  // Process in batches to keep prompt size manageable
  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE);

    try {
      const response = await fetch(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer':
              process.env.OPENROUTER_SITE_URL ?? 'https://synthex.social',
            'X-Title': process.env.OPENROUTER_SITE_NAME ?? 'Synthex',
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              { role: 'system', content: buildSystemPrompt() },
              { role: 'user', content: buildUserPrompt(batch) },
            ],
            max_tokens: MAX_TOKENS,
            temperature: 0,
          }),
          signal: AbortSignal.timeout(30_000),
        }
      );

      if (!response.ok) {
        logger.warn('topic-extractor: OpenRouter error', {
          status: response.status,
          batchStart: i,
        });
        results.push(...fallbackClassifications(batch));
        continue;
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const raw = data.choices?.[0]?.message?.content ?? '';
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
